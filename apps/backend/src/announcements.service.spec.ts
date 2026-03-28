import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AnnouncementAudience } from '@prisma/client';
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
        isActive: true,
        audience: { in: [AnnouncementAudience.ALL, AnnouncementAudience.TEAM] },
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
});
