import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorReportsService } from './error-reports.service';
import { PrismaService } from './prisma/prisma.service';

describe('ErrorReportsService', () => {
  let prisma: PrismaService;
  let service: ErrorReportsService;

  beforeEach(() => {
    prisma = {
      errorReport: {
        create: vi.fn(async ({ data }) => ({ id: 'err-1', ...data })),
        findMany: vi.fn(async () => [
          {
            id: 'err-2',
            requestId: 'req-2',
            method: 'GET',
            path: '/health',
            statusCode: 500,
            message: 'boom',
            stack: null,
            userId: null,
            userRole: null,
            userEmail: null,
            createdAt: new Date('2026-03-31T10:00:00.000Z'),
          },
        ]),
      },
    } as unknown as PrismaService;

    service = new ErrorReportsService(prisma);
  });

  it('creates a persisted error report entry', async () => {
    const result = await service.create({
      requestId: 'req-1',
      method: 'POST',
      path: '/auth/login',
      statusCode: 500,
      message: 'Unhandled backend error',
      stack: 'stack',
      userId: 'user-1',
      userRole: 'ADMIN',
      userEmail: 'admin@falconarena.live',
    });

    expect(prisma.errorReport.create).toHaveBeenCalledTimes(1);
    expect(result.requestId).toBe('req-1');
    expect(result.userRole).toBe('ADMIN');
  });

  it('returns recent reports with bounded take', async () => {
    const rows = await service.getRecent(999);

    expect(prisma.errorReport.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    expect(rows).toHaveLength(1);
  });
});
