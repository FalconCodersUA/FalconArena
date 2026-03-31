import {
  Optional,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  Round,
  RoundStatus,
  SubmissionStatus,
  TournamentStatus,
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs.service';
import { AuthUser } from '../common/types/auth-user.type';
import { JobsService } from '../jobs/jobs.service';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoundDto } from './dto/create-round.dto';

@Injectable()
export class RoundsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notificationsService?: NotificationsService,
    @Optional() private readonly jobsService?: JobsService,
    @Optional() private readonly auditLogsService?: AuditLogsService,
  ) {}

  async create(tournamentId: string, dto: CreateRoundDto, actor: AuthUser) {
    this.validateRoundWindow(dto.startsAt, dto.deadlineAt);

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    const aggregate = await this.prisma.round.aggregate({
      where: { tournamentId },
      _max: { sequence: true },
    });

    const sequence = (aggregate._max.sequence ?? 0) + 1;

    const round = await this.prisma.round.create({
      data: {
        tournamentId,
        sequence,
        title: dto.title,
        description: dto.description,
        mustHave: dto.mustHave ?? [],
        technologyRequirements: dto.technologyRequirements ?? [],
        additionalMaterials: dto.additionalMaterials ?? [],
        startsAt: dto.startsAt,
        deadlineAt: dto.deadlineAt,
      },
    });

    await this.auditLogsService?.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: 'round.created',
      entityType: 'round',
      entityId: round.id,
      entityLabel: round.title,
      tournamentId,
      title: 'Created round',
      description: `${round.title} was added as round #${round.sequence}.`,
      metadata: {
        sequence: round.sequence,
        startsAt: round.startsAt.toISOString(),
        deadlineAt: round.deadlineAt.toISOString(),
      },
    });

    return this.mapRoundView(round);
  }

  async listByTournament(tournamentId: string) {
    await this.ensureTournamentExists(tournamentId);
    await this.closeExpiredRounds(tournamentId);
    await this.ensureDeadlineReminderJobs(tournamentId);

    const rounds = await this.prisma.round.findMany({
      where: { tournamentId },
      orderBy: { sequence: 'asc' },
    });

    return rounds.map((round) => this.mapRoundView(round));
  }

  async getActiveRound(tournamentId: string) {
    await this.ensureTournamentExists(tournamentId);
    await this.closeExpiredRounds(tournamentId);
    await this.ensureDeadlineReminderJobs(tournamentId);

    const round = await this.prisma.round.findFirst({
      where: {
        tournamentId,
        status: RoundStatus.ACTIVE,
      },
      orderBy: { sequence: 'asc' },
    });

    return round ? this.mapRoundView(round) : null;
  }

  async updateStatus(
    tournamentId: string,
    roundId: string,
    status: RoundStatus,
    actor: AuthUser,
  ) {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      include: {
        tournament: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });
    if (!round || round.tournamentId !== tournamentId) {
      throw new NotFoundException('Round not found in this tournament');
    }

    this.assertStatusTransition(round.status, status);

    if (round.status === status) {
      return this.mapRoundView(round);
    }

    if (status === RoundStatus.ACTIVE) {
      if (round.tournament.status === TournamentStatus.DRAFT) {
        throw new BadRequestException('Cannot activate round for draft tournament');
      }

      if (round.tournament.status === TournamentStatus.FINISHED) {
        throw new BadRequestException('Cannot activate round for finished tournament');
      }

      if (Date.now() > round.deadlineAt.getTime()) {
        throw new BadRequestException('Cannot activate round after deadline');
      }

      const anotherActive = await this.prisma.round.findFirst({
        where: {
          tournamentId,
          status: RoundStatus.ACTIVE,
          id: { not: roundId },
        },
      });

      if (anotherActive) {
        throw new ConflictException(
          'Another round is already active for this tournament',
        );
      }

      const [updatedRound] = await this.prisma.$transaction([
        this.prisma.round.update({
          where: { id: roundId },
          data: { status },
        }),
        this.prisma.tournament.update({
          where: { id: tournamentId },
          data: { status: TournamentStatus.RUNNING },
        }),
      ]);

      await this.jobsService?.scheduleDeadlineReminderForRound({
        id: updatedRound.id,
        title: updatedRound.title,
        tournamentId: updatedRound.tournamentId,
        deadlineAt: updatedRound.deadlineAt,
      });

      await this.notificationsService?.create({
        type: NotificationType.ROUND_STARTED,
        audience: 'ALL',
        title: `Стартував раунд: ${updatedRound.title}`,
        body: 'Активний раунд відкрито. Перевірте вимоги, дедлайн і подайте роботу вчасно.',
        linkUrl: `/app/tournaments/${tournamentId}`,
      });

      await this.auditLogsService?.record({
        actorId: actor.userId,
        actorRole: actor.role,
        action: 'round.status_updated',
        entityType: 'round',
        entityId: updatedRound.id,
        entityLabel: updatedRound.title,
        tournamentId,
        title: 'Activated round',
        description: `${updatedRound.title} status changed from ${round.status} to ${status}.`,
        metadata: {
          previousStatus: round.status,
          nextStatus: status,
        },
      });

      return this.mapRoundView(updatedRound);
    }

    if (status === RoundStatus.EVALUATED) {
      throw new BadRequestException(
        'Use finish evaluation endpoint to mark round as evaluated',
      );
    }

    if (status === RoundStatus.SUBMISSION_CLOSED) {
      const updatedRound = await this.closeSubmissionsAndRound(roundId);
      await this.auditLogsService?.record({
        actorId: actor.userId,
        actorRole: actor.role,
        action: 'round.status_updated',
        entityType: 'round',
        entityId: updatedRound.id,
        entityLabel: updatedRound.title,
        tournamentId,
        title: 'Closed submissions',
        description: `${updatedRound.title} status changed from ${round.status} to ${status}.`,
        metadata: {
          previousStatus: round.status,
          nextStatus: status,
        },
      });
      return this.mapRoundView(updatedRound);
    }

    throw new BadRequestException(
      `Unsupported round status update: ${round.status} -> ${status}`,
    );
  }

  async findById(roundId: string) {
    const round = await this.prisma.round.findUnique({ where: { id: roundId } });
    if (!round) {
      throw new NotFoundException('Round not found');
    }

    if (
      round.status === RoundStatus.ACTIVE &&
      Date.now() > round.deadlineAt.getTime()
    ) {
      return this.closeSubmissionsAndRound(round.id);
    }

    await this.ensureDeadlineReminderJobs(undefined, round.id);

    return round;
  }

  async ensureSubmissionsOpen(roundId: string): Promise<Round> {
    const round = await this.findById(roundId);

    if (round.status !== RoundStatus.ACTIVE) {
      throw new BadRequestException('Round is not accepting submissions');
    }

    if (Date.now() > round.deadlineAt.getTime()) {
      await this.closeSubmissionsAndRound(round.id);
      throw new BadRequestException('Submission deadline has passed');
    }

    await this.ensureDeadlineReminderJobs(undefined, round.id);

    return round;
  }

  private async ensureTournamentExists(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }
  }

  private async closeExpiredRounds(tournamentId: string) {
    const expiredRounds = await this.prisma.round.findMany({
      where: {
        tournamentId,
        status: RoundStatus.ACTIVE,
        deadlineAt: { lt: new Date() },
      },
      select: {
        id: true,
      },
    });

    if (expiredRounds.length === 0) {
      return;
    }

    const roundIds = expiredRounds.map((round) => round.id);

    await this.prisma.$transaction([
      this.prisma.round.updateMany({
        where: {
          id: { in: roundIds },
          status: RoundStatus.ACTIVE,
        },
        data: {
          status: RoundStatus.SUBMISSION_CLOSED,
        },
      }),
      this.prisma.submission.updateMany({
        where: {
          roundId: { in: roundIds },
          status: SubmissionStatus.SUBMITTED,
        },
        data: {
          status: SubmissionStatus.LOCKED,
        },
      }),
    ]);

    const affectedRounds = await this.prisma.round.findMany({
      where: { id: { in: roundIds } },
      select: { title: true, tournamentId: true },
    });

    await Promise.all(
      affectedRounds.map((round) =>
        this.notificationsService?.create({
          type: NotificationType.SUBMISSION_CLOSED,
          audience: 'ALL',
          title: `Сабміти закрито: ${round.title}`,
          body: 'Прийом робіт для цього раунду завершено.',
          linkUrl: `/app/tournaments/${round.tournamentId}`,
        }),
      ) ?? [],
    );
  }

  private async ensureDeadlineReminderJobs(tournamentId?: string, roundId?: string) {
    const now = new Date();

    const rounds = await this.prisma.round.findMany({
      where: {
        ...(tournamentId ? { tournamentId } : {}),
        ...(roundId ? { id: roundId } : {}),
        status: RoundStatus.ACTIVE,
        deadlineReminderSentAt: null,
        deadlineAt: {
          gt: now,
        },
      },
      select: {
        id: true,
        title: true,
        tournamentId: true,
        deadlineAt: true,
        deadlineReminderSentAt: true,
      },
    });

    if (rounds.length === 0) {
      return;
    }

    await Promise.all(
      rounds.map((round) =>
        this.jobsService?.scheduleDeadlineReminderForRound(round),
      ) ?? [],
    );
  }

  private async closeSubmissionsAndRound(roundId: string) {
    const [updatedRound] = await this.prisma.$transaction([
      this.prisma.round.update({
        where: { id: roundId },
        data: { status: RoundStatus.SUBMISSION_CLOSED },
      }),
      this.prisma.submission.updateMany({
        where: {
          roundId,
          status: SubmissionStatus.SUBMITTED,
        },
        data: {
          status: SubmissionStatus.LOCKED,
        },
      }),
    ]);

    await this.notificationsService?.create({
      type: NotificationType.SUBMISSION_CLOSED,
      audience: 'ALL',
      title: `Сабміти закрито: ${updatedRound.title}`,
      body: 'Прийом робіт для цього раунду завершено.',
      linkUrl: `/app/tournaments/${updatedRound.tournamentId}`,
    });

    return updatedRound;
  }

  private assertStatusTransition(currentStatus: RoundStatus, nextStatus: RoundStatus) {
    const allowedTransitions: Record<RoundStatus, RoundStatus[]> = {
      [RoundStatus.DRAFT]: [RoundStatus.ACTIVE],
      [RoundStatus.ACTIVE]: [RoundStatus.SUBMISSION_CLOSED],
      [RoundStatus.SUBMISSION_CLOSED]: [],
      [RoundStatus.EVALUATED]: [],
    };

    if (currentStatus === nextStatus) {
      return;
    }

    if (!allowedTransitions[currentStatus].includes(nextStatus)) {
      throw new BadRequestException(
        `Invalid round status transition: ${currentStatus} -> ${nextStatus}`,
      );
    }
  }

  private validateRoundWindow(startsAt: Date, deadlineAt: Date) {
    if (startsAt >= deadlineAt) {
      throw new BadRequestException('startsAt must be earlier than deadlineAt');
    }
  }

  private mapRoundView(round: Round) {
    return {
      ...round,
      mustHave: this.toStringArray(round.mustHave),
      technologyRequirements: this.toStringArray(
        (round as Round & { technologyRequirements?: unknown }).technologyRequirements,
      ),
      additionalMaterials: this.toStringArray(
        (round as Round & { additionalMaterials?: unknown }).additionalMaterials,
      ),
    };
  }

  private toStringArray(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
  }
}
