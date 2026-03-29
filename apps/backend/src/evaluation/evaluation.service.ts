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
import { SystemIntegrationsService } from '../system-integrations/system-integrations.service';
import { DistributeAssignmentsDto } from './dto/distribute-assignments.dto';
import { FinishEvaluationDto } from './dto/finish-evaluation.dto';
import { EvaluationScoresDto, SubmitEvaluationDto } from './dto/submit-evaluation.dto';

type JuryCandidate = {
  id: string;
};

@Injectable()
export class EvaluationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemIntegrationsService: SystemIntegrationsService,
  ) {}

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

    if (round.status === RoundStatus.DRAFT) {
      throw new BadRequestException('Cannot distribute assignments for draft round');
    }

    if (round.status === RoundStatus.EVALUATED) {
      throw new BadRequestException('Cannot distribute assignments for evaluated round');
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

    const defaults = await this.systemIntegrationsService.getTournamentDefaultsConfig();
    const minReviewersPerSubmission =
      dto.minReviewersPerSubmission ?? defaults.defaultMinReviewersPerSubmission;
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

    if (assignment.round.status === RoundStatus.EVALUATED) {
      throw new BadRequestException('Cannot submit evaluation for evaluated round');
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

  async finishRoundEvaluation(roundId: string, dto: FinishEvaluationDto) {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      select: {
        id: true,
        title: true,
        deadlineAt: true,
        status: true,
        tournamentId: true,
        tournament: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!round) {
      throw new NotFoundException('Round not found');
    }

    if (round.status === RoundStatus.DRAFT) {
      throw new BadRequestException('Cannot finish evaluation for draft round');
    }

    if (round.status === RoundStatus.EVALUATED) {
      return {
        roundId: round.id,
        roundStatus: round.status,
        tournamentId: round.tournamentId,
        tournamentStatus: round.tournament.status,
        forced: !!dto.force,
        alreadyEvaluated: true,
      };
    }

    if (round.status === RoundStatus.ACTIVE) {
      const deadlinePassed = Date.now() > round.deadlineAt.getTime();
      if (!deadlinePassed && !dto.force) {
        throw new BadRequestException(
          'Round is still active; use force=true to close and finish evaluation early',
        );
      }

      await this.prisma.$transaction([
        this.prisma.round.update({
          where: { id: round.id },
          data: { status: RoundStatus.SUBMISSION_CLOSED },
        }),
        this.prisma.submission.updateMany({
          where: {
            roundId: round.id,
            status: SubmissionStatus.SUBMITTED,
          },
          data: {
            status: SubmissionStatus.LOCKED,
          },
        }),
      ]);
    }

    const [assignmentsCount, evaluationsCount] = await this.prisma.$transaction([
      this.prisma.evaluationAssignment.count({ where: { roundId: round.id } }),
      this.prisma.evaluation.count({
        where: {
          assignment: {
            roundId: round.id,
          },
        },
      }),
    ]);

    const pendingAssignments = assignmentsCount - evaluationsCount;
    if ((assignmentsCount === 0 || pendingAssignments > 0) && !dto.force) {
      throw new BadRequestException(
        `Evaluation is incomplete: assignments=${assignmentsCount}, completed=${evaluationsCount}, pending=${pendingAssignments}`,
      );
    }

    await this.prisma.submission.updateMany({
      where: {
        roundId: round.id,
        status: SubmissionStatus.SUBMITTED,
      },
      data: {
        status: SubmissionStatus.LOCKED,
      },
    });

    const updatedRound = await this.prisma.round.update({
      where: { id: round.id },
      data: { status: RoundStatus.EVALUATED },
      select: {
        id: true,
        title: true,
        status: true,
        tournamentId: true,
      },
    });

    const [totalRounds, evaluatedRounds] = await this.prisma.$transaction([
      this.prisma.round.count({
        where: {
          tournamentId: updatedRound.tournamentId,
        },
      }),
      this.prisma.round.count({
        where: {
          tournamentId: updatedRound.tournamentId,
          status: RoundStatus.EVALUATED,
        },
      }),
    ]);

    let tournamentStatus = round.tournament.status;
    if (totalRounds > 0 && evaluatedRounds === totalRounds) {
      const updatedTournament = await this.prisma.tournament.update({
        where: { id: updatedRound.tournamentId },
        data: { status: TournamentStatus.FINISHED },
        select: { status: true },
      });
      tournamentStatus = updatedTournament.status;
    }

    return {
      roundId: updatedRound.id,
      roundTitle: updatedRound.title,
      roundStatus: updatedRound.status,
      tournamentId: updatedRound.tournamentId,
      tournamentStatus,
      forced: !!dto.force,
      assignmentsCount,
      evaluationsCount,
      pendingAssignments,
      completedAllRounds: totalRounds > 0 && evaluatedRounds === totalRounds,
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
