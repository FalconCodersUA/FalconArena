import {
  ForbiddenException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { UsersService } from './users.service';

function createPrismaMock() {
  return {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

function createAuditLogsMock() {
  return {
    record: vi.fn().mockResolvedValue(undefined),
  };
}

describe('UsersService', () => {
  it('lists managed users with ISO timestamps', async () => {
    const prisma = createPrismaMock();
    const auditLogs = createAuditLogsMock();
    const createdAt = new Date('2026-04-07T08:00:00.000Z');
    const updatedAt = new Date('2026-04-07T09:00:00.000Z');
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        email: 'team@example.com',
        fullName: 'Team Captain',
        role: 'TEAM',
        isBlocked: false,
        createdAt,
        updatedAt,
      },
    ]);

    const service = new UsersService(prisma as never, auditLogs as never);

    await expect(service.listManagedUsers()).resolves.toEqual([
      {
        id: 'user-1',
        email: 'team@example.com',
        fullName: 'Team Captain',
        role: 'TEAM',
        isBlocked: false,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      },
    ]);
  });

  it('prevents changing your own role or block state', async () => {
    const prisma = createPrismaMock();
    const auditLogs = createAuditLogsMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      fullName: 'Admin',
      role: 'ADMIN',
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new UsersService(prisma as never, auditLogs as never);

    await expect(
      service.updateManagedUser(
        'admin-1',
        { role: 'JURY' },
        { userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updates role and block state and records an audit log', async () => {
    const prisma = createPrismaMock();
    const auditLogs = createAuditLogsMock();
    const createdAt = new Date('2026-04-07T08:00:00.000Z');
    const updatedAt = new Date('2026-04-07T09:15:00.000Z');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'jury@example.com',
      fullName: 'Jury User',
      role: 'JURY',
      isBlocked: false,
      createdAt,
      updatedAt: createdAt,
    });
    prisma.user.update.mockResolvedValue({
      id: 'user-2',
      email: 'jury@example.com',
      fullName: 'Jury User',
      role: 'ORGANIZER',
      isBlocked: true,
      createdAt,
      updatedAt,
    });

    const service = new UsersService(prisma as never, auditLogs as never);

    await expect(
      service.updateManagedUser(
        'user-2',
        { role: 'ORGANIZER', isBlocked: true },
        { userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' },
      ),
    ).resolves.toEqual({
      id: 'user-2',
      email: 'jury@example.com',
      fullName: 'Jury User',
      role: 'ORGANIZER',
      isBlocked: true,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });

    expect(auditLogs.record).toHaveBeenCalledTimes(1);
  });
});
