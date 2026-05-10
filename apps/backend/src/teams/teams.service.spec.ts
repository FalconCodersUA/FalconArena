import { TournamentStatus } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamsService } from './teams.service';

function createPrismaMock() {
  return {
    tournament: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    team: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  };
}

function createSystemIntegrationsServiceMock(hideTeamsUntilRegistrationClose = true) {
  return {
    getTournamentDefaultsConfig: vi.fn().mockResolvedValue({
      minTeamMembers: 2,
      maxTeamMembers: 8,
      defaultMinReviewersPerSubmission: 2,
      defaultProjectTimeZone: 'Europe/Kyiv',
      hideTeamsUntilRegistrationClose,
      defaultTournamentMaxTeams: null,
      defaultRegistrationWindowHours: 24,
      defaultRoundDurationHours: 24,
      defaultTournamentDescription: '',
      defaultRoundDescription: '',
      source: 'default',
    }),
  };
}

describe('TeamsService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-14T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists visible teams across tournaments with tournament metadata', async () => {
    const prisma = createPrismaMock();
    const systemIntegrationsService = createSystemIntegrationsServiceMock(true);

    prisma.tournament.findMany.mockResolvedValue([
      { id: 't-running' },
      { id: 't-finished' },
    ]);
    prisma.team.findMany.mockResolvedValue([
      {
        id: 'team-1',
        name: 'Falcons',
        organization: 'Falcon School',
        createdAt: new Date('2026-04-12T10:00:00.000Z'),
        tournament: {
          id: 't-running',
          title: 'Spring Cup',
          status: TournamentStatus.RUNNING,
          createdAt: new Date('2026-04-10T10:00:00.000Z'),
        },
        _count: { members: 3 },
      },
      {
        id: 'team-2',
        name: 'Owls',
        organization: null,
        createdAt: new Date('2026-04-13T10:00:00.000Z'),
        tournament: {
          id: 't-finished',
          title: 'Final Cup',
          status: TournamentStatus.FINISHED,
          createdAt: new Date('2026-04-11T10:00:00.000Z'),
        },
        _count: { members: 2 },
      },
    ]);

    const service = new TeamsService(
      prisma as never,
      systemIntegrationsService as never,
    );
    const result = await service.listAllVisible();

    expect(prisma.tournament.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { status: { in: [TournamentStatus.RUNNING, TournamentStatus.FINISHED] } },
          { registrationCloseAt: { lt: new Date('2026-04-14T10:00:00.000Z') } },
        ],
      },
      select: { id: true },
    });
    expect(prisma.team.findMany).toHaveBeenCalledWith({
      where: {
        tournamentId: { in: ['t-running', 't-finished'] },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        tournament: {
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
          },
        },
        _count: {
          select: { members: true },
        },
      },
    });
    expect(result).toEqual([
      {
        id: 'team-2',
        tournamentId: 't-finished',
        tournamentTitle: 'Final Cup',
        tournamentStatus: TournamentStatus.FINISHED,
        name: 'Owls',
        organization: null,
        createdAt: new Date('2026-04-13T10:00:00.000Z'),
        membersCount: 2,
      },
      {
        id: 'team-1',
        tournamentId: 't-running',
        tournamentTitle: 'Spring Cup',
        tournamentStatus: TournamentStatus.RUNNING,
        name: 'Falcons',
        organization: 'Falcon School',
        createdAt: new Date('2026-04-12T10:00:00.000Z'),
        membersCount: 3,
      },
    ]);
  });

  it('does not apply tournament visibility filtering when team hiding is disabled', async () => {
    const prisma = createPrismaMock();
    const systemIntegrationsService = createSystemIntegrationsServiceMock(false);
    prisma.team.findMany.mockResolvedValue([]);

    const service = new TeamsService(
      prisma as never,
      systemIntegrationsService as never,
    );

    await service.listAllVisible();

    expect(prisma.tournament.findMany).not.toHaveBeenCalled();
    expect(prisma.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      }),
    );
  });
});
