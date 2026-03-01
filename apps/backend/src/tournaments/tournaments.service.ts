import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Tournament, TournamentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { ListTournamentsDto } from './dto/list-tournaments.dto';

type TournamentView = Tournament & {
  registrationIsOpen: boolean;
  registrationHasStarted: boolean;
  registrationIsClosed: boolean;
  canTeamRegister: boolean;
};

@Injectable()
export class TournamentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTournamentDto, createdById: string): Promise<TournamentView> {
    this.validateRegistrationWindow(dto.registrationOpenAt, dto.registrationCloseAt);

    const tournament = await this.prisma.tournament.create({
      data: {
        title: dto.title,
        description: dto.description,
        startsAt: dto.startsAt,
        registrationOpenAt: dto.registrationOpenAt,
        registrationCloseAt: dto.registrationCloseAt,
        maxTeams: dto.maxTeams,
        createdById,
      },
    });

    return this.mapTournamentView(tournament);
  }

  async list(query: ListTournamentsDto): Promise<TournamentView[]> {
    const tournaments = await this.prisma.tournament.findMany({
      where: {
        status: query.status,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return tournaments.map((tournament) => this.mapTournamentView(tournament));
  }

  async findById(id: string): Promise<TournamentView> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    return this.mapTournamentView(tournament);
  }

  async updateStatus(
    id: string,
    status: TournamentStatus,
  ): Promise<TournamentView> {
    const existing = await this.prisma.tournament.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Tournament not found');
    }

    if (status === TournamentStatus.REGISTRATION) {
      this.validateRegistrationWindow(
        existing.registrationOpenAt,
        existing.registrationCloseAt,
      );
    }

    const tournament = await this.prisma.tournament.update({
      where: { id },
      data: { status },
    });

    return this.mapTournamentView(tournament);
  }

  private validateRegistrationWindow(openAt: Date, closeAt: Date) {
    if (openAt >= closeAt) {
      throw new BadRequestException(
        'registrationOpenAt must be earlier than registrationCloseAt',
      );
    }
  }

  private mapTournamentView(tournament: Tournament): TournamentView {
    const now = Date.now();
    const openAt = tournament.registrationOpenAt.getTime();
    const closeAt = tournament.registrationCloseAt.getTime();

    const registrationHasStarted = now >= openAt;
    const registrationIsClosed = now > closeAt;
    const registrationIsOpen = registrationHasStarted && !registrationIsClosed;

    return {
      ...tournament,
      registrationHasStarted,
      registrationIsClosed,
      registrationIsOpen,
      canTeamRegister:
        tournament.status === TournamentStatus.REGISTRATION && registrationIsOpen,
    };
  }
}
