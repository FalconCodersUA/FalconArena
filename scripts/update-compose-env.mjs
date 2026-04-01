import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const targetArg = process.argv[2];

if (!targetArg) {
  console.error('Usage: node scripts/update-compose-env.mjs <env-file-path>');
  process.exit(1);
}

const envPath = resolve(process.cwd(), targetArg);
const originalLines = readFileSync(envPath, 'utf8').split(/\r?\n/);

const values = {
  NODE_ENV: process.env.NODE_ENV_VALUE || 'production',
  POSTGRES_DB: process.env.POSTGRES_DB_VALUE || '',
  POSTGRES_USER: process.env.POSTGRES_USER_VALUE || '',
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD_VALUE || '',
  JWT_SECRET: process.env.JWT_SECRET_VALUE || '',
  BACKEND_PORT: process.env.BACKEND_PORT_VALUE || '4000',
  PRISMA_SYNC_MODE: process.env.PRISMA_SYNC_MODE_VALUE || 'dbpush',
  APP_DOMAIN: process.env.APP_DOMAIN_VALUE || 'falconarena.live',
  VITE_API_URL: process.env.VITE_API_URL_VALUE || 'https://falconarena.live',
  JOBS_WORKER_ENABLED: process.env.JOBS_WORKER_ENABLED_VALUE || 'true',
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER_VALUE || 'local',
  STORAGE_LOCAL_DIR: process.env.STORAGE_LOCAL_DIR_VALUE || '/app/storage',
  STORAGE_LOCAL_PUBLIC_PREFIX: process.env.STORAGE_LOCAL_PUBLIC_PREFIX_VALUE || '/uploads',
  STORAGE_S3_ENDPOINT: process.env.STORAGE_S3_ENDPOINT_VALUE || '',
  STORAGE_S3_REGION: process.env.STORAGE_S3_REGION_VALUE || 'auto',
  STORAGE_S3_BUCKET: process.env.STORAGE_S3_BUCKET_VALUE || '',
  STORAGE_S3_ACCESS_KEY_ID: process.env.STORAGE_S3_ACCESS_KEY_ID_VALUE || '',
  STORAGE_S3_SECRET_ACCESS_KEY: process.env.STORAGE_S3_SECRET_ACCESS_KEY_VALUE || '',
  STORAGE_S3_PUBLIC_BASE_URL: process.env.STORAGE_S3_PUBLIC_BASE_URL_VALUE || '',
  STORAGE_S3_KEY_PREFIX: process.env.STORAGE_S3_KEY_PREFIX_VALUE || 'falconarena',
  STORAGE_S3_FORCE_PATH_STYLE: process.env.STORAGE_S3_FORCE_PATH_STYLE_VALUE || 'true',
  EMAIL_NOTIFICATIONS_ENABLED: process.env.EMAIL_NOTIFICATIONS_ENABLED_VALUE || 'false',
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER_VALUE || 'console',
  EMAIL_FROM: process.env.EMAIL_FROM_VALUE || 'no-reply@falconarena.live',
  EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO_VALUE || 'team@falconarena.live',
  RESEND_API_KEY: process.env.RESEND_API_KEY_VALUE || '',
  GOOGLE_SHEETS_WEBHOOK_URL: process.env.GOOGLE_SHEETS_WEBHOOK_URL_VALUE || '',
  GOOGLE_SHEETS_WEBHOOK_SECRET: process.env.GOOGLE_SHEETS_WEBHOOK_SECRET_VALUE || '',
  GOOGLE_SHEETS_DEFAULT_SHEET_NAME:
    process.env.GOOGLE_SHEETS_DEFAULT_SHEET_NAME_VALUE || '',
};

const updatedLines = [];
const seenKeys = new Set();

for (const line of originalLines) {
  if (!line || line.trimStart().startsWith('#') || !line.includes('=')) {
    updatedLines.push(line);
    continue;
  }

  const [key] = line.split('=', 1);
  if (Object.prototype.hasOwnProperty.call(values, key)) {
    updatedLines.push(`${key}=${values[key]}`);
    seenKeys.add(key);
  } else {
    updatedLines.push(line);
  }
}

for (const [key, value] of Object.entries(values)) {
  if (!seenKeys.has(key)) {
    updatedLines.push(`${key}=${value}`);
  }
}

writeFileSync(envPath, `${updatedLines.join('\n').replace(/\n+$/u, '')}\n`, 'utf8');
