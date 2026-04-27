import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuthProvider } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { AuditLogsService } from '../audit-logs.service';
import { Role } from '../common/constants/roles';
import { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateUserByAdminDto } from './dto/create-user-by-admin.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './types/jwt-payload.type';

type AuthResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: Role;
  };
};

type OAuthProfile = {
  provider: OAuthProvider;
  providerUserId: string;
  email: string;
  fullName: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfoResponse = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

type GitHubTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GitHubUserResponse = {
  id?: number;
  name?: string | null;
  login?: string;
};

type GitHubEmailResponse = {
  email?: string;
  primary?: boolean;
  verified?: boolean;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      email: dto.email,
      fullName: dto.fullName,
      passwordHash,
      role: 'TEAM',
    });

    return this.createAuthResponse(user.id, user.email, user.fullName, user.role);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.isBlocked) {
      throw new UnauthorizedException('Account is blocked');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.createAuthResponse(user.id, user.email, user.fullName, user.role);
  }

  async me(userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.isBlocked) {
      throw new UnauthorizedException('Account is blocked');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  async createUserByAdmin(dto: CreateUserByAdminDto, actor: AuthUser) {
    if (actor.role === 'ORGANIZER' && dto.role === 'ADMIN') {
      throw new ForbiddenException('Organizer cannot create admin users');
    }

    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      email: dto.email,
      fullName: dto.fullName,
      passwordHash,
      role: dto.role,
    });

    await this.auditLogsService.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: 'user.created',
      entityType: 'user',
      entityId: user.id,
      entityLabel: user.fullName,
      title: 'Created platform user',
      description: `${user.fullName} (${user.email}) was created with role ${user.role}.`,
      metadata: {
        email: user.email,
        role: user.role,
      },
    });

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  getOAuthAuthorizationUrl(provider: OAuthProvider) {
    if (provider === OAuthProvider.GOOGLE) {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const callbackUrl = process.env.GOOGLE_CALLBACK_URL;
      if (!clientId || !callbackUrl) {
        throw new UnauthorizedException('Google OAuth is not configured');
      }

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callbackUrl,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'select_account',
      });

      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const callbackUrl = process.env.GITHUB_CALLBACK_URL;
    if (!clientId || !callbackUrl) {
      throw new UnauthorizedException('GitHub OAuth is not configured');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: 'read:user user:email',
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async completeOAuthLogin(provider: OAuthProvider, code: string) {
    const profile =
      provider === OAuthProvider.GOOGLE
        ? await this.resolveGoogleProfile(code)
        : await this.resolveGitHubProfile(code);

    const user = await this.findOrCreateOAuthUser(profile);
    return this.createAuthResponse(user.id, user.email, user.fullName, user.role);
  }

  buildOAuthSuccessRedirect(authResponse: AuthResponse) {
    const url = new URL(
      process.env.FRONTEND_OAUTH_SUCCESS_URL ??
        'https://falconarena.live/app/oauth/callback',
    );
    url.searchParams.set('accessToken', authResponse.accessToken);
    url.searchParams.set('user', JSON.stringify(authResponse.user));

    return url.toString();
  }

  buildOAuthFailureRedirect(error: string) {
    const url = new URL(
      process.env.FRONTEND_OAUTH_FAILURE_URL ??
        'https://falconarena.live/app/oauth/callback',
    );
    url.searchParams.set('error', error);

    return url.toString();
  }

  private async resolveGoogleProfile(code: string): Promise<OAuthProfile> {
    const token = await this.fetchJson<GoogleTokenResponse>(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: this.requireEnv('GOOGLE_CLIENT_ID'),
          client_secret: this.requireEnv('GOOGLE_CLIENT_SECRET'),
          redirect_uri: this.requireEnv('GOOGLE_CALLBACK_URL'),
          grant_type: 'authorization_code',
        }),
      },
    );

    if (!token.access_token) {
      throw new UnauthorizedException(
        token.error_description ?? token.error ?? 'Google OAuth token exchange failed',
      );
    }

    const userInfo = await this.fetchJson<GoogleUserInfoResponse>(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
        },
      },
    );

    if (!userInfo.sub || !userInfo.email || userInfo.email_verified !== true) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    return {
      provider: OAuthProvider.GOOGLE,
      providerUserId: userInfo.sub,
      email: userInfo.email.toLowerCase(),
      fullName: this.normalizeOAuthName(userInfo.name, userInfo.email),
    };
  }

  private async resolveGitHubProfile(code: string): Promise<OAuthProfile> {
    const token = await this.fetchJson<GitHubTokenResponse>(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: this.requireEnv('GITHUB_CLIENT_ID'),
          client_secret: this.requireEnv('GITHUB_CLIENT_SECRET'),
          redirect_uri: this.requireEnv('GITHUB_CALLBACK_URL'),
        }),
      },
    );

    if (!token.access_token) {
      throw new UnauthorizedException(
        token.error_description ?? token.error ?? 'GitHub OAuth token exchange failed',
      );
    }

    const [user, emails] = await Promise.all([
      this.fetchJson<GitHubUserResponse>('https://api.github.com/user', {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token.access_token}`,
          'User-Agent': 'FalconArena',
        },
      }),
      this.fetchJson<GitHubEmailResponse[]>('https://api.github.com/user/emails', {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token.access_token}`,
          'User-Agent': 'FalconArena',
        },
      }),
    ]);

    const primaryEmail = emails.find((item) => item.primary && item.verified)?.email;
    if (!user.id || !primaryEmail) {
      throw new UnauthorizedException('GitHub account verified email is not available');
    }

    return {
      provider: OAuthProvider.GITHUB,
      providerUserId: String(user.id),
      email: primaryEmail.toLowerCase(),
      fullName: this.normalizeOAuthName(user.name ?? user.login, primaryEmail),
    };
  }

  private async findOrCreateOAuthUser(profile: OAuthProfile) {
    const existingOAuthAccount = await this.prisma.userOAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: profile.provider,
          providerUserId: profile.providerUserId,
        },
      },
      include: { user: true },
    });

    if (existingOAuthAccount) {
      if (existingOAuthAccount.user.isBlocked) {
        throw new UnauthorizedException('Account is blocked');
      }

      return existingOAuthAccount.user;
    }

    const existingUser = await this.usersService.findByEmail(profile.email);
    if (existingUser) {
      if (existingUser.isBlocked) {
        throw new UnauthorizedException('Account is blocked');
      }

      await this.prisma.userOAuthAccount.upsert({
        where: {
          userId_provider: {
            userId: existingUser.id,
            provider: profile.provider,
          },
        },
        update: {
          providerUserId: profile.providerUserId,
          email: profile.email,
        },
        create: {
          userId: existingUser.id,
          provider: profile.provider,
          providerUserId: profile.providerUserId,
          email: profile.email,
        },
      });

      return existingUser;
    }

    const passwordHash = await bcrypt.hash(`oauth:${randomUUID()}`, 10);
    const createdUser = await this.prisma.user.create({
      data: {
        email: profile.email,
        fullName: profile.fullName,
        passwordHash,
        role: 'TEAM',
        oauthAccounts: {
          create: {
            provider: profile.provider,
            providerUserId: profile.providerUserId,
            email: profile.email,
          },
        },
      },
    });

    await this.auditLogsService.record({
      actorId: createdUser.id,
      actorRole: createdUser.role,
      action: 'user.oauth_registered',
      entityType: 'user',
      entityId: createdUser.id,
      entityLabel: createdUser.fullName,
      title: 'Registered platform user with OAuth',
      description: `${createdUser.fullName} (${createdUser.email}) registered with ${profile.provider}.`,
      metadata: {
        email: createdUser.email,
        provider: profile.provider,
        role: createdUser.role,
      },
    });

    return createdUser;
  }

  private normalizeOAuthName(name: string | null | undefined, email: string) {
    const normalizedName = name?.trim();
    if (normalizedName) {
      return normalizedName;
    }

    return email.split('@')[0] || 'FalconArena User';
  }

  private requireEnv(name: string) {
    const value = process.env[name];
    if (!value) {
      throw new UnauthorizedException(`${name} is not configured`);
    }

    return value;
  }

  private async fetchJson<T>(url: string, init: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const payload = (await response.json()) as unknown;

    if (!response.ok) {
      const message =
        payload && typeof payload === 'object' && 'error_description' in payload
          ? String((payload as { error_description: unknown }).error_description)
          : `OAuth provider request failed with status ${response.status}`;
      throw new UnauthorizedException(message);
    }

    return payload as T;
  }

  private createAuthResponse(
    id: string,
    email: string,
    fullName: string,
    role: Role,
  ): AuthResponse {
    const payload: JwtPayload = { sub: id, email, role };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id,
        email,
        fullName,
        role,
      },
    };
  }
}
