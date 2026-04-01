import { copyFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const envExamplePath = resolve(rootDir, 'infra', 'docker-compose', '.env.example');
const envPath = resolve(rootDir, 'infra', 'docker-compose', '.env');

function run(command, args) {
  const executable = process.platform === 'win32' ? `${command}.cmd` : command;
  const result = spawnSync(executable, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const majorNodeVersion = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);

if (majorNodeVersion < 20) {
  console.error(`FalconArena requires Node.js 20+. Current version: ${process.version}`);
  process.exit(1);
}

if (!existsSync(envPath)) {
  copyFileSync(envExamplePath, envPath);
  console.log('Created infra/docker-compose/.env from .env.example');
} else {
  console.log('Using existing infra/docker-compose/.env');
}

console.log('Generating Prisma client...');
run('npm', ['run', 'prisma:generate', '-w', '@falconarena/backend']);

console.log('');
console.log('Local bootstrap completed.');
console.log('');
console.log('Next steps:');
console.log('1. Start local services:');
console.log('   docker compose -f infra/docker-compose/docker-compose.yml --env-file infra/docker-compose/.env up -d --build');
console.log('2. Open http://localhost');
console.log('3. Optional dev mode:');
console.log('   npm run dev:backend');
console.log('   npm run dev:frontend');
