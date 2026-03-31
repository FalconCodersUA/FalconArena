import { NotFoundException } from '@nestjs/common';
import { RoundStatus, SubmissionStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { SubmissionsService } from './submissions.service';

function createPrismaMock() {
  return {
    team: {
      findUnique: vi.fn(),
    },
    submission: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  };
}

function createRoundsServiceMock() {
  return {
    ensureSubmissionsOpen: vi.fn(),
    findById: vi.fn(),
  };
}

describe('SubmissionsService', () => {
  it('preserves first submittedAt when updating existing submission', async () => {
    const prisma = createPrismaMock();
    const roundsService = createRoundsServiceMock();

    const now = Date.now();
    const firstSubmittedAt = new Date(now - 60 * 60 * 1000);
    const deadline = new Date(now + 24 * 60 * 60 * 1000);

    roundsService.ensureSubmissionsOpen.mockResolvedValue({
      id: 'round-1',
      tournamentId: 'tournament-1',
      status: RoundStatus.ACTIVE,
      deadlineAt: deadline,
    });

    prisma.team.findUnique.mockResolvedValue({
      id: 'team-1',
      name: 'Falcon Team',
    });

    prisma.submission.findUnique.mockResolvedValue({
      id: 'submission-1',
      submittedAt: firstSubmittedAt,
    });

    prisma.submission.update.mockResolvedValue({
      id: 'submission-1',
      roundId: 'round-1',
      teamId: 'team-1',
      repoUrl: 'https://github.com/example/repo',
      demoUrl: 'https://youtu.be/demo',
      liveDemoUrl: null,
      shortSummary: null,
      status: SubmissionStatus.SUBMITTED,
      submittedAt: firstSubmittedAt,
      createdAt: new Date(firstSubmittedAt.getTime() - 60 * 1000),
      updatedAt: new Date(firstSubmittedAt.getTime() + 30 * 60 * 1000),
      team: {
        id: 'team-1',
        name: 'Falcon Team',
      },
      round: {
        id: 'round-1',
        title: 'Round 1',
        deadlineAt: deadline,
        status: RoundStatus.ACTIVE,
      },
    });

    const service = new SubmissionsService(
      prisma as never,
      roundsService as never,
      undefined,
      { record: vi.fn().mockResolvedValue(undefined) } as never,
    );

    const result = await service.upsertMySubmission(
      'round-1',
      {
        userId: 'captain-1',
        role: 'TEAM',
        email: 'captain@example.com',
      },
      {
        repoUrl: 'https://github.com/example/repo',
        demoUrl: 'https://youtu.be/demo',
        liveDemoUrl: undefined,
        shortSummary: undefined,
      },
    );

    expect(prisma.submission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          submittedAt: firstSubmittedAt,
          status: SubmissionStatus.SUBMITTED,
        }),
      }),
    );
    expect(result.isEditable).toBe(true);
  });

  it('throws when captain has no team in tournament', async () => {
    const prisma = createPrismaMock();
    const roundsService = createRoundsServiceMock();

    roundsService.ensureSubmissionsOpen.mockResolvedValue({
      id: 'round-1',
      tournamentId: 'tournament-1',
      status: RoundStatus.ACTIVE,
      deadlineAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    prisma.team.findUnique.mockResolvedValue(null);

    const service = new SubmissionsService(
      prisma as never,
      roundsService as never,
      undefined,
      { record: vi.fn().mockResolvedValue(undefined) } as never,
    );

    await expect(
      service.upsertMySubmission(
        'round-1',
        {
          userId: 'captain-1',
          role: 'TEAM',
          email: 'captain@example.com',
        },
        {
          repoUrl: 'https://github.com/example/repo',
          demoUrl: 'https://youtu.be/demo',
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
