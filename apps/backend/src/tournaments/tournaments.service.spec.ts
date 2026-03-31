import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TournamentStatus } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TournamentsService } from './tournaments.service';

function createPrismaMock() {
  return {
    tournament: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    team: {
      findMany: vi.fn(),
    },
    round: {
      findMany: vi.fn(),
    },
  };
}

function createSystemIntegrationsServiceMock() {
  return {
    getTournamentDefaultsConfig: vi.fn().mockResolvedValue({
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
      source: 'default',
    }),
  };
}

describe('TournamentsService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('computes team registration availability in list()', async () => {
    const prisma = createPrismaMock();
    prisma.tournament.findMany.mockResolvedValue([
      {
        id: 't-open',
        title: 'Open Tournament',
        description: null,
        startsAt: null,
        registrationOpenAt: new Date('2026-03-15T10:00:00.000Z'),
        registrationCloseAt: new Date('2026-03-15T14:00:00.000Z'),
        maxTeams: null,
        status: TournamentStatus.REGISTRATION,
        createdById: 'admin-1',
        createdAt: new Date('2026-03-10T10:00:00.000Z'),
        updatedAt: new Date('2026-03-10T10:00:00.000Z'),
      },
      {
        id: 't-running',
        title: 'Running Tournament',
        description: null,
        startsAt: null,
        registrationOpenAt: new Date('2026-03-14T10:00:00.000Z'),
        registrationCloseAt: new Date('2026-03-16T14:00:00.000Z'),
        maxTeams: null,
        status: TournamentStatus.RUNNING,
        createdById: 'admin-2',
        createdAt: new Date('2026-03-11T10:00:00.000Z'),
        updatedAt: new Date('2026-03-11T10:00:00.000Z'),
      },
      {
        id: 't-closed',
        title: 'Closed Tournament',
        description: null,
        startsAt: null,
        registrationOpenAt: new Date('2026-03-10T10:00:00.000Z'),
        registrationCloseAt: new Date('2026-03-14T14:00:00.000Z'),
        maxTeams: null,
        status: TournamentStatus.REGISTRATION,
        createdById: 'admin-3',
        createdAt: new Date('2026-03-09T10:00:00.000Z'),
        updatedAt: new Date('2026-03-09T10:00:00.000Z'),
      },
    ]);

    const service = new TournamentsService(
      prisma as never,
      undefined,
      undefined,
      undefined,
      createSystemIntegrationsServiceMock() as never,
      undefined,
    );
    const items = await service.list({});

    expect(items).toHaveLength(3);
    expect(items[0].registrationIsOpen).toBe(true);
    expect(items[0].canTeamRegister).toBe(true);
    expect(items[0].hideTeamsUntilRegistrationClose).toBe(true);
    expect(items[1].registrationIsOpen).toBe(true);
    expect(items[1].canTeamRegister).toBe(false);
    expect(items[2].registrationIsClosed).toBe(true);
    expect(items[2].canTeamRegister).toBe(false);
  });

  it('rejects invalid tournament status transition', async () => {
    const prisma = createPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({
      id: 't-1',
      title: 'Tournament',
      description: null,
      startsAt: null,
      registrationOpenAt: new Date('2026-03-10T10:00:00.000Z'),
      registrationCloseAt: new Date('2026-03-20T14:00:00.000Z'),
      maxTeams: null,
      status: TournamentStatus.DRAFT,
      createdById: 'admin-1',
      createdAt: new Date('2026-03-09T10:00:00.000Z'),
      updatedAt: new Date('2026-03-09T10:00:00.000Z'),
    });

    const service = new TournamentsService(
      prisma as never,
      undefined,
      undefined,
      undefined,
      createSystemIntegrationsServiceMock() as never,
      undefined,
    );

    await expect(
      service.updateStatus('t-1', TournamentStatus.RUNNING, {
        userId: 'admin-1',
        role: 'ADMIN',
        email: 'admin@example.com',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.tournament.update).not.toHaveBeenCalled();
  });

  it('throws not found for missing tournament', async () => {
    const prisma = createPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue(null);
    const service = new TournamentsService(
      prisma as never,
      undefined,
      undefined,
      undefined,
      createSystemIntegrationsServiceMock() as never,
      undefined,
    );

    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('builds archive payload for finished tournament', async () => {
    const prisma = createPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({
      id: 't-finished',
      title: 'Finished Tournament',
      description: 'Archive ready',
      startsAt: new Date('2026-03-10T10:00:00.000Z'),
      registrationOpenAt: new Date('2026-03-01T10:00:00.000Z'),
      registrationCloseAt: new Date('2026-03-05T10:00:00.000Z'),
      maxTeams: null,
      status: TournamentStatus.FINISHED,
      createdById: 'admin-1',
      createdAt: new Date('2026-03-01T09:00:00.000Z'),
      updatedAt: new Date('2026-03-20T09:00:00.000Z'),
    });
    prisma.team.findMany.mockResolvedValue([
      {
        id: 'team-1',
        name: 'Falcons',
        organization: 'Kyiv',
        _count: {
          members: 3,
          submissions: 1,
        },
      },
    ]);
    prisma.round.findMany.mockResolvedValue([
      {
        id: 'round-1',
        sequence: 1,
        title: 'Round 1',
        description: 'Initial round',
        status: 'EVALUATED',
        startsAt: new Date('2026-03-11T10:00:00.000Z'),
        deadlineAt: new Date('2026-03-12T10:00:00.000Z'),
        submissions: [
          {
            id: 'submission-1',
            repoUrl: 'https://github.com/example/repo',
            demoUrl: 'https://youtu.be/demo',
            liveDemoUrl: 'https://demo.example.com',
            shortSummary: 'Done',
            status: 'LOCKED',
            submittedAt: new Date('2026-03-12T09:00:00.000Z'),
            team: {
              id: 'team-1',
              name: 'Falcons',
              organization: 'Kyiv',
            },
            assignments: [
              {
                evaluation: {
                  totalScore: 88,
                  scores: {
                    technicalBackend: 90,
                    technicalDatabase: 80,
                    technicalFrontend: 85,
                    mustHave: 90,
                    stability: 92,
                    usability: 91,
                  },
                },
              },
              {
                evaluation: {
                  totalScore: 92,
                  scores: {
                    technicalBackend: 94,
                    technicalDatabase: 86,
                    technicalFrontend: 90,
                    mustHave: 95,
                    stability: 91,
                    usability: 96,
                  },
                },
              },
            ],
          },
        ],
      },
    ]);

    const leaderboardService = {
      getTournamentLeaderboard: vi.fn().mockResolvedValue({
        tournament: {
          id: 't-finished',
          title: 'Finished Tournament',
          status: TournamentStatus.FINISHED,
        },
        scoring: {
          scale: '0-100',
          totalFormula: 'sum(roundAverageScore)',
          roundFormula: 'average(juryEvaluationTotals)',
          evaluationFormula: 'average(6 category scores)',
        },
        rows: [
          {
            rank: 1,
            teamId: 'team-1',
            teamName: 'Falcons',
            organization: 'Kyiv',
            totalScore: 90,
            averageScore: 90,
            evaluationsCount: 2,
            categoryAverages: {
              technicalBackend: 92,
              technicalDatabase: 83,
              technicalFrontend: 87.5,
              mustHave: 92.5,
              stability: 91.5,
              usability: 93.5,
            },
            rounds: [],
          },
        ],
      }),
    };

    const service = new TournamentsService(
      prisma as never,
      leaderboardService as never,
      undefined,
      undefined,
      createSystemIntegrationsServiceMock() as never,
      undefined,
    );

    const archive = await service.getArchive('t-finished');

    expect(leaderboardService.getTournamentLeaderboard).toHaveBeenCalledWith('t-finished');
    expect(archive.summary.teamsCount).toBe(1);
    expect(archive.summary.submissionsCount).toBe(1);
    expect(archive.teams[0].rank).toBe(1);
    expect(archive.rounds[0].submissions[0].averageScore).toBe(90);
  });

  it('queues registration-started notification when tournament moves to registration', async () => {
    const prisma = createPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({
      id: 't-1',
      title: 'Falcon Cup',
      description: null,
      startsAt: null,
      registrationOpenAt: new Date('2026-03-10T10:00:00.000Z'),
      registrationCloseAt: new Date('2026-03-20T14:00:00.000Z'),
      maxTeams: null,
      status: TournamentStatus.DRAFT,
      createdById: 'admin-1',
      createdAt: new Date('2026-03-09T10:00:00.000Z'),
      updatedAt: new Date('2026-03-09T10:00:00.000Z'),
    });
    prisma.tournament.update.mockResolvedValue({
      id: 't-1',
      title: 'Falcon Cup',
      description: null,
      startsAt: null,
      registrationOpenAt: new Date('2026-03-10T10:00:00.000Z'),
      registrationCloseAt: new Date('2026-03-20T14:00:00.000Z'),
      maxTeams: null,
      status: TournamentStatus.REGISTRATION,
      createdById: 'admin-1',
      createdAt: new Date('2026-03-09T10:00:00.000Z'),
      updatedAt: new Date('2026-03-09T10:00:00.000Z'),
    });
    const jobsService = {
      scheduleRegistrationStartedNotification: vi.fn().mockResolvedValue({ id: 'job-1' }),
    };

    const service = new TournamentsService(
      prisma as never,
      undefined,
      undefined,
      jobsService as never,
      createSystemIntegrationsServiceMock() as never,
      { record: vi.fn().mockResolvedValue(undefined) } as never,
    );

    const result = await service.updateStatus('t-1', TournamentStatus.REGISTRATION, {
      userId: 'admin-1',
      role: 'ADMIN',
      email: 'admin@example.com',
    });

    expect(jobsService.scheduleRegistrationStartedNotification).toHaveBeenCalledWith({
      tournamentId: 't-1',
      tournamentTitle: 'Falcon Cup',
    });
    expect(result.status).toBe(TournamentStatus.REGISTRATION);
  });
});
