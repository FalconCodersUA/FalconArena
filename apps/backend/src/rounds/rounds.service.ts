import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Round, RoundStatus, SubmissionStatus, TournamentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoundDto } from './dto/create-round.dto';

@Injectable()
export class RoundsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tournamentId: string, dto: CreateRoundDto) {
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

    return this.mapRoundView(round);
  }

  async listByTournament(tournamentId: string) {
    await this.ensureTournamentExists(tournamentId);
    await this.closeExpiredRounds(tournamentId);

    const rounds = await this.prisma.round.findMany({
      where: { tournamentId },
      orderBy: { sequence: 'asc' },
    });

    return rounds.map((round) => this.mapRoundView(round));
  }

  async getActiveRound(tournamentId: string) {
    await this.ensureTournamentExists(tournamentId);
    await this.closeExpiredRounds(tournamentId);

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

      return this.mapRoundView(updatedRound);
    }

    if (status === RoundStatus.EVALUATED) {
      throw new BadRequestException(
        'Use finish evaluation endpoint to mark round as evaluated',
      );
    }

    if (status === RoundStatus.SUBMISSION_CLOSED) {
      const updatedRound = await this.closeSubmissionsAndRound(roundId);
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
