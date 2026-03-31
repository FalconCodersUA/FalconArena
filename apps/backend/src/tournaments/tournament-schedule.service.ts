import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TournamentScheduleEventType } from '@prisma/client';
import { AuditLogsService } from '../audit-logs.service';
import { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTournamentScheduleEventDto,
  UpdateTournamentScheduleEventDto,
} from './dto/tournament-schedule.dto';

@Injectable()
export class TournamentScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async list(tournamentId: string) {
    await this.ensureTournamentExists(tournamentId);

    const events = await this.prisma.tournamentScheduleEvent.findMany({
      where: { tournamentId },
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
    });

    return events.map((event) => this.mapScheduleEventView(event));
  }

  async create(
    tournamentId: string,
    dto: CreateTournamentScheduleEventDto,
    actor: AuthUser,
  ) {
    await this.ensureTournamentExists(tournamentId);
    this.validateRange(dto.startsAt, dto.endsAt);

    const event = await this.prisma.tournamentScheduleEvent.create({
      data: {
        tournamentId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        type: dto.type ?? TournamentScheduleEventType.OTHER,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        location: dto.location?.trim() || null,
      },
    });

    await this.auditLogsService.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: 'schedule.created',
      entityType: 'schedule_event',
      entityId: event.id,
      entityLabel: event.title,
      tournamentId,
      title: 'Created schedule event',
      description: `${event.title} was added to the tournament schedule.`,
      metadata: {
        type: event.type,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt?.toISOString() ?? null,
      },
    });

    return this.mapScheduleEventView(event);
  }

  async update(
    tournamentId: string,
    eventId: string,
    dto: UpdateTournamentScheduleEventDto,
    actor: AuthUser,
  ) {
    const existing = await this.prisma.tournamentScheduleEvent.findFirst({
      where: {
        id: eventId,
        tournamentId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Tournament schedule event not found');
    }

    const startsAt = dto.startsAt ?? existing.startsAt;
    const endsAt = dto.endsAt === undefined ? existing.endsAt : dto.endsAt;
    this.validateRange(startsAt, endsAt);

    const event = await this.prisma.tournamentScheduleEvent.update({
      where: { id: eventId },
      data: {
        title: dto.title?.trim(),
        description: dto.description === undefined ? undefined : dto.description.trim() || null,
        type: dto.type,
        startsAt: dto.startsAt,
        endsAt,
        location: dto.location === undefined ? undefined : dto.location.trim() || null,
      },
    });

    await this.auditLogsService.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: 'schedule.updated',
      entityType: 'schedule_event',
      entityId: event.id,
      entityLabel: event.title,
      tournamentId,
      title: 'Updated schedule event',
      description: `${event.title} was updated in the tournament schedule.`,
      metadata: {
        type: event.type,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt?.toISOString() ?? null,
      },
    });

    return this.mapScheduleEventView(event);
  }

  async remove(tournamentId: string, eventId: string, actor: AuthUser) {
    const existing = await this.prisma.tournamentScheduleEvent.findFirst({
      where: {
        id: eventId,
        tournamentId,
      },
      select: { id: true, title: true, type: true, startsAt: true },
    });

    if (!existing) {
      throw new NotFoundException('Tournament schedule event not found');
    }

    await this.prisma.tournamentScheduleEvent.delete({
      where: { id: eventId },
    });

    await this.auditLogsService.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: 'schedule.deleted',
      entityType: 'schedule_event',
      entityId: existing.id,
      entityLabel: existing.title,
      tournamentId,
      title: 'Removed schedule event',
      description: `${existing.title} was removed from the tournament schedule.`,
      metadata: {
        type: existing.type,
        startsAt: existing.startsAt.toISOString(),
      },
    });

    return { ok: true };
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

  private validateRange(startsAt: Date, endsAt?: Date | null) {
    if (endsAt && startsAt > endsAt) {
      throw new BadRequestException(
        'Schedule event start time must be earlier than end time',
      );
    }
  }

  private mapScheduleEventView(event: {
    id: string;
    tournamentId: string;
    title: string;
    description: string | null;
    type: TournamentScheduleEventType;
    startsAt: Date;
    endsAt: Date | null;
    location: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...event,
      description: event.description ?? null,
      endsAt: event.endsAt ?? null,
      location: event.location ?? null,
    };
  }
}
