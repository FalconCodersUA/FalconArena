import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Round, RoundStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoundDto } from './dto/create-round.dto';

@Injectable()
export class RoundsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tournamentId: string, dto: CreateRoundDto) {
    this.validateRoundWindow(dto.startsAt, dto.deadlineAt);

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    const aggregate = await this.prisma.round.aggregate({
      where: { tournamentId },
      _max: { sequence: true },
    });

    const sequence = (aggregate._max.sequence ?? 0) + 1;

    return this.prisma.round.create({
      data: {
        tournamentId,
        sequence,
        title: dto.title,
        description: dto.description,
        mustHave: dto.mustHave ?? [],
        startsAt: dto.startsAt,
        deadlineAt: dto.deadlineAt,
      },
    });
  }

  async listByTournament(tournamentId: string) {
    await this.ensureTournamentExists(tournamentId);
    await this.closeExpiredRounds(tournamentId);

    return this.prisma.round.findMany({
      where: { tournamentId },
      orderBy: { sequence: 'asc' },
    });
  }

  async getActiveRound(tournamentId: string) {
    await this.ensureTournamentExists(tournamentId);
    await this.closeExpiredRounds(tournamentId);

    return this.prisma.round.findFirst({
      where: {
        tournamentId,
        status: RoundStatus.ACTIVE,
      },
      orderBy: { sequence: 'asc' },
    });
  }

  async updateStatus(
    tournamentId: string,
    roundId: string,
    status: RoundStatus,
  ) {
    const round = await this.prisma.round.findUnique({ where: { id: roundId } });
    if (!round || round.tournamentId !== tournamentId) {
      throw new NotFoundException('Round not found in this tournament');
    }

    if (status === RoundStatus.ACTIVE) {
      if (Date.now() > round.deadlineAt.getTime()) {
        throw new BadRequestException('Cannot activate round after deadline');
      }

      const anotherActive = await this.prisma.round.findFirst({
        where: {
          tournamentId,
          status: RoundStatus.ACTIVE,
          id: { not: roundId },
        },
      });

      if (anotherActive) {
        throw new ConflictException(
          'Another round is already active for this tournament',
        );
      }
    }

    return this.prisma.round.update({
      where: { id: roundId },
      data: { status },
    });
  }

  async findById(roundId: string) {
    const round = await this.prisma.round.findUnique({ where: { id: roundId } });
    if (!round) {
      throw new NotFoundException('Round not found');
    }

    if (
      round.status === RoundStatus.ACTIVE &&
      Date.now() > round.deadlineAt.getTime()
    ) {
      return this.prisma.round.update({
        where: { id: round.id },
        data: { status: RoundStatus.SUBMISSION_CLOSED },
      });
    }

    return round;
  }

  async ensureSubmissionsOpen(roundId: string): Promise<Round> {
    const round = await this.findById(roundId);

    if (round.status !== RoundStatus.ACTIVE) {
      throw new BadRequestException('Round is not accepting submissions');
    }

    if (Date.now() > round.deadlineAt.getTime()) {
      await this.prisma.round.update({
        where: { id: round.id },
        data: { status: RoundStatus.SUBMISSION_CLOSED },
      });
      throw new BadRequestException('Submission deadline has passed');
    }

    return round;
  }

  private async ensureTournamentExists(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }
  }

  private async closeExpiredRounds(tournamentId: string) {
    await this.prisma.round.updateMany({
      where: {
        tournamentId,
        status: RoundStatus.ACTIVE,
        deadlineAt: { lt: new Date() },
      },
      data: {
        status: RoundStatus.SUBMISSION_CLOSED,
      },
    });
  }

  private validateRoundWindow(startsAt: Date, deadlineAt: Date) {
    if (startsAt >= deadlineAt) {
      throw new BadRequestException('startsAt must be earlier than deadlineAt');
    }
  }
}
