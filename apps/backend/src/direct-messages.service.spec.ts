import { BadRequestException, NotFoundException } from '@nestjs/common';
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
    },
    directMessage: {
      findMany: vi.fn(),
      create: vi.fn(),
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
});
