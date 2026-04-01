import { existsSync } from 'node:fs';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileSettingsService } from './profile-settings.service';
import { PrismaService } from './prisma/prisma.service';

const avatarStorageDir = join(process.cwd(), 'storage', 'avatars');

async function removeTestAvatarFiles() {
  await rm(avatarStorageDir, { recursive: true, force: true }).catch(() => undefined);
}

describe('ProfileSettingsService', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await removeTestAvatarFiles();
  });

  it('stores uploaded avatar via storage service and removes previous managed avatar', async () => {
    const previousFileName = 'user-test-old.png';
    const previousFilePath = join(avatarStorageDir, previousFileName);
    await mkdir(avatarStorageDir, { recursive: true });
    await writeFile(previousFilePath, Buffer.from('old-avatar'));

    let currentAvatarUrl: string | null = `/uploads/avatars/${previousFileName}`;

    const userFindUnique = vi.fn(async () => ({
      id: 'user-test',
      email: 'profile@example.com',
      fullName: 'Profile User',
      passwordHash: 'hash',
      settings: {
        avatarUrl: currentAvatarUrl,
        userName: null,
        dateOfBirth: null,
        presentAddress: null,
        permanentAddress: null,
        city: null,
        postalCode: null,
        country: null,
        interfaceLanguage: null,
        timeZone: null,
        notifyAnnouncements: true,
        notifyReviews: false,
        notifyMessages: true,
      },
    }));

    const userUpdate = vi.fn();
    const userSettingsUpsert = vi.fn(async (args: { update: { avatarUrl?: string | null } }) => {
      currentAvatarUrl = args.update.avatarUrl ?? null;
    });

    const prisma = {
      user: {
        findUnique: userFindUnique,
        update: userUpdate,
      },
      userSettings: {
        upsert: userSettingsUpsert,
      },
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<void>) =>
        callback({
          user: { update: userUpdate },
          userSettings: { upsert: userSettingsUpsert },
        }),
      ),
    } as unknown as PrismaService;

    const storageService = {
      isManagedUrl: vi.fn((value: string | null | undefined) =>
        typeof value === 'string' && value.startsWith('/uploads/avatars/'),
      ),
      storeAvatar: vi.fn(async () => {
        const fileName = 'user-test-new.png';
        const filePath = join(avatarStorageDir, fileName);
        await mkdir(avatarStorageDir, { recursive: true });
        await writeFile(filePath, Buffer.from('new-avatar'));
        return {
          publicUrl: `/uploads/avatars/${fileName}`,
          cleanupHandle: `/uploads/avatars/${fileName}`,
        };
      }),
      removeManagedObject: vi.fn(async (value: string) => {
        if (value === `/uploads/avatars/${previousFileName}`) {
          await rm(previousFilePath, { force: true }).catch(() => undefined);
        }
      }),
    };

    const service = new ProfileSettingsService(prisma, storageService as never);

    const result = await service.patchSettings('user-test', {
      edit: {
        avatarUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2p8xQAAAAASUVORK5CYII=',
      },
    });

    expect(result.edit.avatarUrl).toBe('/uploads/avatars/user-test-new.png');
    expect(userSettingsUpsert).toHaveBeenCalledTimes(1);
    expect(storageService.storeAvatar).toHaveBeenCalledTimes(1);
    expect(storageService.removeManagedObject).toHaveBeenCalledWith(
      `/uploads/avatars/${previousFileName}`,
    );
    expect(existsSync(previousFilePath)).toBe(false);

    const storedFiles = await readdir(avatarStorageDir);
    expect(storedFiles).toHaveLength(1);
    expect(storedFiles[0]).toBe('user-test-new.png');
  });
});
