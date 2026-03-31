import { NotFoundException } from '@nestjs/common';
import { TournamentStatus } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

function createSystemIntegrationsServiceMock() {
  return {
    getGoogleSheetsConfig: vi.fn(),
    persistGoogleSheetsExportResult: vi.fn().mockResolvedValue(undefined),
  };
}

describe('LeaderboardService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds sorted leaderboard rows with computed totals and categories', async () => {
    const prisma = createPrismaMock();
    const systemIntegrationsService = createSystemIntegrationsServiceMock();
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

    const service = new LeaderboardService(
      prisma as never,
      systemIntegrationsService as never,
    );
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
    const systemIntegrationsService = createSystemIntegrationsServiceMock();
    prisma.tournament.findUnique.mockResolvedValue(null);

    const service = new LeaderboardService(
      prisma as never,
      systemIntegrationsService as never,
    );

    await expect(
      service.getTournamentLeaderboard('missing-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('exports leaderboard rows as csv', async () => {
    const prisma = createPrismaMock();
    const systemIntegrationsService = createSystemIntegrationsServiceMock();
    prisma.tournament.findUnique.mockResolvedValue({
      id: 'tournament-1',
      title: 'Falcon Arena',
      status: TournamentStatus.FINISHED,
    });
    prisma.team.findMany.mockResolvedValue([
      { id: 'team-a', name: 'Alpha', organization: 'School A' },
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
    ]);

    const service = new LeaderboardService(
      prisma as never,
      systemIntegrationsService as never,
    );
    const csv = await service.exportTournamentLeaderboardCsv('tournament-1');

    expect(csv).toContain(
      'rank,teamName,organization,totalScore,averageScore,evaluationsCount',
    );
    expect(csv).toContain('1,Alpha,School A,90,90,1,92,88,90,94,89,87');
    expect(csv).toContain('Round 1: avg=90, evaluations=1');
  });

  it('exports leaderboard payload to Google Sheets webhook', async () => {
    const prisma = createPrismaMock();
    const systemIntegrationsService = createSystemIntegrationsServiceMock();
    systemIntegrationsService.getGoogleSheetsConfig.mockResolvedValue({
      webhookUrl: 'https://example.com/google-sheets-webhook',
      secret: 'secret-token',
      defaultSheetName: 'Falcon Export',
      source: 'database',
    });
    prisma.tournament.findUnique.mockResolvedValue({
      id: 'tournament-1',
      title: 'Falcon Arena',
      status: TournamentStatus.FINISHED,
    });
    prisma.team.findMany.mockResolvedValue([
      { id: 'team-a', name: 'Alpha', organization: 'School A' },
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
    ]);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: vi.fn().mockReturnValue('application/json'),
      },
      json: vi.fn().mockResolvedValue({
        ok: true,
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/123',
      }),
      text: vi.fn(),
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new LeaderboardService(
      prisma as never,
      systemIntegrationsService as never,
    );
    const result = await service.exportTournamentLeaderboardToGoogleSheets(
      'tournament-1',
      {
        exportedBy: {
          userId: 'admin-1',
          email: 'admin@example.com',
          role: 'ADMIN',
        },
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/google-sheets-webhook',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-falconarena-export-secret': 'secret-token',
        }),
      }),
    );

    const [, requestInit] = fetchMock.mock.calls[0] as [string, { body: string }];
    const payload = JSON.parse(requestInit.body);
    expect(payload.sheetName).toBe('Falcon Export');
    expect(payload.configSource).toBe('database');
    expect(payload.rowObjects[0]).toMatchObject({
      rank: 1,
      teamName: 'Alpha',
      totalScore: 90,
    });
    expect(result).toEqual({
      ok: true,
      destination: 'google-sheets',
      sheetName: 'Falcon Export',
      rowsExported: 1,
      response: {
        ok: true,
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/123',
      },
    });
  });
});
