import { describe, expect, it, vi } from 'vitest';
import { AuditLogsService } from './audit-logs.service';

describe('AuditLogsService', () => {
  it('lists recent system activity with actor metadata', async () => {
    const prisma = {
      auditLog: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'log-1',
            actorId: 'user-1',
            actorRole: 'ADMIN',
            action: 'tournament.created',
            entityType: 'tournament',
            entityId: 'tournament-1',
            entityLabel: 'Falcon Cup',
            tournamentId: 'tournament-1',
            title: 'Tournament created',
            description: 'Falcon Cup was created.',
            metadata: null,
            createdAt: new Date('2026-03-31T10:00:00.000Z'),
            actor: {
              id: 'user-1',
              email: 'admin@example.com',
              fullName: 'Admin User',
            },
          },
        ]),
      },
    };

    const service = new AuditLogsService(prisma as never);
    const items = await service.listRecentSystemActivity(5, 'tournament-1');

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tournamentId: 'tournament-1' },
        take: 5,
      }),
    );
    expect(items[0]).toMatchObject({
      actorName: 'Admin User',
      action: 'tournament.created',
      title: 'Tournament created',
    });
  });
});
