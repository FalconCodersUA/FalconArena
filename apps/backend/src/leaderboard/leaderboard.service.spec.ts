import { NotFoundException } from '@nestjs/common';
import { TournamentStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { LeaderboardService } from './leaderboard.service';

function createPrismaMock() {
  return {
    tournament: {
      findUnique: vi.fn(),
    },
    team: {
      findMany: vi.fn(),
    },
    evaluation: {
      findMany: vi.fn(),
    },
  };
}

describe('LeaderboardService', () => {
  it('builds sorted leaderboard rows with computed totals and categories', async () => {
    const prisma = createPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({
      id: 'tournament-1',
      title: 'Falcon Arena',
      status: TournamentStatus.FINISHED,
    });

    prisma.team.findMany.mockResolvedValue([
      { id: 'team-a', name: 'Alpha', organization: 'School A' },
      { id: 'team-b', name: 'Beta', organization: null },
    ]);

    prisma.evaluation.findMany.mockResolvedValue([
      {
        totalScore: 90,
        scores: {
          technicalBackend: 92,
          technicalDatabase: 88,
          technicalFrontend: 90,
          mustHave: 94,
          stability: 89,
          usability: 87,
        },
        assignment: {
          roundId: 'round-1',
          round: { title: 'Round 1' },
          submission: { teamId: 'team-a' },
        },
      },
      {
        totalScore: 88,
        scores: {
          technicalBackend: 90,
          technicalDatabase: 85,
          technicalFrontend: 86,
          mustHave: 91,
          stability: 88,
          usability: 89,
        },
        assignment: {
          roundId: 'round-2',
          round: { title: 'Round 2' },
          submission: { teamId: 'team-a' },
        },
      },
      {
        totalScore: 95,
        scores: {
          technicalBackend: 95,
          technicalDatabase: 96,
          technicalFrontend: 94,
          mustHave: 95,
          stability: 95,
          usability: 95,
        },
        assignment: {
          roundId: 'round-1',
          round: { title: 'Round 1' },
          submission: { teamId: 'team-b' },
        },
      },
    ]);

    const service = new LeaderboardService(prisma as never);
    const result = await service.getTournamentLeaderboard('tournament-1');

    expect(result.tournament.id).toBe('tournament-1');
    expect(result.rows).toHaveLength(2);

    expect(result.rows[0].teamName).toBe('Alpha');
    expect(result.rows[0].rank).toBe(1);
    expect(result.rows[0].totalScore).toBe(178);
    expect(result.rows[0].averageScore).toBe(89);
    expect(result.rows[0].categoryAverages.technicalBackend).toBe(91);

    expect(result.rows[1].teamName).toBe('Beta');
    expect(result.rows[1].rank).toBe(2);
    expect(result.rows[1].totalScore).toBe(95);
  });

  it('throws not found for missing tournament', async () => {
    const prisma = createPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue(null);
    const service = new LeaderboardService(prisma as never);

    await expect(
      service.getTournamentLeaderboard('missing-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
