// Predicted exam: generate → start page → 2-hour exam (28 tiles in two sections, flag, answers) → refresh keeps
// answers, flags and time → warnings at 10 and 1 minutes → automatic hand-in at 0:00 → results with separate
// Mathematics / Statistics scores, topic breakdown and KaTeX worked solutions → generate another one.
// Run with the dev server on :5173:  node tests/e2e/predicted.mjs
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173/';
const OUT = path.dirname(new URL(import.meta.url).pathname) + '/shots';
let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures++;
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, locale: 'en-GB' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.goto(BASE);

// ---- overview: the button and the reported split
const panel = page.getByTestId('predict-panel');
await panel.waitFor();
const split = await page.getByTestId('predict-split').innerText();
check(/Mathematics \(14 questions\).*Statistics \(14 questions\).*50 : 50/.test(split), `split reported on the overview: "${split}"`);
await page.locator('.predict-how summary').click();
check((await page.getByTestId('blueprint-table').locator('tbody tr').count()) >= 19, 'blueprint table lists every topic');
await page.screenshot({ path: `${OUT}/predicted-01-overview.png`, fullPage: true });
const t0 = Date.now();
await page.getByTestId('generate-predicted').click();
await page.getByTestId('confirm-screen').waitFor();
console.log(`     generated in ${Date.now() - t0} ms`);
check(page.url().includes('#/start/predicted-'), 'opens the start page of the new exam');
check(await page.getByTestId('predicted-note').isVisible(), 'start page says it is a prediction, not the real exam');
check((await page.getByTestId('confirm-duration').innerText()).includes('120 minutes'), 'start page: 120 minutes');
check((await page.locator('dl.facts').innerText()).includes('28 (Mathematics 14, Statistics 14)'), 'start page: 28 questions, 14 + 14');
await page.screenshot({ path: `${OUT}/predicted-02-confirm.png`, fullPage: true });
const examId = page.url().split('#/start/')[1];

// ---- the exam
await page.getByTestId('confirm-check').check();
await page.getByTestId('start-exam').click();
await page.getByTestId('timer').waitFor();
const timer = await page.getByTestId('timer-value').innerText();
check(/^(2:00:00|1:59:[45]\d)$/.test(timer), `timer starts at 2:00:00 (${timer})`);
check(await page.getByTestId('predicted-pill').isVisible(), 'header labels it "Predicted exam"');
check(await page.getByTestId('predicted-note').isVisible(), 'exam shows the prediction note');
check((await page.locator('.tile').count()) === 28, 'navigator has 28 tiles');
const groups = await page.locator('.tile-group-label').allInnerTexts();
check(groups.join('|') === 'Mathematics|Statistics', `navigator grouped: ${groups.join(' | ')}`);
check((await page.locator('.katex').count()) > 0, 'question maths is rendered with KaTeX');

// answer question 1 (whatever type), flag question 2
const answerCurrent = async () => {
  if (await page.locator('[data-testid^="option-"]').count()) await page.locator('[data-testid^="option-"]').first().click();
  else if (await page.locator('[data-testid^="numeric-"]').count()) await page.locator('[data-testid^="numeric-"]').first().fill('1');
  else if (await page.locator('[data-testid^="match-"]').count()) await page.locator('[data-testid^="match-"]').first().selectOption({ index: 1 });
};
await answerCurrent();
await page.getByTestId('next').click();
await page.getByTestId('flag').click();
await page.getByTestId('tile-15').click();
await answerCurrent();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/predicted-03-exam.png` });
await page.reload();
await page.getByTestId('timer').waitFor();
check((await page.getByTestId('tile-1').getAttribute('data-state')) === 'answered', 'after refresh: answer kept');
check((await page.getByTestId('tile-2').getAttribute('data-state')) === 'unanswered, flagged', 'after refresh: flag kept');
check((await page.getByTestId('tile-15').getAttribute('data-state'))?.startsWith('answered'), 'after refresh: statistics answer kept');
const t2 = await page.getByTestId('timer-value').innerText();
check(/^1:59:\d\d$/.test(t2), `after refresh: timer continues (${t2})`);

// ---- warnings and the automatic hand-in: wind the saved clock forward while the exam is closed
const setRemaining = async (sec) => {
  await page.goto(BASE + '#/');
  await page.evaluate((s) => {
    const x = JSON.parse(localStorage.getItem('mtv:v1:session'));
    x.remainingSec = s;
    localStorage.setItem('mtv:v1:session', JSON.stringify(x));
  }, sec);
  await page.goto(BASE + '#/exam');
  await page.getByTestId('timer').waitFor();
};
await setRemaining(602);
await page.getByTestId('time-warning').waitFor({ timeout: 6000 });
check((await page.getByTestId('time-warning').innerText()).includes('10 minutes left'), 'warning at 10 minutes');
await page.screenshot({ path: `${OUT}/predicted-04-warning.png` });
await setRemaining(62);
await page.waitForFunction(() => document.querySelector('[data-testid="time-warning"]')?.textContent?.includes('1 minute'), null, { timeout: 6000 });
check(true, 'warning at 1 minute');
await setRemaining(2);
await page.getByTestId('summary').waitFor({ timeout: 8000 });
check(await page.getByTestId('auto-submitted').isVisible(), 'handed in automatically at 0:00');

// ---- results
check(page.url().includes('#/results/'), 'results page');
const maths = await page.getByTestId('section-score-Mathematics').innerText();
const stats = await page.getByTestId('section-score-Statistics').innerText();
check(/\/ 14/.test(maths) && /\/ 14/.test(stats), `separate scores: Mathematics "${maths.replace(/\s+/g, ' ')}", Statistics "${stats.replace(/\s+/g, ' ')}"`);
check((await page.getByTestId('points').innerText()).includes('/ 28'), 'total out of 28');
check((await page.getByTestId('topics').locator('tbody tr').count()) >= 17, 'topic breakdown');
check((await page.locator('.rq').count()) === 28, 'all 28 questions reviewed');
check((await page.locator('.rq .explain h4', { hasText: 'Worked solution' }).count()) === 28, 'a worked solution for every question');
check((await page.locator('.rq .explain .katex').count()) > 28, 'worked solutions use KaTeX');
check((await page.getByTestId('generated-badge').count()) === 28, 'every answer marked "computed in code"');
check(await page.getByTestId('predicted-note').isVisible(), 'results repeat the prediction note');
await page.screenshot({ path: `${OUT}/predicted-05-results.png`, fullPage: true });

// ---- the stored exam is reused for retakes; a new one can be generated
await page.goto(BASE);
check((await page.getByTestId('predicted-list').locator('tr').count()) === 1, 'overview lists the predicted exam');
check((await page.getByTestId('history').innerText()).includes('Predicted exam'), 'history shows the attempt');
await page.getByTestId(`start-${examId}`).click();
await page.getByTestId('confirm-screen').waitFor();
check(page.url().endsWith(examId), 'start the same predicted exam again');
await page.goto(BASE);
await page.getByTestId('generate-predicted').click();
await page.getByTestId('confirm-screen').waitFor();
check(!page.url().endsWith(examId), 'a second generation gives a different exam');

check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`);
await browser.close();
console.log(failures ? `\n${failures} check(s) FAILED` : '\nall predicted-exam checks passed');
process.exit(failures ? 1 : 0);
