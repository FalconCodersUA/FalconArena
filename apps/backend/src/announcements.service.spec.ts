import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AnnouncementAudience, AnnouncementVisibility } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AnnouncementsService } from './announcements.service';

function createPrismaMock() {
  return {
    announcement: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    tournament: {
      findUnique: vi.fn(),
    },
    userSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  };
}

describe('AnnouncementsService', () => {
  it('filters TEAM audience to ALL and TEAM active announcements', async () => {
    const prisma = createPrismaMock();
    prisma.announcement.findMany.mockResolvedValue([]);
    prisma.userSettings.findUnique.mockResolvedValue(null);
    const service = new AnnouncementsService(prisma as never);

    await service.listForRole('TEAM', 'user-1');

    expect(prisma.announcement.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            isActive: true,
            visibility: AnnouncementVisibility.AUTHENTICATED,
            audience: { in: [AnnouncementAudience.ALL, AnnouncementAudience.TEAM] },
          },
          {
            OR: [
              { tournamentId: null },
              { tournament: { teams: { some: { captainId: 'user-1' } } } },
            ],
          },
        ],
      },
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
    });
  });

  it('marks announcements as read via user settings upsert', async () => {
    const prisma = createPrismaMock();
    prisma.userSettings.upsert.mockResolvedValue({});
    const service = new AnnouncementsService(prisma as never);

    await service.markRead('user-1', '2026-03-28T10:00:00.000Z');

    expect(prisma.userSettings.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      update: { lastAnnouncementsReadAt: new Date('2026-03-28T10:00:00.000Z') },
      create: {
        user: { connect: { id: 'user-1' } },
        lastAnnouncementsReadAt: new Date('2026-03-28T10:00:00.000Z'),
      },
    });
  });

  it('creates announcement with normalized fields and defaults', async () => {
    const prisma = createPrismaMock();
    prisma.announcement.create.mockResolvedValue({
      id: 'ann-1',
    });
    const service = new AnnouncementsService(prisma as never);

    await service.create(
      {
        title: '  New title  ',
        body: '  New body for announcement  ',
      },
      'admin-1',
    );

    expect(prisma.announcement.create).toHaveBeenCalledWith({
      data: {
        title: 'New title',
        body: 'New body for announcement',
        audience: AnnouncementAudience.ALL,
        visibility: AnnouncementVisibility.AUTHENTICATED,
        tournamentId: null,
        linkUrl: null,
        isPinned: false,
        isActive: true,
        createdById: 'admin-1',
      },
    });
  });

  it('throws NotFoundException when updating unknown announcement', async () => {
    const prisma = createPrismaMock();
    prisma.announcement.findUnique.mockResolvedValue(null);
    const service = new AnnouncementsService(prisma as never);

    await expect(
      service.update('missing-id', { title: 'Updated title' }, 'admin-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws BadRequestException when no update fields were provided', async () => {
    const prisma = createPrismaMock();
    prisma.announcement.findUnique.mockResolvedValue({ id: 'ann-1' });
    const service = new AnnouncementsService(prisma as never);

    await expect(service.update('ann-1', {}, 'admin-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('lists only public active announcements for tournament page', async () => {
    const prisma = createPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({ id: 't-1' });
    prisma.announcement.findMany.mockResolvedValue([]);
    const service = new AnnouncementsService(prisma as never);

    await service.listPublicForTournament('t-1');

    expect(prisma.announcement.findMany).toHaveBeenCalledWith({
      where: {
        tournamentId: 't-1',
        visibility: AnnouncementVisibility.PUBLIC,
        isActive: true,
      },
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
    });
  });

  it('rejects public announcements without tournament scope', async () => {
    const prisma = createPrismaMock();
    const service = new AnnouncementsService(prisma as never);

    await expect(
      service.create(
        {
          title: 'Public update',
          body: 'Public update for everyone.',
          visibility: 'PUBLIC',
        },
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects public announcements with role-specific audience', async () => {
    const prisma = createPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({ id: 't-1' });
    const service = new AnnouncementsService(prisma as never);

    await expect(
      service.create(
        {
          title: 'Public jury update',
          body: 'Public update should not target only jury.',
          audience: 'JURY',
          visibility: 'PUBLIC',
          tournamentId: 't-1',
        },
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
