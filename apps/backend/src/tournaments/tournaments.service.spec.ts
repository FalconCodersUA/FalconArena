import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TournamentStatus } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TournamentsService } from './tournaments.service';

function createPrismaMock() {
  return {
    tournament: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  };
}

describe('TournamentsService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('computes team registration availability in list()', async () => {
    const prisma = createPrismaMock();
    prisma.tournament.findMany.mockResolvedValue([
      {
        id: 't-open',
        title: 'Open Tournament',
        description: null,
        startsAt: null,
        registrationOpenAt: new Date('2026-03-15T10:00:00.000Z'),
        registrationCloseAt: new Date('2026-03-15T14:00:00.000Z'),
        maxTeams: null,
        status: TournamentStatus.REGISTRATION,
        createdById: 'admin-1',
        createdAt: new Date('2026-03-10T10:00:00.000Z'),
        updatedAt: new Date('2026-03-10T10:00:00.000Z'),
      },
      {
        id: 't-running',
        title: 'Running Tournament',
        description: null,
        startsAt: null,
        registrationOpenAt: new Date('2026-03-14T10:00:00.000Z'),
        registrationCloseAt: new Date('2026-03-16T14:00:00.000Z'),
        maxTeams: null,
        status: TournamentStatus.RUNNING,
        createdById: 'admin-2',
        createdAt: new Date('2026-03-11T10:00:00.000Z'),
        updatedAt: new Date('2026-03-11T10:00:00.000Z'),
      },
      {
        id: 't-closed',
        title: 'Closed Tournament',
        description: null,
        startsAt: null,
        registrationOpenAt: new Date('2026-03-10T10:00:00.000Z'),
        registrationCloseAt: new Date('2026-03-14T14:00:00.000Z'),
        maxTeams: null,
        status: TournamentStatus.REGISTRATION,
        createdById: 'admin-3',
        createdAt: new Date('2026-03-09T10:00:00.000Z'),
        updatedAt: new Date('2026-03-09T10:00:00.000Z'),
      },
    ]);

    const service = new TournamentsService(prisma as never);
    const items = await service.list({});

    expect(items).toHaveLength(3);
    expect(items[0].registrationIsOpen).toBe(true);
    expect(items[0].canTeamRegister).toBe(true);
    expect(items[1].registrationIsOpen).toBe(true);
    expect(items[1].canTeamRegister).toBe(false);
    expect(items[2].registrationIsClosed).toBe(true);
    expect(items[2].canTeamRegister).toBe(false);
  });

  it('rejects invalid tournament status transition', async () => {
    const prisma = createPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({
      id: 't-1',
      title: 'Tournament',
      description: null,
      startsAt: null,
      registrationOpenAt: new Date('2026-03-10T10:00:00.000Z'),
      registrationCloseAt: new Date('2026-03-20T14:00:00.000Z'),
      maxTeams: null,
      status: TournamentStatus.DRAFT,
      createdById: 'admin-1',
      createdAt: new Date('2026-03-09T10:00:00.000Z'),
      updatedAt: new Date('2026-03-09T10:00:00.000Z'),
    });

    const service = new TournamentsService(prisma as never);

    await expect(
      service.updateStatus('t-1', TournamentStatus.RUNNING),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.tournament.update).not.toHaveBeenCalled();
  });

  it('throws not found for missing tournament', async () => {
    const prisma = createPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue(null);
    const service = new TournamentsService(prisma as never);

    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
