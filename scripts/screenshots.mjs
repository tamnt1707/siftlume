#!/usr/bin/env node
// Renders the README screenshots from scripts/showcase with headless Chrome.
// Usage: pnpm screenshots   (set CHROME_PATH if Chrome is not in a standard location)
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

// Async on purpose: a sync spawn would block this process, and with it the Vite server Chrome is
// waiting on.
const run = promisify(execFile);
const root = new URL('..', import.meta.url).pathname;
const dirs = { readme: join(root, 'docs/screenshots'), store: join(root, 'docs/store') };
Object.values(dirs).forEach((d) => mkdirSync(d, { recursive: true }));

const chrome =
  process.env.CHROME_PATH ??
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].find(existsSync);
if (!chrome) throw new Error('Chrome not found. Set CHROME_PATH.');

const shots = [
  { name: 'compare', query: 'view=compare', size: '1360,900' },
  { name: 'full-page', query: 'view=fullpage', size: '1360,1740' },
  { name: 'full-page-dark', query: 'view=fullpage&dark', size: '1360,1740' },
  { name: 'settings', query: 'view=settings', size: '1100,720' },
  { name: 'components', query: 'view=components', size: '1360,900' },
  // Chrome Web Store: exact pixel sizes, so 1x.
  ...[1, 2, 3, 4, 5].map((n) => ({
    name: `screenshot-${n}`,
    query: `view=store&n=${n}`,
    size: '1280,800',
    scale: 1,
    dir: 'store',
  })),
  { name: 'promo-small-440x280', query: 'view=promo-small', size: '440,280', scale: 1, dir: 'store' },
  { name: 'promo-marquee-1400x560', query: 'view=promo-marquee', size: '1400,560', scale: 1, dir: 'store' },
];

const server = await createServer({ configFile: join(root, 'scripts/showcase/vite.config.mjs') });
await server.listen();
const base = `http://localhost:${server.config.server.port}/`;
const profile = mkdtempSync(join(tmpdir(), 'siftlume-shots-'));

try {
  for (const s of shots) {
    const file = join(dirs[s.dir ?? 'readme'], `${s.name}.png`);
    await run(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        `--force-device-scale-factor=${s.scale ?? 2}`,
        `--user-data-dir=${profile}`,
        `--window-size=${s.size}`,
        '--virtual-time-budget=10000',
        `--screenshot=${file}`,
        `${base}?${s.query}`,
      ],
      { timeout: 60_000 },
    );
    console.log(`✓ ${file}`);
  }
} finally {
  await server.close();
}
