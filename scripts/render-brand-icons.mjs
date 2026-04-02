import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = resolve(import.meta.dirname, '..');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const svgPath = resolve(repoRoot, 'apps/frontend/public/favicon.svg');
const workDir = resolve(repoRoot, '.tmp/brand-render');

const targets = [
  {
    size: 16,
    output: resolve(repoRoot, 'apps/frontend/public/favicon-16x16.png'),
  },
  {
    size: 32,
    output: resolve(repoRoot, 'apps/frontend/public/favicon-32x32.png'),
  },
  {
    size: 180,
    output: resolve(repoRoot, 'apps/frontend/public/apple-touch-icon.png'),
  },
  {
    size: 192,
    output: resolve(repoRoot, 'apps/frontend/public/android-chrome-192x192.png'),
  },
];

mkdirSync(workDir, { recursive: true });

for (const target of targets) {
  const htmlPath = resolve(workDir, `brand-${target.size}.html`);
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        width: ${target.size}px;
        height: ${target.size}px;
        margin: 0;
        background: transparent;
        overflow: hidden;
      }

      body {
        display: grid;
        place-items: center;
      }

      img {
        width: ${target.size}px;
        height: ${target.size}px;
        display: block;
      }
    </style>
  </head>
  <body>
    <img src="file:///${svgPath.replace(/\\/g, '/')}" alt="" />
  </body>
</html>`;

  writeFileSync(htmlPath, html, 'utf8');

  const result = spawnSync(
    edgePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--default-background-color=00000000',
      `--window-size=${target.size},${target.size}`,
      `--screenshot=${target.output}`,
      `file:///${htmlPath.replace(/\\/g, '/')}`,
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `Failed to render ${target.output}\n${result.stdout}\n${result.stderr}`.trim(),
    );
  }
}

const icoPath = resolve(repoRoot, 'apps/frontend/public/favicon.ico');
const icoImages = [
  {
    size: 16,
    data: readFileSync(resolve(repoRoot, 'apps/frontend/public/favicon-16x16.png')),
  },
  {
    size: 32,
    data: readFileSync(resolve(repoRoot, 'apps/frontend/public/favicon-32x32.png')),
  },
];

const headerSize = 6;
const directoryEntrySize = 16;
let dataOffset = headerSize + icoImages.length * directoryEntrySize;
const totalSize =
  dataOffset + icoImages.reduce((sum, image) => sum + image.data.length, 0);
const icoBuffer = Buffer.alloc(totalSize);

icoBuffer.writeUInt16LE(0, 0);
icoBuffer.writeUInt16LE(1, 2);
icoBuffer.writeUInt16LE(icoImages.length, 4);

icoImages.forEach((image, index) => {
  const entryOffset = headerSize + index * directoryEntrySize;
  const sizeByte = image.size >= 256 ? 0 : image.size;

  icoBuffer.writeUInt8(sizeByte, entryOffset);
  icoBuffer.writeUInt8(sizeByte, entryOffset + 1);
  icoBuffer.writeUInt8(0, entryOffset + 2);
  icoBuffer.writeUInt8(0, entryOffset + 3);
  icoBuffer.writeUInt16LE(1, entryOffset + 4);
  icoBuffer.writeUInt16LE(32, entryOffset + 6);
  icoBuffer.writeUInt32LE(image.data.length, entryOffset + 8);
  icoBuffer.writeUInt32LE(dataOffset, entryOffset + 12);
  image.data.copy(icoBuffer, dataOffset);
  dataOffset += image.data.length;
});

writeFileSync(icoPath, icoBuffer);

console.log('Rendered brand PNG icons successfully.');
