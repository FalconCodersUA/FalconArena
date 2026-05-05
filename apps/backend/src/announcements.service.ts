import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AnnouncementAudience, AnnouncementVisibility, Prisma } from '@prisma/client';
import { Role } from './common/constants/roles';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './announcements.dto';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForRole(
    role: Role,
    userId: string,
    includeInactive = false,
    tournamentId?: string,
  ) {
    const isManager = role === 'ADMIN' || role === 'ORGANIZER';

    const where = isManager
      ? this.managerWhere(includeInactive, tournamentId)
      : this.memberWhere(role, userId, tournamentId);

    const [announcements, settings] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.userSettings.findUnique({
        where: { userId },
        select: { lastAnnouncementsReadAt: true },
      }),
    ]);

    const readAt = settings?.lastAnnouncementsReadAt?.getTime() ?? 0;

    return announcements.map((announcement) => ({
      ...announcement,
      isUnread: announcement.publishedAt.getTime() > readAt,
    }));
  }

  async listPublicForTournament(tournamentId: string) {
    await this.ensureTournamentExists(tournamentId);

    return this.prisma.announcement.findMany({
      where: {
        tournamentId,
        visibility: AnnouncementVisibility.PUBLIC,
        isActive: true,
      },
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async markRead(userId: string, publishedAt?: string) {
    const targetDate = publishedAt ? new Date(publishedAt) : new Date();
    if (Number.isNaN(targetDate.getTime())) {
      throw new BadRequestException('publishedAt is invalid');
    }

    await this.prisma.userSettings.upsert({
      where: { userId },
      update: { lastAnnouncementsReadAt: targetDate },
      create: {
        user: { connect: { id: userId } },
        lastAnnouncementsReadAt: targetDate,
      },
    });

    return {
      lastAnnouncementsReadAt: targetDate.toISOString(),
    };
  }

  async create(dto: CreateAnnouncementDto, createdById: string) {
    const normalized = await this.normalizeCreateDto(dto);
    return this.prisma.announcement.create({
      data: {
        ...normalized,
        createdById,
      },
    });
  }

  async update(id: string, dto: UpdateAnnouncementDto, updatedById: string) {
    const existing = await this.prisma.announcement.findUnique({
      where: { id },
      select: { id: true, audience: true, tournamentId: true, visibility: true },
    });

    if (!existing) {
      throw new NotFoundException('Announcement not found');
    }

    const normalized = await this.normalizeUpdateDto(dto, existing);
    if (Object.keys(normalized).length === 0) {
      throw new BadRequestException('No fields provided for update');
    }

    return this.prisma.announcement.update({
      where: { id },
      data: {
        ...normalized,
        updatedById,
      },
    });
  }

  private managerWhere(includeInactive: boolean, tournamentId?: string) {
    const where: Prisma.AnnouncementWhereInput = {};

    if (!includeInactive) {
      where.isActive = true;
    }

    if (tournamentId) {
      where.tournamentId = tournamentId;
    }

    return where;
  }

  private memberWhere(role: Role, userId: string, tournamentId?: string) {
    const baseWhere: Prisma.AnnouncementWhereInput = {
      isActive: true,
      visibility: AnnouncementVisibility.AUTHENTICATED,
      audience: { in: this.allowedAudiences(role) },
      ...(tournamentId ? { tournamentId } : {}),
    };

    return {
      AND: [baseWhere, this.scopedAccessWhere(role, userId)],
    } satisfies Prisma.AnnouncementWhereInput;
  }

  private scopedAccessWhere(role: Role, userId: string) {
    if (role === 'TEAM') {
      return {
        OR: [
          { tournamentId: null },
          { tournament: { teams: { some: { captainId: userId } } } },
        ],
      } satisfies Prisma.AnnouncementWhereInput;
    }

    if (role === 'JURY') {
      return {
        OR: [
          { tournamentId: null },
          { tournament: { juryMembers: { some: { userId } } } },
        ],
      } satisfies Prisma.AnnouncementWhereInput;
    }

    return { tournamentId: null } satisfies Prisma.AnnouncementWhereInput;
  }

  private allowedAudiences(role: Role): AnnouncementAudience[] {
    switch (role) {
      case 'TEAM':
        return [AnnouncementAudience.ALL, AnnouncementAudience.TEAM];
      case 'JURY':
        return [AnnouncementAudience.ALL, AnnouncementAudience.JURY];
      case 'ADMIN':
        return [AnnouncementAudience.ALL, AnnouncementAudience.ADMIN];
      case 'ORGANIZER':
        return [AnnouncementAudience.ALL, AnnouncementAudience.ORGANIZER];
      default:
        return [AnnouncementAudience.ALL];
    }
  }

  private async normalizeCreateDto(dto: CreateAnnouncementDto) {
    const tournamentId = dto.tournamentId?.trim() || null;
    const audience = dto.audience ?? AnnouncementAudience.ALL;
    const visibility = dto.visibility ?? AnnouncementVisibility.AUTHENTICATED;
    await this.validateScope(tournamentId, visibility, audience);

    return {
      tournamentId,
      title: dto.title.trim(),
      body: dto.body.trim(),
      audience,
      visibility,
      linkUrl: dto.linkUrl?.trim() || null,
      isPinned: dto.isPinned ?? false,
      isActive: dto.isActive ?? true,
    };
  }

  private async normalizeUpdateDto(
    dto: UpdateAnnouncementDto,
    existing: {
      audience: AnnouncementAudience;
      tournamentId: string | null;
      visibility: AnnouncementVisibility;
    },
  ) {
    const normalized: Record<string, unknown> = {};

    if (dto.title !== undefined) {
      normalized.title = dto.title.trim();
    }
    if (dto.body !== undefined) {
      normalized.body = dto.body.trim();
    }
    if (dto.audience !== undefined) {
      normalized.audience = dto.audience;
    }
    if (dto.visibility !== undefined) {
      normalized.visibility = dto.visibility;
    }
    if (dto.tournamentId !== undefined) {
      normalized.tournamentId = dto.tournamentId.trim() || null;
    }
    if (dto.linkUrl !== undefined) {
      normalized.linkUrl = dto.linkUrl.trim() || null;
    }
    if (dto.isPinned !== undefined) {
      normalized.isPinned = dto.isPinned;
    }
    if (dto.isActive !== undefined) {
      normalized.isActive = dto.isActive;
    }

    const nextTournamentId =
      'tournamentId' in normalized
        ? (normalized.tournamentId as string | null)
        : existing.tournamentId;
    const nextVisibility =
      'visibility' in normalized
        ? (normalized.visibility as AnnouncementVisibility)
        : existing.visibility;
    const nextAudience =
      'audience' in normalized
        ? (normalized.audience as AnnouncementAudience)
        : existing.audience;
    await this.validateScope(nextTournamentId, nextVisibility, nextAudience);

    return normalized;
  }

  private async validateScope(
    tournamentId: string | null,
    visibility: AnnouncementVisibility,
    audience: AnnouncementAudience,
  ) {
    if (visibility === AnnouncementVisibility.PUBLIC && !tournamentId) {
      throw new BadRequestException('Public announcements require a tournament');
    }

    if (visibility === AnnouncementVisibility.PUBLIC && audience !== AnnouncementAudience.ALL) {
      throw new BadRequestException('Public announcements must use ALL audience');
    }

    if (tournamentId) {
      await this.ensureTournamentExists(tournamentId);
    }
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
}
