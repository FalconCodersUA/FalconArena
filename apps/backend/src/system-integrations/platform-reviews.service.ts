import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PlatformReviewStatus } from '@prisma/client';
import { AuditLogsService } from '../audit-logs.service';
import { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlatformReviewDto } from './dto/create-platform-review.dto';
import { ListPlatformReviewsDto } from './dto/list-platform-reviews.dto';
import { UpdatePlatformReviewStatusDto } from './dto/update-platform-review-status.dto';

type PlatformReviewRecord = {
  id: string;
  text: string;
  status: PlatformReviewStatus;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    fullName: string;
    email?: string;
    role: 'ADMIN' | 'TEAM' | 'JURY' | 'ORGANIZER';
  };
  moderator?: {
    id: string;
    fullName: string;
    email?: string;
  } | null;
};

@Injectable()
export class PlatformReviewsService {
  private static readonly publicReviewLimit = 6;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async listPublicReviews() {
    const reviews = await this.prisma.platformReview.findMany({
      where: { status: PlatformReviewStatus.APPROVED },
      orderBy: [{ reviewedAt: 'desc' }, { updatedAt: 'desc' }],
      take: PlatformReviewsService.publicReviewLimit,
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
      },
    });

    return reviews.map((review) => this.mapPublicReview(review));
  }

  async submitReview(dto: CreatePlatformReviewDto, actor: AuthUser) {
    const text = dto.text.trim();
    if (text.length < 10) {
      throw new BadRequestException('Review text is too short');
    }

    const review = await this.prisma.platformReview.upsert({
      where: { authorId: actor.userId },
      create: {
        authorId: actor.userId,
        text,
        status: PlatformReviewStatus.PENDING,
      },
      update: {
        text,
        status: PlatformReviewStatus.PENDING,
        moderatorId: null,
        reviewedAt: null,
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
      },
    });

    await this.auditLogsService.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: 'platform_review.submitted',
      entityType: 'platform_review',
      entityId: review.id,
      entityLabel: review.author.fullName,
      title: 'Submitted About page review',
      description: 'A user submitted a review for About page moderation.',
      metadata: {
        status: review.status,
        textLength: text.length,
      },
    });

    return this.mapOwnReview(review);
  }

  async listAdminReviews(query: ListPlatformReviewsDto = {}) {
    const reviews = await this.prisma.platformReview.findMany({
      where: query.status ? { status: query.status } : {},
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        moderator: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    return reviews.map((review) => this.mapAdminReview(review));
  }

  async moderateReview(
    reviewId: string,
    dto: UpdatePlatformReviewStatusDto,
    actor: AuthUser,
  ) {
    const existing = await this.prisma.platformReview.findUnique({
      where: { id: reviewId },
      select: { id: true, author: { select: { fullName: true } } },
    });

    if (!existing) {
      throw new NotFoundException('Platform review not found');
    }

    const reviewedAt = new Date();
    const review = await this.prisma.platformReview.update({
      where: { id: reviewId },
      data: {
        status: dto.status,
        moderatorId: actor.userId,
        reviewedAt,
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        moderator: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    await this.auditLogsService.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: 'platform_review.moderated',
      entityType: 'platform_review',
      entityId: review.id,
      entityLabel: existing.author.fullName,
      title: 'Moderated About page review',
      description: `About page review was marked as ${dto.status}.`,
      metadata: {
        status: dto.status,
        authorId: review.author.id,
      },
    });

    return this.mapAdminReview(review);
  }

  private mapPublicReview(review: PlatformReviewRecord) {
    return {
      id: review.id,
      text: review.text,
      authorName: review.author.fullName,
      authorRole: review.author.role,
      reviewedAt: review.reviewedAt?.toISOString() ?? null,
      createdAt: review.createdAt.toISOString(),
    };
  }

  private mapOwnReview(review: PlatformReviewRecord) {
    return {
      id: review.id,
      text: review.text,
      status: review.status,
      authorName: review.author.fullName,
      authorRole: review.author.role,
      reviewedAt: review.reviewedAt?.toISOString() ?? null,
      updatedAt: review.updatedAt.toISOString(),
    };
  }

  private mapAdminReview(review: PlatformReviewRecord) {
    return {
      id: review.id,
      text: review.text,
      status: review.status,
      author: {
        id: review.author.id,
        fullName: review.author.fullName,
        email: review.author.email ?? null,
        role: review.author.role,
      },
      moderator: review.moderator
        ? {
            id: review.moderator.id,
            fullName: review.moderator.fullName,
            email: review.moderator.email ?? null,
          }
        : null,
      reviewedAt: review.reviewedAt?.toISOString() ?? null,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
    };
  }
}
