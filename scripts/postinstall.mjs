import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const executable = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const result = spawnSync(executable, ['run', 'prisma:generate', '-w', '@falconarena/backend'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: false,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
