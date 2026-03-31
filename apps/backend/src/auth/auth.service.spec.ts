import { ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

function createUsersServiceMock() {
  return {
    findByEmail: vi.fn(),
    create: vi.fn(),
  };
}

function createJwtServiceMock() {
  return {
    sign: vi.fn().mockReturnValue('token'),
  };
}

function createAuditLogsServiceMock() {
  return {
    record: vi.fn().mockResolvedValue(undefined),
  };
}

describe('AuthService', () => {
  it('blocks organizer from creating admin users', async () => {
    const usersService = createUsersServiceMock();
    const service = new AuthService(
      usersService as never,
      createJwtServiceMock() as never,
      createAuditLogsServiceMock() as never,
    );

    await expect(
      service.createUserByAdmin(
        {
          email: 'new-admin@example.com',
          fullName: 'New Admin',
          password: 'StrongPass123!',
          role: 'ADMIN',
        },
        {
          userId: 'organizer-1',
          role: 'ORGANIZER',
          email: 'organizer@example.com',
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(usersService.findByEmail).not.toHaveBeenCalled();
    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('prevents creating a duplicate user by email', async () => {
    const usersService = createUsersServiceMock();
    usersService.findByEmail.mockResolvedValue({
      id: 'existing-user',
      email: 'jury@example.com',
    });

    const service = new AuthService(
      usersService as never,
      createJwtServiceMock() as never,
      createAuditLogsServiceMock() as never,
    );

    await expect(
      service.createUserByAdmin(
        {
          email: 'jury@example.com',
          fullName: 'Jury User',
          password: 'StrongPass123!',
          role: 'JURY',
        },
        {
          userId: 'admin-1',
          role: 'ADMIN',
          email: 'admin@example.com',
        },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
