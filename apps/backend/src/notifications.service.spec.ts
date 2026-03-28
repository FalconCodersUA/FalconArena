import { describe, expect, it, vi } from 'vitest';
import { NotificationsService } from './notifications.service';

function createPrismaMock() {
  return {
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    notificationReadState: {
      createMany: vi.fn(),
    },
  };
}

describe('NotificationsService', () => {
  it('lists notifications visible to TEAM role and maps unread state', async () => {
    const prisma = createPrismaMock();
    prisma.notification.findMany.mockResolvedValue([
      {
        id: 'notification-1',
        type: 'ROUND_STARTED',
        title: 'Round started',
        body: 'The active round is already available.',
        linkUrl: '/app/tournaments/t-1',
        createdAt: new Date('2026-03-28T10:00:00.000Z'),
        readStates: [],
      },
      {
        id: 'notification-2',
        type: 'GENERAL',
        title: 'General update',
        body: 'Check your dashboard.',
        linkUrl: null,
        createdAt: new Date('2026-03-28T09:00:00.000Z'),
        readStates: [{ readAt: new Date('2026-03-28T09:30:00.000Z') }],
      },
    ]);
    const service = new NotificationsService(prisma as never);

    const result = await service.listForUser('user-1', 'TEAM');

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { audience: 'ALL' },
          { audience: 'TEAM' },
          {
            audience: 'USER',
            userId: 'user-1',
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: {
        readStates: {
          where: { userId: 'user-1' },
          select: { readAt: true },
          take: 1,
        },
      },
    });
    expect(result).toEqual([
      expect.objectContaining({ id: 'notification-1', isUnread: true }),
      expect.objectContaining({ id: 'notification-2', isUnread: false }),
    ]);
  });

  it('marks provided notification ids as read', async () => {
    const prisma = createPrismaMock();
    prisma.notificationReadState.createMany.mockResolvedValue({ count: 2 });
    const service = new NotificationsService(prisma as never);

    const result = await service.markAsRead('user-1', ['notification-1', 'notification-2']);

    expect(prisma.notificationReadState.createMany).toHaveBeenCalledWith({
      data: [
        { notificationId: 'notification-1', userId: 'user-1' },
        { notificationId: 'notification-2', userId: 'user-1' },
      ],
      skipDuplicates: true,
    });
    expect(result.updated).toBe(2);
  });
});
