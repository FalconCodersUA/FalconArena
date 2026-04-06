import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditLogsService } from '../audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/constants/roles';
import { AuthUser } from '../common/types/auth-user.type';
import { UpdateManagedUserDto } from './dto/update-managed-user.dto';

type CreateUserInput = {
  email: string;
  fullName: string;
  passwordHash: string;
  role: Role;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(input: CreateUserInput) {
    return this.prisma.user.create({ data: input });
  }

  async listManagedUsers() {
    const items = await this.prisma.user.findMany({
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isBlocked: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));
  }

  async updateManagedUser(userId: string, dto: UpdateManagedUserDto, actor: AuthUser) {
    if (dto.role === undefined && dto.isBlocked === undefined) {
      throw new BadRequestException('No user management updates were provided');
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isBlocked: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (existing.id === actor.userId) {
      throw new ForbiddenException('You cannot change your own role or block your own account');
    }

    const nextRole = dto.role ?? existing.role;
    const nextBlocked = dto.isBlocked ?? existing.isBlocked;

    if (nextRole === existing.role && nextBlocked === existing.isBlocked) {
      return {
        ...existing,
        createdAt: existing.createdAt.toISOString(),
        updatedAt: existing.updatedAt.toISOString(),
      };
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        role: nextRole,
        isBlocked: nextBlocked,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isBlocked: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const changeSummary: string[] = [];
    if (existing.role !== updated.role) {
      changeSummary.push(`role ${existing.role} → ${updated.role}`);
    }
    if (existing.isBlocked !== updated.isBlocked) {
      changeSummary.push(updated.isBlocked ? 'blocked' : 'unblocked');
    }

    await this.auditLogsService.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: 'user.updated',
      entityType: 'user',
      entityId: updated.id,
      entityLabel: updated.fullName,
      title: 'Updated platform user',
      description: `${updated.fullName} (${updated.email}) was updated: ${changeSummary.join(', ')}.`,
      metadata: {
        previousRole: existing.role,
        nextRole: updated.role,
        previousIsBlocked: existing.isBlocked,
        nextIsBlocked: updated.isBlocked,
      },
    });

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
