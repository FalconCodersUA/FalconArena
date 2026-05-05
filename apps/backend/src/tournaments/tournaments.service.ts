import {
  Optional,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, Role, Tournament, TournamentStatus } from '@prisma/client';
import { AuditLogsService } from '../audit-logs.service';
import { AuthUser } from '../common/types/auth-user.type';
import { JobsService } from '../jobs/jobs.service';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  SystemIntegrationsService,
  TournamentDefaultsConfig,
} from '../system-integrations/system-integrations.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { ListTournamentsDto } from './dto/list-tournaments.dto';

type TournamentView = Tournament & {
  registrationIsOpen: boolean;
  registrationHasStarted: boolean;
  registrationIsClosed: boolean;
  canTeamRegister: boolean;
  hideTeamsUntilRegistrationClose: boolean;
  defaultProjectTimeZone: string;
};

type TournamentJuryUserView = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isBlocked: boolean;
};

type ScoresPayload = {
  technicalBackend?: number;
  technicalDatabase?: number;
  technicalFrontend?: number;
  mustHave?: number;
  stability?: number;
  usability?: number;
};

@Injectable()
export class TournamentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly leaderboardService?: LeaderboardService,
    @Optional() private readonly notificationsService?: NotificationsService,
    @Optional() private readonly jobsService?: JobsService,
    @Optional()
    private readonly systemIntegrationsService?: SystemIntegrationsService,
    @Optional() private readonly auditLogsService?: AuditLogsService,
  ) {}

  async create(dto: CreateTournamentDto, actor: AuthUser): Promise<TournamentView> {
    this.validateRegistrationWindow(dto.registrationOpenAt, dto.registrationCloseAt);
    const defaults = await this.getTournamentDefaults();

    const tournament = await this.prisma.tournament.create({
      data: {
        title: dto.title,
        description: dto.description,
        startsAt: dto.startsAt,
        registrationOpenAt: dto.registrationOpenAt,
        registrationCloseAt: dto.registrationCloseAt,
        maxTeams: dto.maxTeams,
        createdById: actor.userId,
      },
    });

    await this.auditLogsService?.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: 'tournament.created',
      entityType: 'tournament',
      entityId: tournament.id,
      entityLabel: tournament.title,
      tournamentId: tournament.id,
      title: 'Created tournament',
      description: `${tournament.title} was created in ${tournament.status} status.`,
      metadata: {
        status: tournament.status,
        registrationOpenAt: tournament.registrationOpenAt.toISOString(),
        registrationCloseAt: tournament.registrationCloseAt.toISOString(),
      },
    });

    return this.mapTournamentView(tournament, defaults);
  }

  async list(query: ListTournamentsDto): Promise<TournamentView[]> {
    const defaults = await this.getTournamentDefaults();
    const tournaments = await this.prisma.tournament.findMany({
      where: {
        status: query.status,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return tournaments.map((tournament) => this.mapTournamentView(tournament, defaults));
  }

  async findById(id: string): Promise<TournamentView> {
    const defaults = await this.getTournamentDefaults();
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    return this.mapTournamentView(tournament, defaults);
  }

  async getTournamentJury(id: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
      },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    const [assigned, candidates] = await Promise.all([
      this.prisma.tournamentJury.findMany({
        where: { tournamentId: id },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
              isBlocked: true,
            },
          },
        },
        orderBy: { assignedAt: 'asc' },
      }),
      this.prisma.user.findMany({
        where: {
          role: Role.JURY,
          isBlocked: false,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isBlocked: true,
        },
        orderBy: [{ fullName: 'asc' }, { email: 'asc' }],
      }),
    ]);

    return {
      tournamentId: tournament.id,
      tournamentTitle: tournament.title,
      assigned: assigned.map((item) => this.mapTournamentJuryUser(item.user)),
      candidates: candidates.map((item) => this.mapTournamentJuryUser(item)),
    };
  }

  async updateTournamentJury(
    id: string,
    juryUserIds: string[],
    actor: AuthUser,
  ) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
      },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    const uniqueIds = [...new Set(juryUserIds)];
    const selectedUsers = uniqueIds.length > 0
      ? await this.prisma.user.findMany({
          where: {
            id: { in: uniqueIds },
            role: Role.JURY,
            isBlocked: false,
          },
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        })
      : [];

    if (selectedUsers.length !== uniqueIds.length) {
      throw new BadRequestException(
        'Some selected jury users are invalid, blocked, or not JURY',
      );
    }

    await this.prisma.$transaction([
      this.prisma.tournamentJury.deleteMany({
        where: { tournamentId: id },
      }),
      ...(uniqueIds.length > 0
        ? [
            this.prisma.tournamentJury.createMany({
              data: uniqueIds.map((userId) => ({
                tournamentId: id,
                userId,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    await this.auditLogsService?.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: 'tournament.jury_updated',
      entityType: 'tournament',
      entityId: tournament.id,
      entityLabel: tournament.title,
      tournamentId: tournament.id,
      title: 'Updated tournament jury',
      description: `${tournament.title} jury pool was updated.`,
      metadata: {
        juryUserIds: uniqueIds,
        juryCount: uniqueIds.length,
        juryEmails: selectedUsers.map((item) => item.email),
      },
    });

    return this.getTournamentJury(id);
  }

  async getArchive(id: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    if (tournament.status !== TournamentStatus.FINISHED) {
      throw new BadRequestException(
        'Tournament archive is available only for finished tournaments',
      );
    }

    const [teams, rounds, leaderboard] = await Promise.all([
      this.prisma.team.findMany({
        where: { tournamentId: id },
        include: {
          _count: {
            select: {
              members: true,
              submissions: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.round.findMany({
        where: { tournamentId: id },
        orderBy: { sequence: 'asc' },
        include: {
          submissions: {
            orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                  organization: true,
                },
              },
              assignments: {
                include: {
                  evaluation: {
                    select: {
                      totalScore: true,
                      scores: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.leaderboardService?.getTournamentLeaderboard(id) ?? null,
    ]);

    const leaderboardRows = leaderboard?.rows ?? [];
    const leaderboardRowMap = new Map(
      leaderboardRows.map((row) => [row.teamId, row]),
    );

    const mappedRounds = rounds.map((round) => {
      const submissions = round.submissions.map((submission) => {
        const evaluations = submission.assignments
          .map((assignment) => assignment.evaluation)
          .filter((evaluation): evaluation is NonNullable<typeof evaluation> => !!evaluation);
        const evaluationsCount = evaluations.length;
        const averageScore =
          evaluationsCount > 0
            ? this.round2(
                evaluations.reduce((sum, evaluation) => sum + evaluation.totalScore, 0) /
                  evaluationsCount,
              )
            : 0;

        return {
          id: submission.id,
          teamId: submission.team.id,
          teamName: submission.team.name,
          organization: submission.team.organization,
          repoUrl: submission.repoUrl,
          demoUrl: submission.demoUrl,
          liveDemoUrl: submission.liveDemoUrl,
          shortSummary: submission.shortSummary,
          status: submission.status,
          submittedAt: submission.submittedAt,
          evaluationsCount,
          averageScore,
          categoryAverages: this.calculateCategoryAverages(
            evaluations.map((evaluation) => evaluation.scores),
          ),
        };
      });

      const submissionScores = submissions.filter((item) => item.evaluationsCount > 0);
      const averageScore =
        submissionScores.length > 0
          ? this.round2(
              submissionScores.reduce((sum, item) => sum + item.averageScore, 0) /
                submissionScores.length,
            )
          : 0;

      return {
        id: round.id,
        sequence: round.sequence,
        title: round.title,
        description: round.description,
        status: round.status,
        startsAt: round.startsAt,
        deadlineAt: round.deadlineAt,
        submissionsCount: submissions.length,
        evaluatedSubmissionsCount: submissionScores.length,
        averageScore,
        submissions,
      };
    });

    const defaults = await this.getTournamentDefaults();

    return {
      tournament: this.mapTournamentView(tournament, defaults),
      summary: {
        teamsCount: teams.length,
        roundsCount: mappedRounds.length,
        submissionsCount: mappedRounds.reduce(
          (sum, round) => sum + round.submissionsCount,
          0,
        ),
      },
      leaderboard,
      teams: teams.map((team) => {
        const boardRow = leaderboardRowMap.get(team.id);
        return {
          id: team.id,
          name: team.name,
          organization: team.organization,
          membersCount: team._count.members,
          submissionsCount: team._count.submissions,
          rank: boardRow?.rank ?? null,
          totalScore: boardRow?.totalScore ?? 0,
          averageScore: boardRow?.averageScore ?? 0,
          evaluationsCount: boardRow?.evaluationsCount ?? 0,
        };
      }),
      rounds: mappedRounds,
    };
  }

  async updateStatus(
    id: string,
    status: TournamentStatus,
    actor: AuthUser,
  ): Promise<TournamentView> {
    const existing = await this.prisma.tournament.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Tournament not found');
    }

    if (status === TournamentStatus.REGISTRATION) {
      this.validateRegistrationWindow(
        existing.registrationOpenAt,
        existing.registrationCloseAt,
      );
    }

    this.assertStatusTransition(existing.status, status);

    if (existing.status === status) {
      const defaults = await this.getTournamentDefaults();
      return this.mapTournamentView(existing, defaults);
    }

    const tournament = await this.prisma.tournament.update({
      where: { id },
      data: { status },
    });

    await this.auditLogsService?.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: 'tournament.status_updated',
      entityType: 'tournament',
      entityId: tournament.id,
      entityLabel: tournament.title,
      tournamentId: tournament.id,
      title: 'Updated tournament status',
      description: `${tournament.title} status changed from ${existing.status} to ${status}.`,
      metadata: {
        previousStatus: existing.status,
        nextStatus: status,
      },
    });

    if (status === TournamentStatus.REGISTRATION) {
      await this.jobsService?.scheduleRegistrationStartedNotification({
        tournamentId: tournament.id,
        tournamentTitle: tournament.title,
      });
    }

    if (status === TournamentStatus.FINISHED) {
      await this.notificationsService?.create({
        type: NotificationType.GENERAL,
        audience: 'ALL',
        title: `Турнір завершено: ${tournament.title}`,
        body: 'Підсумкові результати доступні в лідерборді та архіві турніру.',
        linkUrl: `/app/archive?tournamentId=${tournament.id}`,
      });
    }

    const defaults = await this.getTournamentDefaults();
    return this.mapTournamentView(tournament, defaults);
  }

  private assertStatusTransition(
    currentStatus: TournamentStatus,
    nextStatus: TournamentStatus,
  ) {
    const allowedTransitions: Record<TournamentStatus, TournamentStatus[]> = {
      [TournamentStatus.DRAFT]: [TournamentStatus.REGISTRATION],
      [TournamentStatus.REGISTRATION]: [
        TournamentStatus.RUNNING,
        TournamentStatus.FINISHED,
      ],
      [TournamentStatus.RUNNING]: [TournamentStatus.FINISHED],
      [TournamentStatus.FINISHED]: [],
    };

    if (currentStatus === nextStatus) {
      return;
    }

    if (!allowedTransitions[currentStatus].includes(nextStatus)) {
      throw new BadRequestException(
        `Invalid tournament status transition: ${currentStatus} -> ${nextStatus}`,
      );
    }
  }

  private validateRegistrationWindow(openAt: Date, closeAt: Date) {
    if (openAt >= closeAt) {
      throw new BadRequestException(
        'registrationOpenAt must be earlier than registrationCloseAt',
      );
    }
  }

  private mapTournamentView(
    tournament: Tournament,
    defaults: TournamentDefaultsConfig,
  ): TournamentView {
    const now = Date.now();
    const openAt = tournament.registrationOpenAt.getTime();
    const closeAt = tournament.registrationCloseAt.getTime();

    const registrationHasStarted = now >= openAt;
    const registrationIsClosed = now > closeAt;
    const registrationIsOpen = registrationHasStarted && !registrationIsClosed;

    return {
      ...tournament,
      registrationHasStarted,
      registrationIsClosed,
      registrationIsOpen,
      hideTeamsUntilRegistrationClose: defaults.hideTeamsUntilRegistrationClose,
      defaultProjectTimeZone: defaults.defaultProjectTimeZone,
      canTeamRegister:
        tournament.status === TournamentStatus.REGISTRATION && registrationIsOpen,
    };
  }

  private mapTournamentJuryUser(user: TournamentJuryUserView) {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isBlocked: user.isBlocked,
    };
  }

  private async getTournamentDefaults() {
    return (
      (await this.systemIntegrationsService?.getTournamentDefaultsConfig()) ?? {
        minTeamMembers: 2,
        maxTeamMembers: 8,
        defaultMinReviewersPerSubmission: 2,
        defaultProjectTimeZone: 'Europe/Kyiv',
        hideTeamsUntilRegistrationClose: true,
        defaultTournamentMaxTeams: null,
        defaultRegistrationWindowHours: 24,
        defaultRoundDurationHours: 24,
        defaultTournamentDescription: '',
        defaultRoundDescription: '',
        source: 'default' as const,
      }
    );
  }

  private calculateCategoryAverages(scoresList: unknown[]): Required<ScoresPayload> {
    if (scoresList.length === 0) {
      return {
        technicalBackend: 0,
        technicalDatabase: 0,
        technicalFrontend: 0,
        mustHave: 0,
        stability: 0,
        usability: 0,
      };
    }

    const totals = scoresList.reduce<Required<ScoresPayload>>(
      (acc, rawScores) => {
        const scores = (rawScores ?? {}) as ScoresPayload;
        acc.technicalBackend += scores.technicalBackend ?? 0;
        acc.technicalDatabase += scores.technicalDatabase ?? 0;
        acc.technicalFrontend += scores.technicalFrontend ?? 0;
        acc.mustHave += scores.mustHave ?? 0;
        acc.stability += scores.stability ?? 0;
        acc.usability += scores.usability ?? 0;
        return acc;
      },
      {
        technicalBackend: 0,
        technicalDatabase: 0,
        technicalFrontend: 0,
        mustHave: 0,
        stability: 0,
        usability: 0,
      },
    );

    return {
      technicalBackend: this.round2(totals.technicalBackend / scoresList.length),
      technicalDatabase: this.round2(totals.technicalDatabase / scoresList.length),
      technicalFrontend: this.round2(totals.technicalFrontend / scoresList.length),
      mustHave: this.round2(totals.mustHave / scoresList.length),
      stability: this.round2(totals.stability / scoresList.length),
      usability: this.round2(totals.usability / scoresList.length),
    };
  }

  private round2(value: number) {
    return Number(value.toFixed(2));
  }
}
