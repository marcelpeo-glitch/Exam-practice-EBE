// Checks the single-file build (standalone/mock-testvision.html) opened straight from disk (file://)
// with the network switched off: it must load, render maths and images, keep progress over a reload
// and mark an exam without a single network request.
//   npm run build:standalone && node tests/e2e/standalone.mjs
// Needs Playwright with Chromium (set PLAYWRIGHT_MODULE to its path if it is installed globally).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const FILE = path.resolve(new URL('../../standalone/mock-testvision.html', import.meta.url).pathname);
const URL_ = pathToFileURL(FILE).href;
let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures++;
};

// MAP * ~NOTFOUND makes every host name unresolvable: any attempt to reach the internet fails loudly.
const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP * ~NOTFOUND'] });
const page = await browser.newPage({ viewport: { width: 1366, height: 860 } });
const requests = [];
const errors = [];
page.on('request', (r) => requests.push(r.url()));
page.on('requestfailed', (r) => errors.push(`request failed: ${r.url().slice(0, 100)}`));
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
page.on('dialog', (d) => d.accept());

await page.goto(URL_);
await page.evaluate(() => localStorage.clear());
await page.goto(URL_);
check((await page.locator('[data-testid^="exam-row-"]').count()) === 6, 'start screen lists the 6 exams');

// start the 2025 exam, answer Q1 and Q20 (figure + multi-select), flag Q1
await page.getByTestId('start-qm1-2025-exam').click();
await page.getByTestId('confirm-check').check();
await page.getByTestId('start-exam').click();
await page.getByTestId('option-E').click();
await page.getByTestId('flag').click();
check((await page.locator('.qpane .katex').count()) > 0 && (await page.locator('.qpane .katex-error').count()) === 0, 'maths renders offline (KaTeX)');
const fonts = await page.evaluate(async () => {
  await document.fonts.ready;
  return [...document.fonts].filter((f) => f.family.includes('KaTeX') && f.status === 'loaded').length;
});
check(fonts > 0, `KaTeX fonts are loaded from inside the file (${fonts} faces)`);
await page.getByTestId('tile-20').click();
const figOk = await page
  .waitForFunction(() => {
    const im = document.querySelector('.qpane figure img');
    return im && im.complete && im.naturalWidth > 0;
  }, null, { timeout: 5000 })
  .then(() => true, () => false);
check(figOk, 'figures (box plots) show offline');
await page.getByTestId('option-A').click();
await page.getByTestId('option-C').click();
await page.getByTestId('resources').click();
const sheetOk = await page.waitForFunction(() => {
  const im = document.querySelector('.resource-img');
  return im && im.complete && im.naturalWidth > 0;
}, null, { timeout: 5000 }).then(() => true, () => false);
check(sheetOk, 'formula sheet image shows offline');
await page.keyboard.press('Escape');

// refresh from disk: everything survives
await page.reload();
await page.getByTestId('timer').waitFor();
check((await page.getByTestId('tile-1').getAttribute('data-state')) === 'answered, flagged', 'a reload from file:// keeps the answer and the flag');
check((await page.getByTestId('tile-20').getAttribute('data-state')) === 'answered', 'a reload keeps the multi-select answer');
const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
check(sw <= iw, 'no sideways scrolling on desktop');

// calculator
await page.getByTestId('calc-toggle').click();
await page.getByTestId('calc-input').fill('1÷2π');
await page.getByTestId('calc-input').press('Enter');
check((await page.getByTestId('calc-result').innerText()) === '0.1591549431', 'calculator works offline');
await page.getByTestId('calc-toggle').click();

// hand in and mark
await page.getByTestId('ready').click();
await page.getByTestId('handin-continue').click();
await page.getByTestId('handin-confirm-yes').click();
await page.getByTestId('summary').waitFor();
const pts = (await page.getByTestId('points').innerText()).replace(/\s+/g, ' ');
check(/^[\d.]+ \/ 28$/.test(pts), `exam is marked offline (${pts})`);
await page.getByTestId('back-overview').click();
await page.getByTestId('history').waitFor();
check((await page.getByTestId('history').locator('tbody tr').count()) === 1, 'the attempt appears in the history');

// phone width
await page.setViewportSize({ width: 400, height: 800 });
await page.getByTestId('start-qm1-2023-first-sit').click();
await page.getByTestId('confirm-check').check();
await page.getByTestId('start-exam').click();
await page.getByTestId('tile-23').click();
const [sw2, iw2] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
check(sw2 <= iw2, `fits a 400 px phone (${sw2} <= ${iw2})`);

const outside = requests.filter((u) => !u.startsWith('file:') && !u.startsWith('data:'));
check(outside.length === 0, `no network requests (${outside.length}${outside.length ? ': ' + outside.slice(0, 3).join(', ') : ''})`);
check(errors.length === 0, `no console or page errors${errors.length ? ': ' + [...new Set(errors)].join(' | ') : ''}`);

await browser.close();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nSTANDALONE FILE WORKS OFFLINE');
process.exit(failures ? 1 : 0);
