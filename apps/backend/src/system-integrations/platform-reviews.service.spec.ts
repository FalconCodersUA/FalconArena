import { NotFoundException } from '@nestjs/common';
import { PlatformReviewStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PlatformReviewsService } from './platform-reviews.service';

function createPrismaMock() {
  return {
    platformReview: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
}

function createAuditLogsMock() {
  return {
    record: vi.fn().mockResolvedValue(undefined),
  };
}

function createReview(overrides: Record<string, unknown> = {}) {
  const createdAt = new Date('2026-04-21T08:00:00.000Z');
  const updatedAt = new Date('2026-04-21T09:00:00.000Z');
  const reviewedAt = new Date('2026-04-21T09:05:00.000Z');

  return {
    id: 'review-1',
    text: 'FalconArena keeps tournament work clear for our team.',
    status: PlatformReviewStatus.APPROVED,
    reviewedAt,
    createdAt,
    updatedAt,
    author: {
      id: 'user-1',
      fullName: 'Team Captain',
      email: 'team@example.com',
      role: 'TEAM',
    },
    moderator: {
      id: 'admin-1',
      fullName: 'Admin User',
      email: 'admin@example.com',
    },
    ...overrides,
  };
}

describe('PlatformReviewsService', () => {
  it('lists only approved public reviews without private author fields', async () => {
    const prisma = createPrismaMock();
    const auditLogs = createAuditLogsMock();
    const review = createReview();
    prisma.platformReview.findMany.mockResolvedValue([review]);
    const service = new PlatformReviewsService(prisma as never, auditLogs as never);

    await expect(service.listPublicReviews()).resolves.toEqual([
      {
        id: 'review-1',
        text: 'FalconArena keeps tournament work clear for our team.',
        authorName: 'Team Captain',
        authorRole: 'TEAM',
        reviewedAt: '2026-04-21T09:05:00.000Z',
        createdAt: '2026-04-21T08:00:00.000Z',
      },
    ]);

    expect(prisma.platformReview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: PlatformReviewStatus.APPROVED },
        take: 6,
      }),
    );
  });

  it('upserts a user review as pending and records an audit log', async () => {
    const prisma = createPrismaMock();
    const auditLogs = createAuditLogsMock();
    const review = createReview({
      status: PlatformReviewStatus.PENDING,
      reviewedAt: null,
      moderator: null,
    });
    prisma.platformReview.upsert.mockResolvedValue(review);
    const service = new PlatformReviewsService(prisma as never, auditLogs as never);

    await expect(
      service.submitReview(
        { text: ' FalconArena keeps tournament work clear for our team. ' },
        { userId: 'user-1', email: 'team@example.com', role: 'TEAM' },
      ),
    ).resolves.toMatchObject({
      id: 'review-1',
      status: PlatformReviewStatus.PENDING,
      authorName: 'Team Captain',
    });

    expect(prisma.platformReview.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authorId: 'user-1' },
        create: expect.objectContaining({
          text: 'FalconArena keeps tournament work clear for our team.',
          status: PlatformReviewStatus.PENDING,
        }),
        update: expect.objectContaining({
          text: 'FalconArena keeps tournament work clear for our team.',
          status: PlatformReviewStatus.PENDING,
          moderatorId: null,
          reviewedAt: null,
        }),
      }),
    );
    expect(auditLogs.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'platform_review.submitted',
        entityType: 'platform_review',
      }),
    );
  });

  it('moderates an existing review and records the decision', async () => {
    const prisma = createPrismaMock();
    const auditLogs = createAuditLogsMock();
    prisma.platformReview.findUnique.mockResolvedValue({
      id: 'review-1',
      author: { fullName: 'Team Captain' },
    });
    prisma.platformReview.update.mockResolvedValue(
      createReview({ status: PlatformReviewStatus.REJECTED }),
    );
    const service = new PlatformReviewsService(prisma as never, auditLogs as never);

    await expect(
      service.moderateReview(
        'review-1',
        { status: PlatformReviewStatus.REJECTED },
        { userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' },
      ),
    ).resolves.toMatchObject({
      id: 'review-1',
      status: PlatformReviewStatus.REJECTED,
      moderator: { fullName: 'Admin User' },
    });

    expect(prisma.platformReview.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'review-1' },
        data: expect.objectContaining({
          status: PlatformReviewStatus.REJECTED,
          moderatorId: 'admin-1',
        }),
      }),
    );
    expect(auditLogs.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'platform_review.moderated',
        metadata: expect.objectContaining({ status: PlatformReviewStatus.REJECTED }),
      }),
    );
  });

  it('throws when moderating a missing review', async () => {
    const prisma = createPrismaMock();
    const auditLogs = createAuditLogsMock();
    prisma.platformReview.findUnique.mockResolvedValue(null);
    const service = new PlatformReviewsService(prisma as never, auditLogs as never);

    await expect(
      service.moderateReview(
        'missing-review',
        { status: PlatformReviewStatus.APPROVED },
        { userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
