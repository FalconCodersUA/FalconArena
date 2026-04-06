import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/constants/roles';
import { AuthUser } from '../common/types/auth-user.type';
import {
  ListManagedUsersDto,
  type ManagedUserStatusFilter,
} from './dto/list-managed-users.dto';
import { UpdateManagedUserDto } from './dto/update-managed-user.dto';

type CreateUserInput = {
  email: string;
  fullName: string;
  passwordHash: string;
  role: Role;
};

const managedUserSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  isBlocked: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const MANAGED_USER_ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Адміністратор',
  TEAM: 'Команда',
  JURY: 'Журі',
  ORGANIZER: 'Організатор',
};

const MANAGED_USER_STATUS_LABELS: Record<Exclude<ManagedUserStatusFilter, 'ALL'>, string> = {
  ACTIVE: 'Активний',
  BLOCKED: 'Заблокований',
};

function toManagedUserDto(
  item: {
    id: string;
    email: string;
    fullName: string;
    role: Role;
    isBlocked: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
) {
  return {
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function escapeCsvCell(value: string) {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

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

  async listManagedUsers(filters: ListManagedUsersDto = {}) {
    const items = await this.prisma.user.findMany({
      where: this.buildManagedUsersWhere(filters),
      orderBy: [{ createdAt: 'desc' }],
      select: managedUserSelect,
    });

    return items.map(toManagedUserDto);
  }

  async exportManagedUsersCsv(filters: ListManagedUsersDto = {}) {
    const items = await this.listManagedUsers(filters);
    const rows = [
      ['ПІБ', 'Email', 'Роль', 'Статус'],
      ...items.map((item) => [
        item.fullName,
        item.email,
        MANAGED_USER_ROLE_LABELS[item.role],
        item.isBlocked
          ? MANAGED_USER_STATUS_LABELS.BLOCKED
          : MANAGED_USER_STATUS_LABELS.ACTIVE,
      ]),
    ];

    return `\uFEFF${rows
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
      .join('\n')}`;
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
      ...toManagedUserDto(updated),
    };
  }

  private buildManagedUsersWhere(filters: ListManagedUsersDto): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};
    const normalizedSearch = filters.search?.trim();

    if (normalizedSearch) {
      where.OR = [
        { fullName: { contains: normalizedSearch, mode: 'insensitive' } },
        { email: { contains: normalizedSearch, mode: 'insensitive' } },
      ];
    }

    if (filters.role && filters.role !== 'ALL') {
      where.role = filters.role;
    }

    if (filters.status === 'ACTIVE') {
      where.isBlocked = false;
    } else if (filters.status === 'BLOCKED') {
      where.isBlocked = true;
    }

    return where;
  }
}
