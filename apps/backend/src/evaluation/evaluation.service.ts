import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  Prisma,
  RoundStatus,
  Role,
  SubmissionStatus,
  TournamentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DistributeAssignmentsDto } from './dto/distribute-assignments.dto';
import { EvaluationScoresDto, SubmitEvaluationDto } from './dto/submit-evaluation.dto';

type JuryCandidate = {
  id: string;
};

@Injectable()
export class EvaluationService {
  constructor(private readonly prisma: PrismaService) {}

  async distributeAssignments(roundId: string, dto: DistributeAssignmentsDto) {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      include: {
        tournament: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    if (!round) {
      throw new NotFoundException('Round not found');
    }

    if (round.tournament.status === TournamentStatus.DRAFT) {
      throw new BadRequestException('Cannot distribute assignments for draft tournament');
    }

    const submissions = await this.prisma.submission.findMany({
      where: {
        roundId,
        status: {
          in: [SubmissionStatus.SUBMITTED, SubmissionStatus.LOCKED],
        },
      },
      select: {
        id: true,
      },
    });

    if (submissions.length === 0) {
      throw new BadRequestException('No submissions found for this round');
    }

    const minReviewersPerSubmission = dto.minReviewersPerSubmission ?? 2;
    const juryPool = await this.resolveJuryPool(dto.juryUserIds);

    if (juryPool.length < minReviewersPerSubmission) {
      throw new BadRequestException(
        'Not enough jury users for requested reviewers per submission',
      );
    }

    if (dto.resetExisting) {
      await this.prisma.evaluation.deleteMany({
        where: {
          assignment: {
            roundId,
          },
        },
      });

      await this.prisma.evaluationAssignment.deleteMany({
        where: {
          roundId,
        },
      });
    }

    const existingAssignments = await this.prisma.evaluationAssignment.findMany({
      where: { roundId },
      select: {
        submissionId: true,
        juryId: true,
      },
    });

    const juryIds = juryPool.map((jury) => jury.id);
    const loadByJury = new Map<string, number>(juryIds.map((id) => [id, 0]));
    const assignedBySubmission = new Map<string, Set<string>>();

    for (const submission of submissions) {
      assignedBySubmission.set(submission.id, new Set());
    }

    for (const assignment of existingAssignments) {
      const set = assignedBySubmission.get(assignment.submissionId);
      if (set) {
        set.add(assignment.juryId);
      }

      loadByJury.set(assignment.juryId, (loadByJury.get(assignment.juryId) ?? 0) + 1);
    }

    const toCreate: Array<{
      roundId: string;
      submissionId: string;
      juryId: string;
    }> = [];

    const shuffledSubmissions = this.shuffleArray(submissions.map((entry) => entry.id));

    for (const submissionId of shuffledSubmissions) {
      const assigned = assignedBySubmission.get(submissionId) ?? new Set<string>();

      while (assigned.size < minReviewersPerSubmission) {
        const candidateJuryIds = juryIds.filter((juryId) => !assigned.has(juryId));
        if (candidateJuryIds.length === 0) {
          throw new BadRequestException(
            'Unable to distribute assignments without duplicates for one submission',
          );
        }

        const selectedJuryId = this.pickLeastLoadedJury(candidateJuryIds, loadByJury);
        assigned.add(selectedJuryId);
        loadByJury.set(selectedJuryId, (loadByJury.get(selectedJuryId) ?? 0) + 1);

        const alreadyExists = existingAssignments.some(
          (entry) =>
            entry.submissionId === submissionId && entry.juryId === selectedJuryId,
        );

        if (!alreadyExists) {
          toCreate.push({
            roundId,
            submissionId,
            juryId: selectedJuryId,
          });
        }
      }

      assignedBySubmission.set(submissionId, assigned);
    }

    if (toCreate.length > 0) {
      await this.prisma.evaluationAssignment.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
    }

    const allAssignmentsCount = await this.prisma.evaluationAssignment.count({
      where: { roundId },
    });

    return {
      roundId,
      submissionsCount: submissions.length,
      juryCount: juryPool.length,
      minReviewersPerSubmission,
      createdAssignments: toCreate.length,
      totalAssignments: allAssignmentsCount,
      resetExisting: !!dto.resetExisting,
    };
  }

  async listRoundAssignments(roundId: string) {
    await this.ensureRoundExists(roundId);

    return this.prisma.evaluationAssignment.findMany({
      where: { roundId },
      include: {
        jury: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        submission: {
          select: {
            id: true,
            repoUrl: true,
            demoUrl: true,
            liveDemoUrl: true,
            shortSummary: true,
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        evaluation: true,
      },
      orderBy: [{ assignedAt: 'asc' }],
    });
  }

  async listMyAssignments(roundId: string, juryUserId: string) {
    await this.ensureRoundExists(roundId);

    return this.prisma.evaluationAssignment.findMany({
      where: {
        roundId,
        juryId: juryUserId,
      },
      include: {
        submission: {
          select: {
            id: true,
            repoUrl: true,
            demoUrl: true,
            liveDemoUrl: true,
            shortSummary: true,
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        evaluation: true,
      },
      orderBy: [{ assignedAt: 'asc' }],
    });
  }

  async submitEvaluation(
    roundId: string,
    assignmentId: string,
    juryUserId: string,
    dto: SubmitEvaluationDto,
  ) {
    const assignment = await this.prisma.evaluationAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        round: true,
        submission: {
          select: {
            id: true,
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!assignment || assignment.roundId !== roundId) {
      throw new NotFoundException('Evaluation assignment not found for this round');
    }

    if (assignment.juryId !== juryUserId) {
      throw new UnauthorizedException('Assignment belongs to a different jury member');
    }

    if (assignment.round.status === RoundStatus.DRAFT) {
      throw new BadRequestException('Cannot submit evaluation for draft round');
    }

    const totalScore = this.calculateTotalScore(dto.scores);
    const payload: Prisma.InputJsonValue = dto.scores as unknown as Prisma.InputJsonValue;

    const evaluation = await this.prisma.evaluation.upsert({
      where: {
        assignmentId,
      },
      update: {
        scores: payload,
        totalScore,
        comment: dto.comment,
      },
      create: {
        assignmentId,
        juryId: juryUserId,
        scores: payload,
        totalScore,
        comment: dto.comment,
      },
    });

    return {
      ...evaluation,
      submission: assignment.submission,
      round: {
        id: assignment.round.id,
        title: assignment.round.title,
        status: assignment.round.status,
      },
    };
  }

  private async resolveJuryPool(juryUserIds?: string[]): Promise<JuryCandidate[]> {
    if (!juryUserIds || juryUserIds.length === 0) {
      const allJury = await this.prisma.user.findMany({
        where: {
          role: Role.JURY,
        },
        select: {
          id: true,
        },
      });

      if (allJury.length === 0) {
        throw new BadRequestException('No users with JURY role found');
      }

      return allJury;
    }

    const uniqueIds = [...new Set(juryUserIds)];
    const selectedJury = await this.prisma.user.findMany({
      where: {
        id: { in: uniqueIds },
        role: Role.JURY,
      },
      select: {
        id: true,
      },
    });

    if (selectedJury.length !== uniqueIds.length) {
      throw new BadRequestException('Some provided juryUserIds are invalid or not JURY');
    }

    return selectedJury;
  }

  private pickLeastLoadedJury(
    candidates: string[],
    loadByJury: Map<string, number>,
  ): string {
    let minLoad = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      const load = loadByJury.get(candidate) ?? 0;
      if (load < minLoad) {
        minLoad = load;
      }
    }

    const leastLoaded = candidates.filter(
      (candidate) => (loadByJury.get(candidate) ?? 0) === minLoad,
    );

    const randomIndex = Math.floor(Math.random() * leastLoaded.length);
    return leastLoaded[randomIndex];
  }

  private shuffleArray<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
  }

  private calculateTotalScore(scores: EvaluationScoresDto): number {
    const values = [
      scores.technicalBackend,
      scores.technicalDatabase,
      scores.technicalFrontend,
      scores.mustHave,
      scores.stability,
      scores.usability,
    ];

    const sum = values.reduce((acc, value) => acc + value, 0);
    return Number((sum / values.length).toFixed(2));
  }

  private async ensureRoundExists(roundId: string) {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      select: { id: true },
    });

    if (!round) {
      throw new NotFoundException('Round not found');
    }
  }
}
