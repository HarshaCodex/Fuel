import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

import { fixtures } from './fixtures.mjs';

const API = 'http://mock.fuel.test';
const DIST = 'dist';
const OUT = 'screenshots';
const SHOTS = [
  // Tab screens sit behind sign-in; add them back once the sign-in screen can log in via a mocked /api/auth/login.
  { path: '/', title: 'Sign in', file: 'sign-in.png' },
];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };

function serve() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let file = normalize(join(DIST, decodeURIComponent(url.pathname)));
    if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
    res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

async function main() {
  execFileSync('npx', ['expo', 'export', '-p', 'web'], {
    stdio: 'inherit',
    env: { ...process.env, EXPO_PUBLIC_API_BASE_URL: API },
  });
  mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const base = `http://localhost:${server.address().port}`;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light' });
    const unmocked = [];
    await context.route(`${API}/**`, (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname in fixtures) return route.fulfill({ json: fixtures[pathname] });
      unmocked.push(pathname);
      return route.abort();
    });
    const page = await context.newPage();
    for (const shot of SHOTS) {
      await page.goto(base + shot.path);
      await page.getByText(shot.title, { exact: true }).first().waitFor();
      await page.screenshot({ path: join(OUT, shot.file) });
    }
    if (unmocked.length) throw new Error(`Unmocked API calls: ${unmocked.join(', ')}`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
