import { BadRequestException } from '@nestjs/common';
import { RoundStatus, TournamentStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { EvaluationService } from './evaluation.service';

function createPrismaMock() {
  return {
    round: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    submission: {
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    evaluationAssignment: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    evaluation: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    tournament: {
      update: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

function createSystemIntegrationsServiceMock() {
  return {
    getTournamentDefaultsConfig: vi.fn().mockResolvedValue({
      minTeamMembers: 2,
      maxTeamMembers: 8,
      defaultMinReviewersPerSubmission: 2,
      defaultProjectTimeZone: 'Europe/Kyiv',
      hideTeamsUntilRegistrationClose: true,
      defaultTournamentMaxTeams: null,
      defaultRegistrationWindowHours: 24,
      defaultRoundDurationHours: 24,
      defaultTournamentDescription: '',
      defaultRoundDescription: '',
      source: 'default',
    }),
  };
}

describe('EvaluationService', () => {
  it('blocks finish when round is active and not forced before deadline', async () => {
    const prisma = createPrismaMock();
    prisma.round.findUnique.mockResolvedValue({
      id: 'round-1',
      title: 'Round 1',
      deadlineAt: new Date('2099-01-01T00:00:00.000Z'),
      status: RoundStatus.ACTIVE,
      tournamentId: 'tournament-1',
      tournament: {
        id: 'tournament-1',
        status: TournamentStatus.RUNNING,
      },
    });

    const service = new EvaluationService(
      prisma as never,
      createSystemIntegrationsServiceMock() as never,
    );

    await expect(
      service.finishRoundEvaluation('round-1', { force: false }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.round.update).not.toHaveBeenCalled();
    expect(prisma.submission.updateMany).not.toHaveBeenCalled();
  });

  it('returns alreadyEvaluated response for evaluated round', async () => {
    const prisma = createPrismaMock();
    prisma.round.findUnique.mockResolvedValue({
      id: 'round-1',
      title: 'Round 1',
      deadlineAt: new Date('2026-01-01T00:00:00.000Z'),
      status: RoundStatus.EVALUATED,
      tournamentId: 'tournament-1',
      tournament: {
        id: 'tournament-1',
        status: TournamentStatus.FINISHED,
      },
    });

    const service = new EvaluationService(
      prisma as never,
      createSystemIntegrationsServiceMock() as never,
    );
    const result = await service.finishRoundEvaluation('round-1', { force: true });

    expect(result.alreadyEvaluated).toBe(true);
    expect(result.roundStatus).toBe(RoundStatus.EVALUATED);
    expect(result.tournamentStatus).toBe(TournamentStatus.FINISHED);
  });
});
