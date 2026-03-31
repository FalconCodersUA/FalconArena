import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from './prisma/prisma.service';

type AuditLogInput = {
  actorId?: string | null;
  actorRole: Role;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  tournamentId?: string | null;
  title: string;
  description: string;
  metadata?: Prisma.InputJsonValue;
};

type AuditLogRecord = {
  id: string;
  actorId: string | null;
  actorRole: Role;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  tournamentId: string | null;
  title: string;
  description: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  actor: {
    id: string;
    email: string;
    fullName: string;
  } | null;
};

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  private get auditLogClient() {
    return this.prisma as PrismaService & {
      auditLog: {
        create: (args: {
          data: {
            actorId: string | null;
            actorRole: Role;
            action: string;
            entityType: string;
            entityId: string | null;
            entityLabel: string | null;
            tournamentId: string | null;
            title: string;
            description: string;
            metadata?: Prisma.InputJsonValue;
          };
        }) => Promise<unknown>;
        findMany: (args: unknown) => Promise<AuditLogRecord[]>;
      };
    };
  }

  async record(input: AuditLogInput) {
    return this.auditLogClient.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorRole: input.actorRole,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        entityLabel: input.entityLabel ?? null,
        tournamentId: input.tournamentId ?? null,
        title: input.title,
        description: input.description,
        metadata: input.metadata,
      },
    });
  }

  async listRecentSystemActivity(limit = 10, tournamentId?: string) {
    const items = await this.auditLogClient.auditLog.findMany({
      where: {
        ...(tournamentId ? { tournamentId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    return items.map((item: AuditLogRecord) => this.mapItem(item));
  }

  async listPersonalActivity(userId: string, limit = 10) {
    const items = await this.auditLogClient.auditLog.findMany({
      where: {
        actorId: userId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    return items.map((item: AuditLogRecord) => this.mapItem(item));
  }

  private mapItem(item: AuditLogRecord) {
    return {
      id: item.id,
      actorId: item.actorId,
      actorRole: item.actorRole,
      actorName: item.actor?.fullName ?? null,
      actorEmail: item.actor?.email ?? null,
      action: item.action,
      entityType: item.entityType,
      entityId: item.entityId,
      entityLabel: item.entityLabel,
      tournamentId: item.tournamentId,
      title: item.title,
      description: item.description,
      metadata: item.metadata ?? null,
      createdAt: item.createdAt.toISOString(),
    };
  }
}
