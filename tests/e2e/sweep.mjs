// Sweep: for every exam, start it, hand in blank, and check the full review page renders
// (no KaTeX errors, all images load, every question present, no answers visible during the exam).
// Run with the dev server on :5173:  node tests/e2e/<file>.mjs
// Needs Playwright with Chromium (set PLAYWRIGHT_MODULE to its path if it is installed globally).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173/';
const ROOT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
const OUT = path.dirname(new URL(import.meta.url).pathname) + '/shots';
fs.mkdirSync(OUT, { recursive: true });

const exams = fs.readdirSync(`${ROOT}/data/exams`).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(`${ROOT}/data/exams/${f}`, 'utf8')));
let failures = 0;
const fail = (m) => {
  failures++;
  console.log('FAIL:', m);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 860 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.goto(BASE);
await page.screenshot({ path: `${OUT}/01-start.png`, fullPage: true });
const rows = await page.locator('[data-testid^="exam-row-"]').count();
console.log('exam rows on start screen:', rows);
if (rows !== exams.length) fail(`expected ${exams.length} rows, got ${rows}`);

for (const exam of exams) {
  await page.goto(`${BASE}#/start/${exam.id}`);
  await page.getByTestId('confirm-check').check();
  await page.getByTestId('start-exam').click();
  await page.getByTestId('timer').waitFor();

  // Walk through every question during the exam: math renders, no answer leaks, images load.
  for (let i = 0; i < exam.questions.length; i++) {
    const q = exam.questions[i];
    await page.getByTestId(`tile-${i + 1}`).click();
    await page.waitForFunction((n) => document.querySelector('[data-testid="question-heading"]')?.textContent === `Question ${n}`, i + 1);
    const body = await page.locator('.qpane').innerText();
    const leaks = await page.locator('.qpane .explain, .qpane [data-testid="correct-answer"], .qpane [data-testid="ai-badge"], .qpane .ropt').count();
    if (leaks || /AI-solved|Model answer/.test(body)) fail(`${exam.id} q${q.number}: answer info visible during exam`);
    const expl = q.explanation.replace(/\$[^$]*\$/g, '').trim().slice(0, 40);
    if (expl.length > 25 && body.includes(expl)) fail(`${exam.id} q${q.number}: explanation text visible during exam`);
    const katexErr = await page.locator('.qpane .katex-error').count();
    if (katexErr) fail(`${exam.id} q${q.number}: ${katexErr} KaTeX errors during exam`);
    const broken = await page.$$eval('.qpane img', (imgs) => imgs.filter((im) => !(im.complete && im.naturalWidth > 0)).map((im) => im.src));
    if (broken.length) {
      await page.waitForTimeout(500);
      const still = await page.$$eval('.qpane img', (imgs) => imgs.filter((im) => !(im.complete && im.naturalWidth > 0)).map((im) => im.src));
      if (still.length) fail(`${exam.id} q${q.number}: broken images ${still}`);
    }
  }
  await page.getByTestId(`tile-1`).click();
  await page.screenshot({ path: `${OUT}/exam-${exam.id}-q1.png` });

  await page.getByTestId('ready').click();
  await page.getByTestId('handin-continue').click();
  await page.getByTestId('handin-confirm-yes').click();
  await page.getByTestId('summary').waitFor();
  const reviews = await page.locator('[data-testid^="review-"]').count();
  if (reviews !== exam.questions.length) fail(`${exam.id}: ${reviews} review items, expected ${exam.questions.length}`);
  // Wait for lazy images, then check all of them.
  await page.evaluate(async () => {
    for (const im of document.querySelectorAll('img')) im.loading = 'eager';
    await Promise.all([...document.images].map((im) => (im.complete ? 0 : new Promise((r) => (im.onload = im.onerror = r)))));
  });
  const broken = await page.$$eval('img', (imgs) => imgs.filter((im) => !(im.complete && im.naturalWidth > 0)).map((im) => im.getAttribute('src')));
  if (broken.length) fail(`${exam.id} results: broken images ${broken}`);
  const katexErr = await page.locator('.katex-error').count();
  if (katexErr) fail(`${exam.id} results: ${katexErr} KaTeX errors`);
  const katexCount = await page.locator('.katex').count();
  const pts = await page.getByTestId('points').innerText();
  const aiBadges = await page.getByTestId('ai-badge').count();
  const expectedAi = exam.questions.filter((q) => q.answerSource === 'ai').length;
  if (aiBadges !== expectedAi) fail(`${exam.id}: ${aiBadges} AI badges, expected ${expectedAi}`);
  console.log(`${exam.id}: ${reviews} questions reviewed, ${katexCount} formulas rendered, points "${pts.replace(/\n/g, ' ')}", AI badges ${aiBadges}`);
  await page.screenshot({ path: `${OUT}/results-${exam.id}.png`, fullPage: false });
}

if (errors.length) fail(`console/page errors: ${[...new Set(errors)].join(' | ')}`);
await browser.close();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL SWEEP CHECKS PASSED');
process.exit(failures ? 1 : 0);
