import { describe, expect, it, vi } from 'vitest';
import { TournamentCertificatesService } from './tournament-certificates.service';

function createPrismaMock() {
  return {
    tournament: {
      findUnique: vi.fn(),
    },
    certificateTemplate: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    team: {
      findFirst: vi.fn(),
    },
  };
}

describe('TournamentCertificatesService', () => {
  it('returns default template when tournament-specific template is absent', async () => {
    const prisma = createPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({
      id: 't-1',
      title: 'Falcon Arena Spring',
    });
    prisma.certificateTemplate.findUnique.mockResolvedValue(null);

    const service = new TournamentCertificatesService(prisma as never, undefined);

    const result = await service.getTemplate('t-1');

    expect(result).toEqual(
      expect.objectContaining({
        tournamentId: 't-1',
        isDefault: true,
        title: 'Сертифікат',
        accentColor: '#5E17EB',
      }),
    );
  });

  it('builds winner certificate payload for first ranked team', async () => {
    const prisma = createPrismaMock();
    prisma.tournament.findUnique.mockResolvedValueOnce({
      id: 't-1',
      title: 'Falcon Arena Spring',
      status: 'FINISHED',
      startsAt: null,
    });
    prisma.team.findFirst.mockResolvedValue({
      id: 'team-1',
      name: 'Falcon Coders',
      captain: {
        id: 'u-1',
        fullName: 'Captain One',
        email: 'captain@example.com',
      },
      members: [
        {
          id: 'u-2',
          fullName: 'Member Two',
          email: 'member@example.com',
        },
      ],
    });

    const service = new TournamentCertificatesService(prisma as never, {
      getTournamentLeaderboard: vi.fn().mockResolvedValue({
        rows: [
          {
            teamId: 'team-1',
            rank: 1,
            totalScore: 287.4,
            averageScore: 95.8,
          },
        ],
      }),
    } as never);

    vi.spyOn(service, 'getTemplate').mockResolvedValue({
      id: 'tpl-1',
      tournamentId: 't-1',
      isDefault: false,
      name: 'Основний шаблон',
      title: '{{kindLabel}}',
      subtitle: 'Для {{teamName}}',
      body: '{{teamName}} перемогла у {{tournamentTitle}}.',
      footer: 'Дата видачі: {{issuedAt}}',
      signerName: 'Оргкомітет',
      signerRole: 'FalconArena',
      accentColor: '#5E17EB',
    });

    const result = await service.getTeamCertificate('t-1', 'team-1', 'winner');

    expect(result.certificate.kind).toBe('winner');
    expect(result.certificate.template.title).toBe('Сертифікат переможця');
    expect(result.certificate.template.subtitle).toBe('Для Falcon Coders');
    expect(result.team.members).toHaveLength(2);
    expect(result.result.rank).toBe(1);
  });
});
