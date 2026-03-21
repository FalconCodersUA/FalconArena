import { Injectable } from '@nestjs/common';
import { RoundStatus, SubmissionStatus, TournamentStatus } from '@prisma/client';
import { PrismaService } from './prisma/prisma.service';

type WeeklyBuckets = {
  labels: string[];
  keys: string[];
};

@Injectable()
export class DashboardMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminMetrics(tournamentId?: string) {
    const tournaments = await this.prisma.tournament.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
      },
    });

    const runningTournaments = tournaments.filter(
      (item) => item.status === TournamentStatus.RUNNING,
    ).length;
    const registrationTournaments = tournaments.filter(
      (item) => item.status === TournamentStatus.REGISTRATION,
    ).length;

    const targetTournament =
      tournaments.find((item) => item.id === tournamentId) ?? tournaments[0] ?? null;

    const rounds = targetTournament
      ? await this.prisma.round.findMany({
          where: { tournamentId: targetTournament.id },
          select: { id: true, status: true },
        })
      : [];

    const activeRounds = rounds.filter((item) => item.status === RoundStatus.ACTIVE).length;
    const closedRounds = rounds.filter(
      (item) => item.status === RoundStatus.SUBMISSION_CLOSED,
    ).length;
    const evaluatedRounds = rounds.filter(
      (item) => item.status === RoundStatus.EVALUATED,
    ).length;

    const buckets = this.buildLast7DayBuckets();
    const submissions = targetTournament
      ? await this.prisma.submission.findMany({
          where: {
            round: { tournamentId: targetTournament.id },
            OR: [
              { submittedAt: { not: null, gte: this.startDateForBuckets() } },
              { createdAt: { gte: this.startDateForBuckets() } },
            ],
          },
          select: {
            submittedAt: true,
            createdAt: true,
          },
        })
      : [];

    const evaluations = targetTournament
      ? await this.prisma.evaluation.findMany({
          where: {
            assignment: {
              round: {
                tournamentId: targetTournament.id,
              },
            },
            createdAt: { gte: this.startDateForBuckets() },
          },
          select: { createdAt: true },
        })
      : [];

    const weeklySubmissions = this.bucketDates(
      submissions.map((item) => item.submittedAt ?? item.createdAt),
      buckets,
    );
    const weeklyReviewed = this.bucketDates(
      evaluations.map((item) => item.createdAt),
      buckets,
    );

    const teams = targetTournament
      ? await this.prisma.team.findMany({
          where: { tournamentId: targetTournament.id },
          orderBy: { createdAt: 'asc' },
          take: 3,
          select: {
            id: true,
            name: true,
            organization: true,
          },
        })
      : [];

    const roundsTotal = activeRounds + closedRounds + evaluatedRounds;
    const pie = this.toShareMap(roundsTotal, {
      active: activeRounds,
      closed: closedRounds,
      evaluated: evaluatedRounds,
    });

    return {
      summary: {
        runningTournaments,
        registrationTournaments,
        tournamentsTotal: tournaments.length,
        roundsTotal: rounds.length,
        activeRounds,
        closedRounds,
        evaluatedRounds,
      },
      weekly: {
        labels: buckets.labels,
        reviewed: weeklyReviewed,
        submissions: weeklySubmissions,
      },
      pie: {
        ...pie,
        total: roundsTotal,
      },
      activeEntities: teams.map((item) => ({
        id: item.id,
        name: item.name,
        subtitle: item.organization ?? 'Registered team',
      })),
      activity: this.mergeActivityCurves(weeklyReviewed, weeklySubmissions),
    };
  }

  async getJuryMetrics(userId: string, tournamentId?: string, roundId?: string) {
    const assignmentWhere = {
      juryId: userId,
      ...(roundId
        ? { roundId }
        : tournamentId
          ? { round: { tournamentId } }
          : {}),
    };

    const assignments = await this.prisma.evaluationAssignment.findMany({
      where: assignmentWhere,
      orderBy: { assignedAt: 'desc' },
      include: {
        evaluation: {
          select: {
            id: true,
            totalScore: true,
            createdAt: true,
          },
        },
        submission: {
          select: {
            id: true,
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const evaluated = assignments.filter((item) => item.evaluation !== null);
    const pendingAssignments = assignments.length - evaluated.length;
    const averageScore =
      evaluated.length > 0
        ? Math.round(
            (evaluated.reduce((acc, item) => acc + (item.evaluation?.totalScore ?? 0), 0) /
              evaluated.length) *
              100,
          ) / 100
        : 0;

    const buckets = this.buildLast7DayBuckets();
    const weeklyAssigned = this.bucketDates(
      assignments.map((item) => item.assignedAt),
      buckets,
    );
    const weeklyReviewed = this.bucketDates(
      evaluated.map((item) => item.evaluation?.createdAt).filter((item): item is Date => !!item),
      buckets,
    );

    const pie = this.toShareMap(assignments.length, {
      pending: pendingAssignments,
      evaluated: evaluated.length,
    });

    const teamsMap = new Map<string, { id: string; name: string; subtitle: string }>();
    for (const assignment of assignments) {
      const team = assignment.submission.team;
      if (!teamsMap.has(team.id) && teamsMap.size < 3) {
        teamsMap.set(team.id, {
          id: team.id,
          name: team.name,
          subtitle: assignment.evaluation ? 'Evaluated' : 'Pending evaluation',
        });
      }
    }

    return {
      summary: {
        total: assignments.length,
        pending: pendingAssignments,
        evaluated: evaluated.length,
        currentScore: averageScore,
      },
      weekly: {
        labels: buckets.labels,
        reviewed: weeklyReviewed,
        assigned: weeklyAssigned,
      },
      pie: {
        ...pie,
        total: assignments.length,
      },
      activeEntities: [...teamsMap.values()],
      activity: this.mergeActivityCurves(weeklyReviewed, weeklyAssigned),
    };
  }

  async getTeamMetrics(userId: string, tournamentId?: string) {
    const teams = await this.prisma.team.findMany({
      where: { captainId: userId },
      include: {
        tournament: {
          select: {
            id: true,
            title: true,
            status: true,
            registrationOpenAt: true,
            registrationCloseAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = Date.now();
    const runningTournaments = teams.filter(
      (item) => item.tournament.status === TournamentStatus.RUNNING,
    ).length;
    const registrationOpen = teams.filter((item) => {
      const tournament = item.tournament;
      return (
        tournament.status === TournamentStatus.REGISTRATION &&
        now >= tournament.registrationOpenAt.getTime() &&
        now <= tournament.registrationCloseAt.getTime()
      );
    }).length;

    const selectedTeam =
      teams.find((item) => item.tournamentId === tournamentId) ?? teams[0] ?? null;

    if (!selectedTeam) {
      const emptyBuckets = this.buildLast7DayBuckets();
      return {
        summary: {
          runningTournaments,
          registrationOpen,
          totalSubmissions: 0,
        },
        weekly: {
          labels: emptyBuckets.labels,
          reviewed: new Array(7).fill(0),
          submissions: new Array(7).fill(0),
        },
        pie: {
          submitted: 0,
          draft: 0,
          locked: 0,
          total: 0,
        },
        activeEntities: [],
        activity: new Array(7).fill(0),
      };
    }

    const rounds = await this.prisma.round.findMany({
      where: { tournamentId: selectedTeam.tournamentId },
      select: { id: true, status: true },
    });
    const roundIds = rounds.map((item) => item.id);

    const submissions = roundIds.length
      ? await this.prisma.submission.findMany({
          where: {
            roundId: { in: roundIds },
            teamId: selectedTeam.id,
          },
          select: {
            id: true,
            status: true,
            submittedAt: true,
            createdAt: true,
          },
        })
      : [];

    const submissionIds = submissions.map((item) => item.id);
    const evaluations = submissionIds.length
      ? await this.prisma.evaluation.findMany({
          where: {
            assignment: {
              submissionId: {
                in: submissionIds,
              },
            },
          },
          select: {
            createdAt: true,
          },
        })
      : [];

    const buckets = this.buildLast7DayBuckets();
    const weeklySubmissions = this.bucketDates(
      submissions.map((item) => item.submittedAt ?? item.createdAt),
      buckets,
    );
    const weeklyReviewed = this.bucketDates(
      evaluations.map((item) => item.createdAt),
      buckets,
    );

    const draftCount = submissions.filter(
      (item) => item.status === SubmissionStatus.DRAFT,
    ).length;
    const submittedCount = submissions.filter(
      (item) => item.status === SubmissionStatus.SUBMITTED,
    ).length;
    const lockedCount = submissions.filter(
      (item) => item.status === SubmissionStatus.LOCKED,
    ).length;
    const pie = this.toShareMap(submissions.length, {
      submitted: submittedCount,
      draft: draftCount,
      locked: lockedCount,
    });

    const teamDetails = await this.prisma.team.findUnique({
      where: { id: selectedTeam.id },
      include: {
        captain: {
          select: { id: true, fullName: true },
        },
        members: {
          orderBy: { createdAt: 'asc' },
          take: 2,
          select: { id: true, fullName: true },
        },
      },
    });

    const activeEntities = teamDetails
      ? [
          {
            id: teamDetails.captain.id,
            name: teamDetails.captain.fullName,
            subtitle: 'Captain',
          },
          ...teamDetails.members.map((member) => ({
            id: member.id,
            name: member.fullName,
            subtitle: 'Member',
          })),
        ]
      : [];

    return {
      summary: {
        runningTournaments,
        registrationOpen,
        totalSubmissions: submissions.length,
      },
      weekly: {
        labels: buckets.labels,
        reviewed: weeklyReviewed,
        submissions: weeklySubmissions,
      },
      pie: {
        ...pie,
        total: submissions.length,
      },
      activeEntities,
      activity: this.mergeActivityCurves(weeklyReviewed, weeklySubmissions),
    };
  }

  private startDateForBuckets() {
    const now = new Date();
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    start.setUTCDate(start.getUTCDate() - 6);
    return start;
  }

  private buildLast7DayBuckets(): WeeklyBuckets {
    const start = this.startDateForBuckets();
    const labels: string[] = [];
    const keys: string[] = [];

    for (let i = 0; i < 7; i += 1) {
      const current = new Date(start);
      current.setUTCDate(start.getUTCDate() + i);
      labels.push(
        current.toLocaleDateString('en-US', {
          weekday: 'short',
          timeZone: 'UTC',
        }),
      );
      keys.push(current.toISOString().slice(0, 10));
    }

    return {
      labels,
      keys,
    };
  }

  private bucketDates(values: Date[], buckets: WeeklyBuckets) {
    const counts = new Array(7).fill(0);
    const indexByKey = new Map<string, number>(
      buckets.keys.map((key, index) => [key, index]),
    );

    for (const value of values) {
      const key = value.toISOString().slice(0, 10);
      const index = indexByKey.get(key);
      if (index !== undefined) {
        counts[index] += 1;
      }
    }

    return counts;
  }

  private mergeActivityCurves(primary: number[], secondary: number[]) {
    return primary.map((value, index) => value * 2 + (secondary[index] ?? 0));
  }

  private toShareMap(total: number, source: Record<string, number>) {
    if (total <= 0) {
      return Object.fromEntries(
        Object.keys(source).map((key) => [key, 0]),
      ) as Record<string, number>;
    }

    return Object.fromEntries(
      Object.entries(source).map(([key, value]) => [
        key,
        Math.round((value / total) * 100),
      ]),
    ) as Record<string, number>;
  }
}

