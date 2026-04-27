import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { OAuthProvider } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

function createUsersServiceMock() {
  return {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  };
}

function createJwtServiceMock() {
  return {
    sign: vi.fn().mockReturnValue('token'),
  };
}

function createPrismaServiceMock() {
  return {
    userOAuthAccount: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    user: {
      create: vi.fn(),
    },
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
      createPrismaServiceMock() as never,
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
      createPrismaServiceMock() as never,
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

  it('blocks login for a blocked user account', async () => {
    const usersService = createUsersServiceMock();
    usersService.findByEmail.mockResolvedValue({
      id: 'blocked-user',
      email: 'blocked@example.com',
      passwordHash: 'hash',
      isBlocked: true,
    });

    const service = new AuthService(
      usersService as never,
      createPrismaServiceMock() as never,
      createJwtServiceMock() as never,
      createAuditLogsServiceMock() as never,
    );

    await expect(
      service.login({
        email: 'blocked@example.com',
        password: 'StrongPass123!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('creates a TEAM account for a new Google OAuth user', async () => {
    const usersService = createUsersServiceMock();
    usersService.findByEmail.mockResolvedValue(null);
    const prisma = createPrismaServiceMock();
    prisma.userOAuthAccount.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'oauth-user-1',
      email: 'team@example.com',
      fullName: 'Team User',
      role: 'TEAM',
    });

    const service = new AuthService(
      usersService as never,
      prisma as never,
      createJwtServiceMock() as never,
      createAuditLogsServiceMock() as never,
    );
    vi.spyOn(service as never, 'resolveGoogleProfile').mockResolvedValue({
      provider: OAuthProvider.GOOGLE,
      providerUserId: 'google-1',
      email: 'team@example.com',
      fullName: 'Team User',
    });

    const result = await service.completeOAuthLogin(OAuthProvider.GOOGLE, 'code');

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'team@example.com',
        fullName: 'Team User',
        role: 'TEAM',
        oauthAccounts: {
          create: {
            provider: OAuthProvider.GOOGLE,
            providerUserId: 'google-1',
            email: 'team@example.com',
          },
        },
      }),
    });
    expect(result.user.role).toBe('TEAM');
    expect(result.accessToken).toBe('token');
  });

  it('links OAuth provider to an existing email account', async () => {
    const usersService = createUsersServiceMock();
    usersService.findByEmail.mockResolvedValue({
      id: 'existing-user',
      email: 'team@example.com',
      fullName: 'Existing Team',
      role: 'TEAM',
      isBlocked: false,
    });
    const prisma = createPrismaServiceMock();
    prisma.userOAuthAccount.findUnique.mockResolvedValue(null);

    const service = new AuthService(
      usersService as never,
      prisma as never,
      createJwtServiceMock() as never,
      createAuditLogsServiceMock() as never,
    );
    vi.spyOn(service as never, 'resolveGitHubProfile').mockResolvedValue({
      provider: OAuthProvider.GITHUB,
      providerUserId: 'github-1',
      email: 'team@example.com',
      fullName: 'GitHub Team',
    });

    const result = await service.completeOAuthLogin(OAuthProvider.GITHUB, 'code');

    expect(prisma.userOAuthAccount.upsert).toHaveBeenCalledWith({
      where: {
        userId_provider: {
          userId: 'existing-user',
          provider: OAuthProvider.GITHUB,
        },
      },
      update: {
        providerUserId: 'github-1',
        email: 'team@example.com',
      },
      create: {
        userId: 'existing-user',
        provider: OAuthProvider.GITHUB,
        providerUserId: 'github-1',
        email: 'team@example.com',
      },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(result.user.id).toBe('existing-user');
  });

  it('blocks OAuth login for a blocked linked account', async () => {
    const usersService = createUsersServiceMock();
    const prisma = createPrismaServiceMock();
    prisma.userOAuthAccount.findUnique.mockResolvedValue({
      user: {
        id: 'blocked-user',
        email: 'blocked@example.com',
        fullName: 'Blocked User',
        role: 'TEAM',
        isBlocked: true,
      },
    });

    const service = new AuthService(
      usersService as never,
      prisma as never,
      createJwtServiceMock() as never,
      createAuditLogsServiceMock() as never,
    );
    vi.spyOn(service as never, 'resolveGoogleProfile').mockResolvedValue({
      provider: OAuthProvider.GOOGLE,
      providerUserId: 'google-1',
      email: 'blocked@example.com',
      fullName: 'Blocked User',
    });

    await expect(
      service.completeOAuthLogin(OAuthProvider.GOOGLE, 'code'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
