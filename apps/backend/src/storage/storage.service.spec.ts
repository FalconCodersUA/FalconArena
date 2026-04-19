import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageService } from './storage.service';

const originalEnv = { ...process.env };

describe('StorageService', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    await rm(join(process.cwd(), 'storage'), { recursive: true, force: true }).catch(
      () => undefined,
    );
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('stores avatar locally by default', async () => {
    delete process.env.STORAGE_PROVIDER;
    const service = new StorageService();

    const result = await service.storeAvatar({
      userId: 'user-local',
      extension: 'png',
      mimeType: 'image/png',
      body: Buffer.from('avatar-local'),
    });

    expect(result.publicUrl).toMatch(/^\/uploads\/avatars\/user-local-/);
    const storedFiles = await readdir(join(process.cwd(), 'storage', 'avatars'));
    expect(storedFiles).toHaveLength(1);
  });

  it('stores platform banners locally by default', async () => {
    delete process.env.STORAGE_PROVIDER;
    const service = new StorageService();

    const result = await service.storePlatformBanner({
      extension: 'webp',
      mimeType: 'image/webp',
      body: Buffer.from('about-banner'),
    });

    expect(result.publicUrl).toMatch(/^\/uploads\/about-banners\/about-/);
    const storedFiles = await readdir(join(process.cwd(), 'storage', 'about-banners'));
    expect(storedFiles).toHaveLength(1);
  });

  it('stores avatar in s3-compatible mode via signed PUT request', async () => {
    process.env.STORAGE_PROVIDER = 's3';
    process.env.STORAGE_S3_ENDPOINT = 'https://storage.example.com';
    process.env.STORAGE_S3_REGION = 'auto';
    process.env.STORAGE_S3_BUCKET = 'falconarena-assets';
    process.env.STORAGE_S3_ACCESS_KEY_ID = 'test-access-key';
    process.env.STORAGE_S3_SECRET_ACCESS_KEY = 'test-secret-key';
    process.env.STORAGE_S3_PUBLIC_BASE_URL = 'https://cdn.example.com/falconarena-assets';
    process.env.STORAGE_S3_KEY_PREFIX = 'prod';
    process.env.STORAGE_S3_FORCE_PATH_STYLE = 'true';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(''),
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new StorageService();
    const result = await service.storeAvatar({
      userId: 'user-s3',
      extension: 'png',
      mimeType: 'image/png',
      body: Buffer.from('avatar-s3'),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/falconarena-assets/prod/avatars/');
    expect(options.method).toBe('PUT');
    expect(result.publicUrl).toMatch(
      /^https:\/\/cdn\.example\.com\/falconarena-assets\/prod\/avatars\/user-s3-/,
    );
  });

  it('removes local managed object', async () => {
    delete process.env.STORAGE_PROVIDER;
    const service = new StorageService();
    const avatarsDir = join(process.cwd(), 'storage', 'avatars');
    await mkdir(avatarsDir, { recursive: true });
    const stored = await service.storeAvatar({
      userId: 'cleanup-user',
      extension: 'png',
      mimeType: 'image/png',
      body: Buffer.from('avatar-cleanup'),
    });

    await service.removeManagedObject(stored.publicUrl);
    const storedFiles = await readdir(avatarsDir);
    expect(storedFiles).toHaveLength(0);
  });
});
