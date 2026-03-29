import { Logger } from '@nestjs/common';
import { NotificationAudience, NotificationType, Role } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationEmailService } from './notification-email.service';

function createPrismaMock() {
  return {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  };
}

describe('NotificationEmailService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true';
    process.env.EMAIL_PROVIDER = 'console';
    process.env.APP_DOMAIN = 'https://falconarena.live';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('delivers announcement emails only to opted-in role recipients', async () => {
    const prisma = createPrismaMock();
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'team-1',
        email: 'team1@example.com',
        fullName: 'Team One',
        role: Role.TEAM,
        settings: { notifyAnnouncements: true, notifyMessages: true },
      },
      {
        id: 'team-2',
        email: 'team2@example.com',
        fullName: 'Team Two',
        role: Role.TEAM,
        settings: { notifyAnnouncements: false, notifyMessages: true },
      },
    ]);

    const loggerSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const service = new NotificationEmailService(prisma as never);

    const result = await service.deliver({
      type: NotificationType.ROUND_STARTED,
      audience: NotificationAudience.TEAM,
      title: 'Стартував раунд',
      body: 'Новий раунд уже доступний.',
      linkUrl: '/app/tournaments/t-1',
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { role: Role.TEAM },
      include: { settings: true },
    });
    expect(result).toEqual({ status: 'sent', sent: 1 });
    expect(loggerSpy).toHaveBeenCalledWith(
      'EMAIL(console) to=team1@example.com subject="Стартував раунд"',
    );
  });

  it('delivers personal submission emails when user has default message preference', async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'captain@example.com',
      fullName: 'Captain',
      settings: null,
    });

    const loggerSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const service = new NotificationEmailService(prisma as never);

    const result = await service.deliver({
      type: NotificationType.SUBMISSION_RECEIVED,
      audience: NotificationAudience.USER,
      userId: 'user-1',
      title: 'Сабміт збережено',
      body: 'Ваш сабміт успішно збережено.',
      linkUrl: '/app/team',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      include: { settings: true },
    });
    expect(result).toEqual({ status: 'sent', sent: 1 });
    expect(loggerSpy).toHaveBeenCalledWith(
      'EMAIL(console) to=captain@example.com subject="Сабміт збережено"',
    );
  });

  it('skips delivery entirely when email notifications are disabled', async () => {
    process.env.EMAIL_NOTIFICATIONS_ENABLED = 'false';

    const prisma = createPrismaMock();
    const service = new NotificationEmailService(prisma as never);

    const result = await service.deliver({
      type: NotificationType.GENERAL,
      audience: NotificationAudience.ALL,
      title: 'Оновлення',
      body: 'Тестове повідомлення.',
    });

    expect(result).toEqual({ status: 'disabled', sent: 0 });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
