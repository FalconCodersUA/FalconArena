import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { NotificationType, RoundStatus, SubmissionStatus } from '@prisma/client';
import { AuditLogsService } from '../audit-logs.service';
import { AuthUser } from '../common/types/auth-user.type';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoundsService } from '../rounds/rounds.service';
import { UpsertSubmissionDto } from './dto/upsert-submission.dto';

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roundsService: RoundsService,
    @Optional() private readonly notificationsService?: NotificationsService,
    @Optional() private readonly auditLogsService?: AuditLogsService,
  ) {}

  async upsertMySubmission(
    roundId: string,
    actor: AuthUser,
    dto: UpsertSubmissionDto,
  ) {
    const round = await this.roundsService.ensureSubmissionsOpen(roundId);

    const team = await this.prisma.team.findUnique({
      where: {
        tournamentId_captainId: {
          tournamentId: round.tournamentId,
          captainId: actor.userId,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!team) {
      throw new NotFoundException(
        'Current user has no team in this tournament as captain',
      );
    }

    const existing = await this.prisma.submission.findUnique({
      where: {
        roundId_teamId: {
          roundId,
          teamId: team.id,
        },
      },
    });

    const submittedAt = existing?.submittedAt ?? new Date();

    if (!existing) {
      const created = await this.prisma.submission.create({
        data: {
          roundId,
          teamId: team.id,
          repoUrl: dto.repoUrl,
          demoUrl: dto.demoUrl,
          liveDemoUrl: dto.liveDemoUrl,
          shortSummary: dto.shortSummary,
          status: SubmissionStatus.SUBMITTED,
          submittedAt,
        },
        include: {
          team: { select: { id: true, name: true } },
          round: { select: { id: true, title: true, deadlineAt: true, status: true } },
        },
      });

      await this.notificationsService?.create({
        type: NotificationType.SUBMISSION_RECEIVED,
        userId: actor.userId,
        title: `Сабміт збережено: ${created.round.title}`,
        body: `Ваш сабміт для команди ${created.team.name} успішно збережено.`,
        linkUrl: '/app/team',
      });

      await this.auditLogsService?.record({
        actorId: actor.userId,
        actorRole: actor.role,
        action: 'submission.saved',
        entityType: 'submission',
        entityId: created.id,
        entityLabel: created.round.title,
        tournamentId: round.tournamentId,
        title: 'Saved submission',
        description: `${created.team.name} submitted work for ${created.round.title}.`,
        metadata: {
          roundId: created.round.id,
          teamId: created.team.id,
          teamName: created.team.name,
        },
      });

      return {
        ...created,
        isEditable: this.isEditable(created.round.status, created.round.deadlineAt),
      };
    }

    const updated = await this.prisma.submission.update({
      where: {
        roundId_teamId: {
          roundId,
          teamId: team.id,
        },
      },
      data: {
        repoUrl: dto.repoUrl,
        demoUrl: dto.demoUrl,
        liveDemoUrl: dto.liveDemoUrl,
        shortSummary: dto.shortSummary,
        status: SubmissionStatus.SUBMITTED,
        submittedAt,
      },
      include: {
        team: { select: { id: true, name: true } },
        round: { select: { id: true, title: true, deadlineAt: true, status: true } },
      },
    });

      await this.notificationsService?.create({
        type: NotificationType.SUBMISSION_RECEIVED,
        userId: actor.userId,
        title: `Сабміт збережено: ${updated.round.title}`,
        body: `Ваш сабміт для команди ${updated.team.name} успішно збережено.`,
        linkUrl: '/app/team',
      });

    await this.auditLogsService?.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: 'submission.saved',
      entityType: 'submission',
      entityId: updated.id,
      entityLabel: updated.round.title,
      tournamentId: round.tournamentId,
      title: 'Updated submission',
      description: `${updated.team.name} updated the submission for ${updated.round.title}.`,
      metadata: {
        roundId: updated.round.id,
        teamId: updated.team.id,
        teamName: updated.team.name,
      },
    });

    return {
      ...updated,
      isEditable: this.isEditable(updated.round.status, updated.round.deadlineAt),
    };
  }

  async getMySubmission(roundId: string, captainUserId: string) {
    const round = await this.roundsService.findById(roundId);

    const team = await this.prisma.team.findUnique({
      where: {
        tournamentId_captainId: {
          tournamentId: round.tournamentId,
          captainId: captainUserId,
        },
      },
      select: { id: true, name: true },
    });

    if (!team) {
      throw new NotFoundException(
        'Current user has no team in this tournament as captain',
      );
    }

    const submission = await this.prisma.submission.findUnique({
      where: {
        roundId_teamId: {
          roundId,
          teamId: team.id,
        },
      },
      include: {
        round: { select: { id: true, title: true, deadlineAt: true, status: true } },
        team: { select: { id: true, name: true } },
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found for current team');
    }

    return {
      ...submission,
      isEditable: this.isEditable(submission.round.status, submission.round.deadlineAt),
    };
  }

  async listByRound(roundId: string) {
    const round = await this.roundsService.findById(roundId);

    const submissions = await this.prisma.submission.findMany({
      where: { roundId },
      include: {
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      round: {
        id: round.id,
        title: round.title,
        deadlineAt: round.deadlineAt,
        status: round.status,
      },
      submissions,
    };
  }

  private isEditable(status: RoundStatus, deadlineAt: Date) {
    return status === RoundStatus.ACTIVE && Date.now() <= deadlineAt.getTime();
  }
}
