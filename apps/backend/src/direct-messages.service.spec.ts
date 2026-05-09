import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { DirectMessagesService } from './direct-messages.service';

function createPrismaMock() {
  return {
    user: {
      findFirst: vi.fn(),
    },
    directConversation: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    directConversationParticipant: {
      update: vi.fn(),
    },
    directMessage: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

describe('DirectMessagesService', () => {
  it('throws when trying to start dialog with self', async () => {
    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'me@example.com',
      fullName: 'Me',
      role: 'TEAM',
    });
    const service = new DirectMessagesService(prisma as never);

    await expect(
      service.createOrGetDialog('user-1', 'me@example.com'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a new dialog when there is no existing one', async () => {
    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-2',
      email: 'other@example.com',
      fullName: 'Other',
      role: 'JURY',
    });
    prisma.directConversation.findFirst.mockResolvedValue(null);
    prisma.directConversation.create.mockResolvedValue({
      id: 'dialog-1',
      createdAt: new Date('2026-03-22T10:00:00.000Z'),
      updatedAt: new Date('2026-03-22T10:00:00.000Z'),
      participants: [
        {
          userId: 'user-1',
          user: {
            id: 'user-1',
            email: 'me@example.com',
            fullName: 'Me',
            role: 'TEAM',
          },
        },
        {
          userId: 'user-2',
          user: {
            id: 'user-2',
            email: 'other@example.com',
            fullName: 'Other',
            role: 'JURY',
          },
        },
      ],
      messages: [],
    });
    const service = new DirectMessagesService(prisma as never);

    const result = await service.createOrGetDialog('user-1', 'other@example.com');

    expect(prisma.directConversation.create).toHaveBeenCalled();
    expect(result.id).toBe('dialog-1');
    expect(result.otherUser.email).toBe('other@example.com');
  });

  it('throws NotFoundException when sending message to unknown dialog', async () => {
    const prisma = createPrismaMock();
    prisma.directConversation.findFirst.mockResolvedValue(null);
    const service = new DirectMessagesService(prisma as never);

    await expect(
      service.sendMessage('user-1', 'dialog-missing', 'Hello'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marks dialog as unread when latest message is from another user after last read', async () => {
    const prisma = createPrismaMock();
    prisma.directConversation.findMany.mockResolvedValue([
      {
        id: 'dialog-1',
        createdAt: new Date('2026-03-22T10:00:00.000Z'),
        updatedAt: new Date('2026-03-22T11:00:00.000Z'),
        participants: [
          {
            userId: 'user-1',
            lastReadAt: new Date('2026-03-22T10:30:00.000Z'),
            user: {
              id: 'user-1',
              email: 'me@example.com',
              fullName: 'Me',
              role: 'TEAM',
            },
          },
          {
            userId: 'user-2',
            lastReadAt: new Date('2026-03-22T11:00:00.000Z'),
            user: {
              id: 'user-2',
              email: 'other@example.com',
              fullName: 'Other',
              role: 'JURY',
            },
          },
        ],
        messages: [
          {
            id: 'message-1',
            conversationId: 'dialog-1',
            senderId: 'user-2',
            body: 'Hello from jury',
            createdAt: new Date('2026-03-22T10:45:00.000Z'),
            updatedAt: new Date('2026-03-22T10:45:00.000Z'),
          },
        ],
      },
    ]);
    const service = new DirectMessagesService(prisma as never);

    const [dialog] = await service.listDialogs('user-1');

    expect(dialog.isUnread).toBe(true);
  });

  it('marks dialog as read when loading messages', async () => {
    const prisma = createPrismaMock();
    prisma.directConversation.findFirst.mockResolvedValue({
      id: 'dialog-1',
      createdAt: new Date('2026-03-22T10:00:00.000Z'),
      updatedAt: new Date('2026-03-22T11:00:00.000Z'),
      participants: [
        {
          userId: 'user-1',
          lastReadAt: null,
          user: {
            id: 'user-1',
            email: 'me@example.com',
            fullName: 'Me',
            role: 'TEAM',
          },
        },
        {
          userId: 'user-2',
          lastReadAt: null,
          user: {
            id: 'user-2',
            email: 'other@example.com',
            fullName: 'Other',
            role: 'JURY',
          },
        },
      ],
    });
    prisma.directMessage.findMany.mockResolvedValue([]);
    prisma.directConversationParticipant.update.mockResolvedValue({});
    const service = new DirectMessagesService(prisma as never);

    const result = await service.getDialogWithMessages('user-1', 'dialog-1');

    expect(prisma.directConversationParticipant.update).toHaveBeenCalled();
    expect(result.dialog.isUnread).toBe(false);
  });

  it('deletes a dialog when the user is a participant', async () => {
    const prisma = createPrismaMock();
    prisma.directConversation.findFirst.mockResolvedValue({ id: 'dialog-1' });
    prisma.directConversation.delete.mockResolvedValue({ id: 'dialog-1' });
    const service = new DirectMessagesService(prisma as never);

    await expect(service.deleteDialog('user-1', 'dialog-1')).resolves.toEqual({
      deleted: true,
    });
    expect(prisma.directConversation.delete).toHaveBeenCalledWith({
      where: { id: 'dialog-1' },
    });
  });

  it('allows deleting only own direct message', async () => {
    const prisma = createPrismaMock();
    prisma.directMessage.findFirst.mockResolvedValue({
      id: 'message-1',
      senderId: 'user-1',
    });
    prisma.directMessage.delete.mockResolvedValue({ id: 'message-1' });
    const service = new DirectMessagesService(prisma as never);

    await expect(
      service.deleteMessage('user-1', 'dialog-1', 'message-1'),
    ).resolves.toEqual({ deleted: true });
    expect(prisma.directMessage.delete).toHaveBeenCalledWith({
      where: { id: 'message-1' },
    });
  });

  it('rejects deleting another user direct message', async () => {
    const prisma = createPrismaMock();
    prisma.directMessage.findFirst.mockResolvedValue({
      id: 'message-1',
      senderId: 'user-2',
    });
    const service = new DirectMessagesService(prisma as never);

    await expect(
      service.deleteMessage('user-1', 'dialog-1', 'message-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
