import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const prismaSchemaPath = resolve(rootDir, 'apps', 'backend', 'prisma', 'schema.prisma');
const executable = process.platform === 'win32' ? 'npm.cmd' : 'npm';

if (!existsSync(prismaSchemaPath)) {
  console.log('Skipping postinstall Prisma generate because apps/backend/prisma/schema.prisma is not available yet.');
  process.exit(0);
}

const result = spawnSync(executable, ['run', 'prisma:generate', '-w', '@falconarena/backend'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: false,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
