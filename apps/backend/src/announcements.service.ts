import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AnnouncementAudience } from '@prisma/client';
import { Role } from './common/constants/roles';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './announcements.dto';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForRole(role: Role, userId: string, includeInactive = false) {
    const isManager = role === 'ADMIN' || role === 'ORGANIZER';

    const where = isManager
      ? includeInactive
        ? {}
        : { isActive: true }
      : {
          isActive: true,
          audience: { in: this.allowedAudiences(role) },
        };

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
    const normalized = this.normalizeCreateDto(dto);
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
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Announcement not found');
    }

    const normalized = this.normalizeUpdateDto(dto);
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

  private normalizeCreateDto(dto: CreateAnnouncementDto) {
    return {
      title: dto.title.trim(),
      body: dto.body.trim(),
      audience: dto.audience ?? AnnouncementAudience.ALL,
      linkUrl: dto.linkUrl?.trim() || null,
      isPinned: dto.isPinned ?? false,
      isActive: dto.isActive ?? true,
    };
  }

  private normalizeUpdateDto(dto: UpdateAnnouncementDto) {
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
    if (dto.linkUrl !== undefined) {
      normalized.linkUrl = dto.linkUrl.trim();
    }
    if (dto.isPinned !== undefined) {
      normalized.isPinned = dto.isPinned;
    }
    if (dto.isActive !== undefined) {
      normalized.isActive = dto.isActive;
    }

    return normalized;
  }
}
