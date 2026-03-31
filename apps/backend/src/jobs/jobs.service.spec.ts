import { RoundStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { JobsService } from './jobs.service';

function createPrismaMock() {
  return {
    backgroundJob: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    round: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  };
}

describe('JobsService', () => {
  it('creates a deadline reminder job only once per round', async () => {
    const prisma = createPrismaMock();
    prisma.backgroundJob.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'job-1',
      dedupeKey: 'deadline-reminder:round-1',
      status: 'PENDING',
    });
    prisma.backgroundJob.create.mockResolvedValue({
      id: 'job-1',
      dedupeKey: 'deadline-reminder:round-1',
      status: 'PENDING',
    });

    const service = new JobsService(
      prisma as never,
      { create: vi.fn() } as never,
    );

    await service.scheduleDeadlineReminderForRound({
      id: 'round-1',
      title: 'Round 1',
      tournamentId: 't-1',
      deadlineAt: new Date('2099-01-02T12:00:00.000Z'),
      deadlineReminderSentAt: null,
    });

    await service.scheduleDeadlineReminderForRound({
      id: 'round-1',
      title: 'Round 1',
      tournamentId: 't-1',
      deadlineAt: new Date('2099-01-02T12:00:00.000Z'),
      deadlineReminderSentAt: null,
    });

    expect(prisma.backgroundJob.create).toHaveBeenCalledTimes(1);
  });

  it('processes a due deadline reminder job and marks round as reminded', async () => {
    const prisma = createPrismaMock();
    const notificationsService = {
      create: vi.fn().mockResolvedValue({ id: 'notification-1' }),
    };

    prisma.backgroundJob.findMany.mockResolvedValue([
      {
        id: 'job-1',
        type: 'DEADLINE_REMINDER',
        status: 'PENDING',
        runAt: new Date('2026-03-30T10:00:00.000Z'),
        attempts: 0,
        maxAttempts: 3,
        lastError: null,
        dedupeKey: 'deadline-reminder:round-1',
        payload: {
          roundId: 'round-1',
          roundTitle: 'Round 1',
          tournamentId: 't-1',
        },
      },
    ]);
    prisma.backgroundJob.updateMany.mockResolvedValue({ count: 1 });
    prisma.round.findUnique.mockResolvedValue({
      id: 'round-1',
      title: 'Round 1',
      tournamentId: 't-1',
      deadlineAt: new Date('2099-03-31T12:00:00.000Z'),
      deadlineReminderSentAt: null,
      status: RoundStatus.ACTIVE,
    });
    prisma.round.updateMany.mockResolvedValue({ count: 1 });
    prisma.backgroundJob.update.mockResolvedValue({
      id: 'job-1',
      status: 'COMPLETED',
    });

    const service = new JobsService(prisma as never, notificationsService as never);
    await service.processDueJobsOnce();

    expect(notificationsService.create).toHaveBeenCalledWith({
      type: 'DEADLINE_REMINDER',
      audience: 'ALL',
      title: 'Нагадування про дедлайн: Round 1',
      body: 'До завершення прийому робіт залишилося менше 24 годин.',
      linkUrl: '/app/tournaments/t-1',
    });
    expect(prisma.round.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'round-1',
        deadlineReminderSentAt: null,
      },
      data: {
        deadlineReminderSentAt: expect.any(Date),
      },
    });
  });
});
