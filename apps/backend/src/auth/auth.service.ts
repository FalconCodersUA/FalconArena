import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuditLogsService } from '../audit-logs.service';
import { Role } from '../common/constants/roles';
import { AuthUser } from '../common/types/auth-user.type';
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

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
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
