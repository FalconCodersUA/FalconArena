import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TournamentScheduleEventType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { TournamentScheduleService } from './tournament-schedule.service';

function createPrismaMock() {
  return {
    tournament: {
      findUnique: vi.fn(),
    },
    tournamentScheduleEvent: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

describe('TournamentScheduleService', () => {
  it('lists schedule events ordered by start time', async () => {
    const prisma = createPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({ id: 'tour-1' });
    prisma.tournamentScheduleEvent.findMany.mockResolvedValue([]);
    const service = new TournamentScheduleService(prisma as never);

    await service.list('tour-1');

    expect(prisma.tournamentScheduleEvent.findMany).toHaveBeenCalledWith({
      where: { tournamentId: 'tour-1' },
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
    });
  });

  it('creates schedule event with trimmed fields', async () => {
    const prisma = createPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({ id: 'tour-1' });
    prisma.tournamentScheduleEvent.create.mockResolvedValue({
      id: 'event-1',
      tournamentId: 'tour-1',
      title: 'Consultation',
      description: 'Zoom session',
      type: TournamentScheduleEventType.CONSULTATION,
      startsAt: new Date('2026-04-10T09:00:00.000Z'),
      endsAt: new Date('2026-04-10T10:00:00.000Z'),
      location: 'Discord',
      createdAt: new Date('2026-04-01T09:00:00.000Z'),
      updatedAt: new Date('2026-04-01T09:00:00.000Z'),
    });
    const service = new TournamentScheduleService(prisma as never);

    await service.create('tour-1', {
      title: '  Consultation  ',
      description: '  Zoom session  ',
      type: 'CONSULTATION',
      startsAt: new Date('2026-04-10T09:00:00.000Z'),
      endsAt: new Date('2026-04-10T10:00:00.000Z'),
      location: '  Discord  ',
    });

    expect(prisma.tournamentScheduleEvent.create).toHaveBeenCalledWith({
      data: {
        tournamentId: 'tour-1',
        title: 'Consultation',
        description: 'Zoom session',
        type: TournamentScheduleEventType.CONSULTATION,
        startsAt: new Date('2026-04-10T09:00:00.000Z'),
        endsAt: new Date('2026-04-10T10:00:00.000Z'),
        location: 'Discord',
      },
    });
  });

  it('throws when end time is earlier than start time', async () => {
    const prisma = createPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({ id: 'tour-1' });
    const service = new TournamentScheduleService(prisma as never);

    await expect(
      service.create('tour-1', {
        title: 'Deadline',
        startsAt: new Date('2026-04-10T11:00:00.000Z'),
        endsAt: new Date('2026-04-10T10:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when updating a missing event', async () => {
    const prisma = createPrismaMock();
    prisma.tournamentScheduleEvent.findFirst.mockResolvedValue(null);
    const service = new TournamentScheduleService(prisma as never);

    await expect(
      service.update('tour-1', 'missing-event', { title: 'Updated' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
