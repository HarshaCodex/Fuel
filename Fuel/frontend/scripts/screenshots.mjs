import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

import { emptyCustomFoods, emptyHistory, fixtures } from './fixtures.mjs';

const API = 'http://mock.fuel.test';
const DIST = 'dist';
const OUT = 'screenshots';
const SHOTS = [
  { path: '/', title: 'Sign in', file: 'sign-in.png' },
];
// Tab screens sit behind sign-in, so sign in through the UI (mocked /api/auth/login) and shoot from there.
const SIGNED_IN_SHOTS = [{ title: 'Greek yogurt', file: 'today.png' }];
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
    let customEmpty = false;
    let historyMode = 'ok';
    await context.route(`${API}/**`, (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname === '/api/food/custom') return route.fulfill({ json: customEmpty ? emptyCustomFoods : fixtures[pathname] });
      if (pathname === '/api/tracking/history') {
        if (historyMode === 'error') return route.fulfill({ status: 500, json: { status: 'ERROR', message: 'Server error', data: null } });
        return route.fulfill({ json: historyMode === 'empty' ? emptyHistory : fixtures[pathname] });
      }
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
    await page.getByLabel('Email', { exact: true }).fill('shots@example.com');
    await page.getByLabel('Password', { exact: true }).fill('Passw0rd!x');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    for (const shot of SIGNED_IN_SHOTS) {
      await page.getByText(shot.title, { exact: true }).first().waitFor();
      await page.screenshot({ path: join(OUT, shot.file) });
    }
    // Edit entry sheet from the row menu: untouched, then with an invalid amount for the error style.
    await page.getByRole('button', { name: 'More actions for Chicken salad' }).click();
    await page.getByRole('button', { name: 'Edit Chicken salad' }).click();
    await page.getByRole('button', { name: 'Save changes', exact: true }).waitFor();
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(OUT, 'edit-entry.png') });
    await page.getByLabel('Amount', { exact: true }).fill('0');
    await page.getByLabel('Amount', { exact: true }).blur();
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, 'edit-entry-error.png') });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Save changes', exact: true }).waitFor({ state: 'detached' });
    // My Foods: empty first, then with foods, then the editor prefilled from a food.
    customEmpty = true;
    await page.getByRole('tab', { name: 'Profile' }).click();
    await page.getByRole('button', { name: 'My Foods', exact: true }).click();
    await page.getByText('Foods you create show up here').waitFor();
    await page.screenshot({ path: join(OUT, 'my-foods-empty.png') });
    customEmpty = false;
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'My Foods', exact: true }).click();
    await page.getByText('Overnight oats').waitFor();
    await page.screenshot({ path: join(OUT, 'my-foods.png') });
    await page.getByRole('button', { name: 'More actions for Overnight oats' }).click();
    await page.getByRole('button', { name: 'Edit Overnight oats' }).click();
    await page.getByText('Edit food', { exact: true }).first().waitFor();
    // The menu fades out over the editor; shoot only once it is gone and the footer is in place.
    await page.getByRole('button', { name: 'Cancel', exact: true }).waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Save changes', exact: true }).waitFor();
    await page.screenshot({ path: join(OUT, 'manual-entry.png') });
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    // Create mode from My Foods > New food, with the name field touched and left blank for the error style.
    await page.getByRole('button', { name: 'New food', exact: true }).click();
    await page.getByText('New food', { exact: true }).first().waitFor();
    await page.getByRole('button', { name: 'Save food', exact: true }).waitFor();
    await page.getByLabel('Name', { exact: true }).focus();
    await page.getByLabel('Name', { exact: true }).blur();
    await page.getByText('Enter a name', { exact: true }).waitFor();
    await page.screenshot({ path: join(OUT, 'manual-entry-create.png') });
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('tab', { name: 'Today' }).click();
    await page.getByText('Greek yogurt', { exact: true }).first().waitFor();
    // History: list, empty, error, then a day opened from a row. Range changes reuse the same tab.
    await page.getByRole('tab', { name: 'History' }).click();
    await page.getByTestId('history-chart').waitFor();
    await page.screenshot({ path: join(OUT, 'history.png') });
    await page.getByRole('button', { name: 'Open Sun 8 Nov' }).click();
    await page.getByLabel(/calories remaining/).waitFor();
    await page.screenshot({ path: join(OUT, 'day.png') });
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    historyMode = 'empty';
    await page.getByRole('radio', { name: '30 days' }).click();
    await page.getByText('Your history starts with your first log').waitFor();
    await page.screenshot({ path: join(OUT, 'history-empty.png') });
    historyMode = 'error';
    await page.getByRole('radio', { name: '90 days' }).click();
    await page.getByText("Couldn't load your history").waitFor();
    await page.screenshot({ path: join(OUT, 'history-error.png') });
    await page.getByRole('tab', { name: 'Today' }).click();
    await page.getByText('Greek yogurt', { exact: true }).first().waitFor();

    // Quick Log flow: menu, search, then the portion confirm for the first result.
    await page.getByRole('button', { name: 'Log food', exact: true }).click();
    await page.getByText('Search foods', { exact: true }).first().waitFor();
    await page.getByText('Chicken breast').first().waitFor();
    await page.screenshot({ path: join(OUT, 'quick-log.png') });
    await page.getByRole('button', { name: 'Search foods', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search foods' }).fill('chicken');
    await page.getByRole('button', { name: /^Chicken thigh/ }).last().waitFor();
    await page.screenshot({ path: join(OUT, 'search.png') });
    await page.getByRole('button', { name: /^Chicken breast/ }).last().click();
    await page.getByRole('button', { name: /^Log \d+ kcal$/ }).waitFor();
    await page.screenshot({ path: join(OUT, 'food-detail.png') });
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
