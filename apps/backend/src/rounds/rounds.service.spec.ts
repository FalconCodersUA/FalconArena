import { BadRequestException } from '@nestjs/common';
import { RoundStatus, SubmissionStatus, TournamentStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { RoundsService } from './rounds.service';

function createPrismaMock() {
  return {
    round: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    submission: {
      updateMany: vi.fn(),
    },
    tournament: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

describe('RoundsService', () => {
  it('rejects invalid round status transition', async () => {
    const prisma = createPrismaMock();
    prisma.round.findUnique.mockResolvedValue({
      id: 'round-1',
      tournamentId: 't-1',
      status: RoundStatus.DRAFT,
      deadlineAt: new Date('2099-01-01T00:00:00.000Z'),
      tournament: {
        id: 't-1',
        status: TournamentStatus.REGISTRATION,
      },
    });

    const service = new RoundsService(prisma as never);

    await expect(
      service.updateStatus('t-1', 'round-1', RoundStatus.SUBMISSION_CLOSED),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('activates a draft round and sets tournament to running', async () => {
    const prisma = createPrismaMock();
    prisma.round.findUnique.mockResolvedValue({
      id: 'round-1',
      tournamentId: 't-1',
      status: RoundStatus.DRAFT,
      deadlineAt: new Date('2099-01-01T00:00:00.000Z'),
      tournament: {
        id: 't-1',
        status: TournamentStatus.REGISTRATION,
      },
    });
    prisma.round.findFirst.mockResolvedValue(null);
    prisma.round.update.mockResolvedValue({
      id: 'round-1',
      tournamentId: 't-1',
      status: RoundStatus.ACTIVE,
    });
    prisma.tournament.update.mockResolvedValue({
      id: 't-1',
      status: TournamentStatus.RUNNING,
    });
    prisma.$transaction.mockImplementation((queries: Array<Promise<unknown>>) =>
      Promise.all(queries),
    );

    const service = new RoundsService(prisma as never);
    const result = await service.updateStatus('t-1', 'round-1', RoundStatus.ACTIVE);

    expect(prisma.round.findFirst).toHaveBeenCalledWith({
      where: {
        tournamentId: 't-1',
        status: RoundStatus.ACTIVE,
        id: { not: 'round-1' },
      },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(RoundStatus.ACTIVE);
  });

  it('closes round submissions and locks submitted entries', async () => {
    const prisma = createPrismaMock();
    prisma.round.findUnique.mockResolvedValue({
      id: 'round-1',
      tournamentId: 't-1',
      status: RoundStatus.ACTIVE,
      deadlineAt: new Date('2099-01-01T00:00:00.000Z'),
      tournament: {
        id: 't-1',
        status: TournamentStatus.RUNNING,
      },
    });
    prisma.round.update.mockResolvedValue({
      id: 'round-1',
      tournamentId: 't-1',
      status: RoundStatus.SUBMISSION_CLOSED,
    });
    prisma.submission.updateMany.mockResolvedValue({ count: 2 });
    prisma.$transaction.mockImplementation((queries: Array<Promise<unknown>>) =>
      Promise.all(queries),
    );

    const service = new RoundsService(prisma as never);
    const result = await service.updateStatus(
      't-1',
      'round-1',
      RoundStatus.SUBMISSION_CLOSED,
    );

    expect(prisma.submission.updateMany).toHaveBeenCalledWith({
      where: {
        roundId: 'round-1',
        status: SubmissionStatus.SUBMITTED,
      },
      data: {
        status: SubmissionStatus.LOCKED,
      },
    });
    expect(result.status).toBe(RoundStatus.SUBMISSION_CLOSED);
  });

  it('sends a deadline reminder once the active round enters the 24-hour window', async () => {
    const prisma = createPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({ id: 't-1' });
    prisma.round.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'round-1',
          title: 'API sprint',
          tournamentId: 't-1',
        },
      ]);
    prisma.round.updateMany.mockResolvedValue({ count: 1 });
    prisma.round.findFirst.mockResolvedValue({
      id: 'round-1',
      tournamentId: 't-1',
      title: 'API sprint',
      description: 'Build notification delivery',
      mustHave: [],
      technologyRequirements: [],
      additionalMaterials: [],
      startsAt: new Date('2026-03-27T12:00:00.000Z'),
      deadlineAt: new Date('2026-03-28T20:00:00.000Z'),
      deadlineReminderSentAt: null,
      status: RoundStatus.ACTIVE,
      createdAt: new Date('2026-03-27T10:00:00.000Z'),
      updatedAt: new Date('2026-03-27T10:00:00.000Z'),
    });
    const notificationsService = {
      create: vi.fn().mockResolvedValue({ id: 'notification-1' }),
    };

    const service = new RoundsService(prisma as never, notificationsService as never);
    const result = await service.getActiveRound('t-1');

    expect(prisma.round.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['round-1'] },
        deadlineReminderSentAt: null,
      },
      data: {
        deadlineReminderSentAt: expect.any(Date),
      },
    });
    expect(notificationsService.create).toHaveBeenCalledWith({
      type: 'DEADLINE_REMINDER',
      audience: 'ALL',
      title: 'Нагадування про дедлайн: API sprint',
      body: 'До завершення прийому робіт залишилося менше 24 годин.',
      linkUrl: '/app/tournaments/t-1',
    });
    expect(result?.status).toBe(RoundStatus.ACTIVE);
  });
});
