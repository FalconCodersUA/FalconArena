import { Injectable } from '@nestjs/common';
import {
  NotificationAudience,
  NotificationType,
  Role,
} from '@prisma/client';
import { PrismaService } from './prisma/prisma.service';

type CreateNotificationInput = {
  type: NotificationType;
  title: string;
  body: string;
  audience?: Exclude<NotificationAudience, 'USER'>;
  userId?: string;
  linkUrl?: string;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateNotificationInput) {
    const audience =
      input.userId && !input.audience ? NotificationAudience.USER : input.audience ?? NotificationAudience.ALL;

    return this.prisma.notification.create({
      data: {
        type: input.type,
        audience,
        userId: input.userId,
        title: input.title,
        body: input.body,
        linkUrl: input.linkUrl,
      },
    });
  }

  async listForUser(userId: string, role: Role) {
    const notifications = await this.prisma.notification.findMany({
      where: {
        OR: [
          { audience: NotificationAudience.ALL },
          { audience: role as NotificationAudience },
          {
            audience: NotificationAudience.USER,
            userId,
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: {
        readStates: {
          where: { userId },
          select: { readAt: true },
          take: 1,
        },
      },
    });

    return notifications.map((notification) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      linkUrl: notification.linkUrl,
      createdAt: notification.createdAt,
      isUnread: notification.readStates.length === 0,
    }));
  }

  async markAsRead(userId: string, notificationIds?: string[]) {
    const ids = notificationIds && notificationIds.length > 0 ? notificationIds : [];

    if (ids.length === 0) {
      const visible = await this.prisma.notification.findMany({
        where: {
          OR: [
            { audience: NotificationAudience.ALL },
            { audience: NotificationAudience.TEAM },
            { audience: NotificationAudience.JURY },
            { audience: NotificationAudience.ADMIN },
            { audience: NotificationAudience.ORGANIZER },
            {
              audience: NotificationAudience.USER,
              userId,
            },
          ],
        },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
        take: 40,
      });

      if (visible.length === 0) {
        return { readAt: new Date().toISOString(), updated: 0 };
      }

      await this.prisma.notificationReadState.createMany({
        data: visible.map((item) => ({
          notificationId: item.id,
          userId,
        })),
        skipDuplicates: true,
      });

      return {
        readAt: new Date().toISOString(),
        updated: visible.length,
      };
    }

    await this.prisma.notificationReadState.createMany({
      data: ids.map((notificationId) => ({
        notificationId,
        userId,
      })),
      skipDuplicates: true,
    });

    return {
      readAt: new Date().toISOString(),
      updated: ids.length,
    };
  }
}
