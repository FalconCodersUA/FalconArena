import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TournamentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SystemIntegrationsService } from '../system-integrations/system-integrations.service';
import { RegisterTeamDto } from './dto/register-team.dto';

type TeamPublicView = {
  id: string;
  name: string;
  organization: string | null;
  createdAt: Date;
  membersCount: number;
};

type TeamPrivateView = {
  id: string;
  tournamentId: string;
  name: string;
  organization: string | null;
  contactHandle: string | null;
  captain: {
    id: string;
    fullName: string;
    email: string;
  };
  members: {
    id: string;
    fullName: string;
    email: string;
  }[];
  createdAt: Date;
};

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemIntegrationsService: SystemIntegrationsService,
  ) {}

  async register(
    tournamentId: string,
    captainUserId: string,
    dto: RegisterTeamDto,
  ): Promise<TeamPrivateView> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    if (tournament.status !== TournamentStatus.REGISTRATION) {
      throw new BadRequestException('Tournament is not open for registration');
    }

    const now = Date.now();
    if (
      now < tournament.registrationOpenAt.getTime() ||
      now > tournament.registrationCloseAt.getTime()
    ) {
      throw new BadRequestException('Registration window is closed');
    }

    const defaults = await this.systemIntegrationsService.getTournamentDefaultsConfig();
    const minMemberCount = defaults.minTeamMembers;
    const maxMemberCount = defaults.maxTeamMembers;

    if (dto.members.length < minMemberCount || dto.members.length > maxMemberCount) {
      throw new BadRequestException(
        `Team must contain between ${minMemberCount} and ${maxMemberCount} members`,
      );
    }

    const captain = await this.prisma.user.findUnique({
      where: { id: captainUserId },
      select: { id: true, email: true },
    });

    if (!captain) {
      throw new NotFoundException('Captain user not found');
    }

    const payloadEmails = new Set<string>();
    for (const member of dto.members) {
      const email = member.email.toLowerCase();
      if (payloadEmails.has(email)) {
        throw new BadRequestException('Member emails must be unique within the team');
      }
      payloadEmails.add(email);
    }

    if (payloadEmails.has(captain.email.toLowerCase())) {
      throw new BadRequestException(
        'Captain email cannot be duplicated in members list',
      );
    }

    if (tournament.maxTeams) {
      const currentTeamsCount = await this.prisma.team.count({
        where: { tournamentId },
      });

      if (currentTeamsCount >= tournament.maxTeams) {
        throw new BadRequestException('Tournament team limit reached');
      }
    }

    try {
      const team = await this.prisma.team.create({
        data: {
          tournamentId,
          name: dto.name,
          captainId: captainUserId,
          organization: dto.organization,
          contactHandle: dto.contactHandle,
          members: {
            create: dto.members.map((member) => ({
              fullName: member.fullName,
              email: member.email,
            })),
          },
        },
        include: {
          captain: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          members: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      return {
        id: team.id,
        tournamentId: team.tournamentId,
        name: team.name,
        organization: team.organization,
        contactHandle: team.contactHandle,
        captain: team.captain,
        members: team.members,
        createdAt: team.createdAt,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Team already exists for this captain or team name is already used',
        );
      }

      throw error;
    }
  }

  async listByTournament(tournamentId: string): Promise<TeamPublicView[]> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        status: true,
        registrationCloseAt: true,
      },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    const defaults = await this.systemIntegrationsService.getTournamentDefaultsConfig();
    const shouldHideTeams =
      defaults.hideTeamsUntilRegistrationClose &&
      tournament.status !== TournamentStatus.RUNNING &&
      tournament.status !== TournamentStatus.FINISHED &&
      Date.now() <= tournament.registrationCloseAt.getTime();

    if (shouldHideTeams) {
      return [];
    }

    const teams = await this.prisma.team.findMany({
      where: { tournamentId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    return teams.map((team) => ({
      id: team.id,
      name: team.name,
      organization: team.organization,
      createdAt: team.createdAt,
      membersCount: team._count.members,
    }));
  }

  async getMyTeam(
    tournamentId: string,
    captainUserId: string,
  ): Promise<TeamPrivateView> {
    const team = await this.prisma.team.findUnique({
      where: {
        tournamentId_captainId: {
          tournamentId,
          captainId: captainUserId,
        },
      },
      include: {
        captain: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        members: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found for current captain');
    }

    return {
      id: team.id,
      tournamentId: team.tournamentId,
      name: team.name,
      organization: team.organization,
      contactHandle: team.contactHandle,
      captain: team.captain,
      members: team.members,
      createdAt: team.createdAt,
    };
  }
}
