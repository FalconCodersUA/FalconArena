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
      findUnique: vi.fn(),
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

function createAuditLogsServiceMock() {
  return {
    record: vi.fn().mockResolvedValue(undefined),
  };
}

describe('EvaluationService', () => {
  it('allows jury to save and update evaluation while round is active', async () => {
    const prisma = createPrismaMock();
    const auditLogsService = createAuditLogsServiceMock();
    prisma.evaluationAssignment.findUnique.mockResolvedValue({
      id: 'assignment-1',
      roundId: 'round-1',
      juryId: 'jury-1',
      round: {
        id: 'round-1',
        title: 'Round 1',
        status: RoundStatus.ACTIVE,
        tournamentId: 'tournament-1',
        tournament: {
          status: TournamentStatus.RUNNING,
        },
      },
      submission: {
        id: 'submission-1',
        team: {
          id: 'team-1',
          name: 'Team One',
        },
      },
    });
    prisma.evaluation.upsert.mockResolvedValue({
      id: 'evaluation-1',
      assignmentId: 'assignment-1',
      juryId: 'jury-1',
      scores: {},
      totalScore: 90,
      comment: 'Looks good',
    });

    const service = new EvaluationService(
      prisma as never,
      createSystemIntegrationsServiceMock() as never,
      auditLogsService as never,
    );

    const result = await service.submitEvaluation(
      'round-1',
      'assignment-1',
      'jury-1',
      {
        scores: {
          technicalBackend: 90,
          technicalDatabase: 90,
          technicalFrontend: 90,
          mustHave: 90,
          stability: 90,
          usability: 90,
        },
        comment: 'Looks good',
      },
    );

    expect(prisma.evaluation.upsert).toHaveBeenCalledWith({
      where: {
        assignmentId: 'assignment-1',
      },
      update: {
        scores: {
          technicalBackend: 90,
          technicalDatabase: 90,
          technicalFrontend: 90,
          mustHave: 90,
          stability: 90,
          usability: 90,
        },
        totalScore: 90,
        comment: 'Looks good',
      },
      create: {
        assignmentId: 'assignment-1',
        juryId: 'jury-1',
        scores: {
          technicalBackend: 90,
          technicalDatabase: 90,
          technicalFrontend: 90,
          mustHave: 90,
          stability: 90,
          usability: 90,
        },
        totalScore: 90,
        comment: 'Looks good',
      },
    });
    expect(result.totalScore).toBe(90);
    expect(auditLogsService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'evaluation.submitted',
        actorId: 'jury-1',
        tournamentId: 'tournament-1',
      }),
    );
  });

  it('blocks jury evaluation changes for finished tournament', async () => {
    const prisma = createPrismaMock();
    prisma.evaluationAssignment.findUnique.mockResolvedValue({
      id: 'assignment-1',
      roundId: 'round-1',
      juryId: 'jury-1',
      round: {
        id: 'round-1',
        title: 'Round 1',
        status: RoundStatus.SUBMISSION_CLOSED,
        tournamentId: 'tournament-1',
        tournament: {
          status: TournamentStatus.FINISHED,
        },
      },
      submission: {
        id: 'submission-1',
        team: {
          id: 'team-1',
          name: 'Team One',
        },
      },
    });

    const service = new EvaluationService(
      prisma as never,
      createSystemIntegrationsServiceMock() as never,
      createAuditLogsServiceMock() as never,
    );

    await expect(
      service.submitEvaluation('round-1', 'assignment-1', 'jury-1', {
        scores: {
          technicalBackend: 90,
          technicalDatabase: 90,
          technicalFrontend: 90,
          mustHave: 90,
          stability: 90,
          usability: 90,
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.evaluation.upsert).not.toHaveBeenCalled();
  });

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
      createAuditLogsServiceMock() as never,
    );

    await expect(
      service.finishRoundEvaluation('round-1', { force: false }, {
        userId: 'admin-1',
        role: 'ADMIN',
        email: 'admin@example.com',
      }),
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
      createAuditLogsServiceMock() as never,
    );
    const result = await service.finishRoundEvaluation('round-1', { force: true }, {
      userId: 'admin-1',
      role: 'ADMIN',
      email: 'admin@example.com',
    });

    expect(result.alreadyEvaluated).toBe(true);
    expect(result.roundStatus).toBe(RoundStatus.EVALUATED);
    expect(result.tournamentStatus).toBe(TournamentStatus.FINISHED);
  });
});
