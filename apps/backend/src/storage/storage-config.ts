import { join } from 'node:path';

export type StorageProvider = 'local' | 's3';

export type StorageConfig = {
  provider: StorageProvider;
  local: {
    rootDir: string;
    publicPrefix: string;
  };
  s3: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    publicBaseUrl: string;
    keyPrefix: string;
    forcePathStyle: boolean;
  };
};

function normalizeProvider(value: string | undefined): StorageProvider {
  return value?.trim().toLowerCase() === 's3' ? 's3' : 'local';
}

function normalizeBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

export function getStorageConfig(): StorageConfig {
  const provider = normalizeProvider(process.env.STORAGE_PROVIDER);
  const localRootDir = process.env.STORAGE_LOCAL_DIR?.trim() || join(process.cwd(), 'storage');
  const localPublicPrefix = process.env.STORAGE_LOCAL_PUBLIC_PREFIX?.trim() || '/uploads';
  const s3Endpoint = trimTrailingSlash(process.env.STORAGE_S3_ENDPOINT?.trim() || '');
  const s3Bucket = process.env.STORAGE_S3_BUCKET?.trim() || '';
  const s3PublicBaseUrl = trimTrailingSlash(
    process.env.STORAGE_S3_PUBLIC_BASE_URL?.trim() ||
      (s3Endpoint && s3Bucket ? `${s3Endpoint}/${s3Bucket}` : ''),
  );

  return {
    provider,
    local: {
      rootDir: localRootDir,
      publicPrefix: localPublicPrefix,
    },
    s3: {
      endpoint: s3Endpoint,
      region: process.env.STORAGE_S3_REGION?.trim() || 'auto',
      bucket: s3Bucket,
      accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID?.trim() || '',
      secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY?.trim() || '',
      publicBaseUrl: s3PublicBaseUrl,
      keyPrefix: process.env.STORAGE_S3_KEY_PREFIX?.trim() || 'falconarena',
      forcePathStyle: normalizeBoolean(process.env.STORAGE_S3_FORCE_PATH_STYLE, true),
    },
  };
}

export function isLocalStorageProvider() {
  return getStorageConfig().provider === 'local';
}
