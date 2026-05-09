import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

const userPreviewSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
} as const;

const dialogListInclude = {
  participants: {
    include: {
      user: {
        select: userPreviewSelect,
      },
    },
  },
  messages: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
} as const;

@Injectable()
export class DirectMessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async listDialogs(userId: string) {
    const dialogs = await this.prisma.directConversation.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      include: dialogListInclude,
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return dialogs.map((dialog) => this.mapDialogListItem(dialog, userId));
  }

  async createOrGetDialog(userId: string, recipientEmail: string) {
    const normalizedEmail = recipientEmail.trim().toLowerCase();

    const recipient = await this.prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
      },
      select: userPreviewSelect,
    });

    if (!recipient) {
      throw new NotFoundException('Recipient not found');
    }

    if (recipient.id === userId) {
      throw new BadRequestException('Cannot start dialog with yourself');
    }

    const existing = await this.prisma.directConversation.findFirst({
      where: {
        participants: {
          every: { userId: { in: [userId, recipient.id] } },
          some: { userId },
        },
        AND: [
          {
            participants: {
              some: { userId: recipient.id },
            },
          },
        ],
      },
      include: dialogListInclude,
    });

    if (existing) {
      return this.mapDialogListItem(existing, userId);
    }

    const created = await this.prisma.directConversation.create({
      data: {
        createdById: userId,
        participants: {
          create: [
            { userId, lastReadAt: new Date() },
            { userId: recipient.id, lastReadAt: new Date() },
          ],
        },
      },
      include: dialogListInclude,
    });

    return this.mapDialogListItem(created, userId);
  }

  async getDialogWithMessages(userId: string, dialogId: string) {
    const dialog = await this.prisma.directConversation.findFirst({
      where: {
        id: dialogId,
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: userPreviewSelect,
            },
          },
        },
      },
    });

    if (!dialog) {
      throw new NotFoundException('Dialog not found');
    }

    const messages = await this.prisma.directMessage.findMany({
      where: { conversationId: dialogId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    const readAt = new Date();
    await this.prisma.directConversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId: dialogId,
          userId,
        },
      },
      data: {
        lastReadAt: readAt,
      },
    });

    return {
      dialog: this.mapDialogSummary(
        {
          ...dialog,
          participants: dialog.participants.map((participant) =>
            participant.userId === userId
              ? { ...participant, lastReadAt: readAt }
              : participant,
          ),
        },
        userId,
      ),
      messages,
    };
  }

  async sendMessage(userId: string, dialogId: string, body: string) {
    const trimmedBody = body.trim();
    if (trimmedBody.length === 0) {
      throw new BadRequestException('Message body is empty');
    }

    const dialog = await this.prisma.directConversation.findFirst({
      where: {
        id: dialogId,
        participants: {
          some: { userId },
        },
      },
      select: { id: true },
    });

    if (!dialog) {
      throw new NotFoundException('Dialog not found');
    }

    const timestamp = new Date();
    const [message] = await this.prisma.$transaction([
      this.prisma.directMessage.create({
        data: {
          conversationId: dialogId,
          senderId: userId,
          body: trimmedBody,
        },
      }),
      this.prisma.directConversation.update({
        where: { id: dialogId },
        data: { updatedAt: timestamp },
      }),
      this.prisma.directConversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId: dialogId,
            userId,
          },
        },
        data: { lastReadAt: timestamp },
      }),
    ]);

    return message;
  }

  async deleteDialog(userId: string, dialogId: string) {
    const dialog = await this.prisma.directConversation.findFirst({
      where: {
        id: dialogId,
        participants: {
          some: { userId },
        },
      },
      select: { id: true },
    });

    if (!dialog) {
      throw new NotFoundException('Dialog not found');
    }

    await this.prisma.directConversation.delete({
      where: { id: dialogId },
    });

    return { deleted: true };
  }

  async deleteMessage(userId: string, dialogId: string, messageId: string) {
    const message = await this.prisma.directMessage.findFirst({
      where: {
        id: messageId,
        conversationId: dialogId,
        conversation: {
          participants: {
            some: { userId },
          },
        },
      },
      select: {
        id: true,
        senderId: true,
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('Only the sender can delete this message');
    }

    await this.prisma.directMessage.delete({
      where: { id: messageId },
    });

    return { deleted: true };
  }

  private mapDialogSummary(
    dialog: {
      id: string;
      createdAt: Date;
      updatedAt: Date;
      participants: Array<{
        userId: string;
        lastReadAt?: Date | null;
        user: {
          id: string;
          email: string;
          fullName: string;
          role: 'ADMIN' | 'TEAM' | 'JURY' | 'ORGANIZER';
        };
      }>;
    },
    currentUserId: string,
  ) {
    const other = this.resolveOtherParticipant(dialog.participants, currentUserId);
    return {
      id: dialog.id,
      createdAt: dialog.createdAt,
      updatedAt: dialog.updatedAt,
      otherUser: other.user,
      lastMessage: null,
      isUnread: false,
    };
  }

  private mapDialogListItem(
    dialog: {
      id: string;
      createdAt: Date;
      updatedAt: Date;
      participants: Array<{
        userId: string;
        lastReadAt?: Date | null;
        user: {
          id: string;
          email: string;
          fullName: string;
          role: 'ADMIN' | 'TEAM' | 'JURY' | 'ORGANIZER';
        };
      }>;
      messages: Array<{
        id: string;
        conversationId: string;
        senderId: string;
        body: string;
        createdAt: Date;
        updatedAt: Date;
      }>;
    },
    currentUserId: string,
  ) {
    const other = this.resolveOtherParticipant(dialog.participants, currentUserId);
    const currentParticipant = this.resolveCurrentParticipant(
      dialog.participants,
      currentUserId,
    );
    const lastMessage = dialog.messages[0] ?? null;
    const currentLastReadAt = currentParticipant?.lastReadAt?.getTime() ?? 0;
    const latestMessageAt = lastMessage ? new Date(lastMessage.createdAt).getTime() : 0;
    const isUnread =
      !!lastMessage &&
      lastMessage.senderId !== currentUserId &&
      latestMessageAt > currentLastReadAt;

    return {
      id: dialog.id,
      createdAt: dialog.createdAt,
      updatedAt: dialog.updatedAt,
      otherUser: other.user,
      lastMessage,
      isUnread,
    };
  }

  private resolveCurrentParticipant(
    participants: Array<{
      userId: string;
      lastReadAt?: Date | null;
      user: {
        id: string;
        email: string;
        fullName: string;
        role: 'ADMIN' | 'TEAM' | 'JURY' | 'ORGANIZER';
      };
    }>,
    currentUserId: string,
  ) {
    return participants.find((item) => item.userId === currentUserId) ?? null;
  }

  private resolveOtherParticipant(
    participants: Array<{
      userId: string;
      user: {
        id: string;
        email: string;
        fullName: string;
        role: 'ADMIN' | 'TEAM' | 'JURY' | 'ORGANIZER';
      };
    }>,
    currentUserId: string,
  ) {
    const other = participants.find((item) => item.userId !== currentUserId);
    if (other) {
      return other;
    }

    return participants[0];
  }
}
