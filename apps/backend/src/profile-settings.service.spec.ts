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

  it('stores uploaded avatar as local file URL and removes previous local avatar', async () => {
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

    const service = new ProfileSettingsService(prisma);

    const result = await service.patchSettings('user-test', {
      edit: {
        avatarUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2p8xQAAAAASUVORK5CYII=',
      },
    });

    expect(result.edit.avatarUrl).toMatch(/^\/uploads\/avatars\/user-test-/);
    expect(userSettingsUpsert).toHaveBeenCalledTimes(1);
    expect(existsSync(previousFilePath)).toBe(false);

    const storedFiles = await readdir(avatarStorageDir);
    expect(storedFiles).toHaveLength(1);
    expect(storedFiles[0]).toMatch(/^user-test-/);
  });
});
