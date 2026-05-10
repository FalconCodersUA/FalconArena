import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
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
  it('lists managed users with ISO timestamps and filter-aware where clause', async () => {
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
        blockedReason: null,
        blockedAt: null,
        blockedBy: null,
        createdAt,
        updatedAt,
      },
    ]);

    const service = new UsersService(prisma as never, auditLogs as never);

    await expect(
      service.listManagedUsers({
        search: 'captain',
        role: 'TEAM',
        status: 'ACTIVE',
      }),
    ).resolves.toEqual([
      {
        id: 'user-1',
        email: 'team@example.com',
        fullName: 'Team Captain',
        role: 'TEAM',
        isBlocked: false,
        blockedReason: null,
        blockedAt: null,
        blockedByUserId: null,
        blockedByUserName: null,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      },
    ]);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { fullName: { contains: 'captain', mode: 'insensitive' } },
            { email: { contains: 'captain', mode: 'insensitive' } },
          ],
          role: 'TEAM',
          isBlocked: false,
        },
      }),
    );
  });

  it('exports managed users as CSV with headers and localized values', async () => {
    const prisma = createPrismaMock();
    const auditLogs = createAuditLogsMock();
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'user-3',
        email: 'organizer@example.com',
        fullName: 'Організатор Demo',
        role: 'ORGANIZER',
        isBlocked: true,
        blockedReason: null,
        blockedAt: null,
        blockedBy: null,
        createdAt: new Date('2026-04-07T08:00:00.000Z'),
        updatedAt: new Date('2026-04-07T09:00:00.000Z'),
      },
    ]);

    const service = new UsersService(prisma as never, auditLogs as never);

    await expect(service.exportManagedUsersCsv({ status: 'BLOCKED' })).resolves.toBe(
      '\uFEFFПІБ,Email,Роль,Статус\nОрганізатор Demo,organizer@example.com,Організатор,Заблокований',
    );
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
      blockedReason: null,
      blockedAt: null,
      blockedBy: null,
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

  it('prevents resetting your own password from user management', async () => {
    const prisma = createPrismaMock();
    const auditLogs = createAuditLogsMock();
    const service = new UsersService(prisma as never, auditLogs as never);

    await expect(
      service.resetManagedUserPassword(
        'admin-1',
        { password: 'StrongPass123!' },
        { userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('resets a managed user password and records an audit log', async () => {
    const prisma = createPrismaMock();
    const auditLogs = createAuditLogsMock();
    const createdAt = new Date('2026-04-07T08:00:00.000Z');
    const updatedAt = new Date('2026-04-07T09:15:00.000Z');
    prisma.user.findUnique.mockResolvedValue({
      id: 'team-1',
      email: 'team@example.com',
      fullName: 'Team Captain',
      role: 'TEAM',
      isBlocked: false,
      blockedReason: null,
      blockedAt: null,
      blockedBy: null,
      createdAt,
      updatedAt: createdAt,
    });
    prisma.user.update.mockImplementation(async (args) => ({
      id: 'team-1',
      email: 'team@example.com',
      fullName: 'Team Captain',
      role: 'TEAM',
      isBlocked: false,
      blockedReason: null,
      blockedAt: null,
      blockedBy: null,
      createdAt,
      updatedAt,
    }));

    const service = new UsersService(prisma as never, auditLogs as never);

    await expect(
      service.resetManagedUserPassword(
        'team-1',
        { password: 'StrongPass123!' },
        { userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' },
      ),
    ).resolves.toEqual({
      id: 'team-1',
      email: 'team@example.com',
      fullName: 'Team Captain',
      role: 'TEAM',
      isBlocked: false,
      blockedReason: null,
      blockedAt: null,
      blockedByUserId: null,
      blockedByUserName: null,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });

    const updateCall = prisma.user.update.mock.calls[0]?.[0];
    expect(updateCall.where).toEqual({ id: 'team-1' });
    await expect(
      bcrypt.compare('StrongPass123!', updateCall.data.passwordHash),
    ).resolves.toBe(true);
    expect(auditLogs.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user.password_reset',
        entityId: 'team-1',
      }),
    );
  });

  it('requires a blocking reason when blocking a user', async () => {
    const prisma = createPrismaMock();
    const auditLogs = createAuditLogsMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'jury@example.com',
      fullName: 'Jury User',
      role: 'JURY',
      isBlocked: false,
      blockedReason: null,
      blockedAt: null,
      blockedBy: null,
      createdAt: new Date('2026-04-07T08:00:00.000Z'),
      updatedAt: new Date('2026-04-07T08:00:00.000Z'),
    });

    const service = new UsersService(prisma as never, auditLogs as never);

    await expect(
      service.updateManagedUser(
        'user-2',
        { isBlocked: true },
        { userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
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
      blockedReason: null,
      blockedAt: null,
      blockedBy: null,
      createdAt,
      updatedAt: createdAt,
    });
    prisma.user.update.mockResolvedValue({
      id: 'user-2',
      email: 'jury@example.com',
      fullName: 'Jury User',
      role: 'ORGANIZER',
      isBlocked: true,
      blockedReason: 'Duplicate submissions abuse',
      blockedAt: updatedAt,
      blockedBy: { id: 'admin-1', fullName: 'Admin User' },
      createdAt,
      updatedAt,
    });

    const service = new UsersService(prisma as never, auditLogs as never);

    await expect(
      service.updateManagedUser(
        'user-2',
        {
          role: 'ORGANIZER',
          isBlocked: true,
          blockedReason: 'Duplicate submissions abuse',
        },
        { userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' },
      ),
    ).resolves.toEqual({
      id: 'user-2',
      email: 'jury@example.com',
      fullName: 'Jury User',
      role: 'ORGANIZER',
      isBlocked: true,
      blockedReason: 'Duplicate submissions abuse',
      blockedAt: updatedAt.toISOString(),
      blockedByUserId: 'admin-1',
      blockedByUserName: 'Admin User',
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });

    expect(auditLogs.record).toHaveBeenCalledTimes(1);
  });

  it('preserves last blocking metadata after unblocking', async () => {
    const prisma = createPrismaMock();
    const auditLogs = createAuditLogsMock();
    const createdAt = new Date('2026-04-07T08:00:00.000Z');
    const blockedAt = new Date('2026-04-07T09:15:00.000Z');
    const updatedAt = new Date('2026-04-07T10:00:00.000Z');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'jury@example.com',
      fullName: 'Jury User',
      role: 'JURY',
      isBlocked: true,
      blockedReason: 'Duplicate submissions abuse',
      blockedAt,
      blockedBy: { id: 'admin-1', fullName: 'Admin User' },
      createdAt,
      updatedAt: blockedAt,
    });
    prisma.user.update.mockResolvedValue({
      id: 'user-2',
      email: 'jury@example.com',
      fullName: 'Jury User',
      role: 'JURY',
      isBlocked: false,
      blockedReason: 'Duplicate submissions abuse',
      blockedAt,
      blockedBy: { id: 'admin-1', fullName: 'Admin User' },
      createdAt,
      updatedAt,
    });

    const service = new UsersService(prisma as never, auditLogs as never);

    await expect(
      service.updateManagedUser(
        'user-2',
        { isBlocked: false },
        { userId: 'admin-2', email: 'owner@example.com', role: 'ADMIN' },
      ),
    ).resolves.toEqual({
      id: 'user-2',
      email: 'jury@example.com',
      fullName: 'Jury User',
      role: 'JURY',
      isBlocked: false,
      blockedReason: 'Duplicate submissions abuse',
      blockedAt: blockedAt.toISOString(),
      blockedByUserId: 'admin-1',
      blockedByUserName: 'Admin User',
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  });
});
