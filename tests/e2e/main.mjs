// Main scenario: take the 2025 exam with a planned mix of right / wrong / partial / blank answers,
// check the timer, flags, calculator, formula sheets, refresh persistence, hand-in flow, the score,
// per-topic table, retry-wrong, history; then auto hand-in and open-question self-marking (demo exam).
// Run with the dev server on :5173:  node tests/e2e/<file>.mjs
// Needs Playwright with Chromium (set PLAYWRIGHT_MODULE to its path if it is installed globally).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173/';
const OUT = path.dirname(new URL(import.meta.url).pathname) + '/shots';
const exam = JSON.parse(fs.readFileSync(new URL('../../data/exams/qm1-2025-exam.json', import.meta.url), 'utf8'));
let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures++;
};

// Plan: question number -> [kind, value, expected points]   (computed by hand, not by the app)
const plan = {
  1: ['radio', 'E', 1], 2: ['radio', 'A', 0], 4: ['radio', 'B', 1], 5: ['radio', 'A', 0],
  6: ['radio', 'A', 1], // alsoAccepted equivalent form
  7: ['num', { value: '1' }, 1], 8: ['num', { value: '2' }, 0], 10: ['radio', 'E', 1],
  12: ['num', { value: '9' }, 1], 13: ['radio', 'A', 0], 14: ['radio', 'B', 1],
  15: ['match', { unit: 'bear', variable: 'tea', type: 'ordinal' }, 2 / 3],
  16: ['num', { t: '1.973', lower: '1.23', upper: '5.57' }, 1 / 3],
  17: ['radio', 'D', 1], 19: ['radio', 'B', 0], 20: ['check', ['A'], 0.5], 21: ['radio', 'D', 1],
  22: ['match', { study: 'experiment', fatal: 'response', equip: 'treatment', landing: 'blocking' }, 1],
  23: ['num', { value: '0,253' }, 1], // comma accepted (with a hint)
  24: ['num', { value: '0.266' }, 1], // within tolerance
  26: ['num', { value: '622' }, 1], // accept range 622-623
  27: ['num', { value: '95' }, 0],
  28: ['check', ['A', 'B', 'C'], 0.5], // 2 right, 1 wrong of 2 correct
};
const blanks = [3, 9, 11, 18, 25];
const flags = [3, 16];
const expectedPoints = Object.values(plan).reduce((s, p) => s + p[2], 0);
const expectedPct = (100 * expectedPoints) / 28;
const expectedGrade = Math.round((10 * expectedPoints) / 28 * 10) / 10;
console.log(`expected: ${expectedPoints} / 28 = ${expectedPct.toFixed(1)}%, grade ${expectedGrade}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 860 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('dialog', (d) => d.accept());

await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.goto(BASE);
await page.getByTestId(`start-${exam.id}`).click();
await page.getByTestId('confirm-screen').waitFor();
await page.screenshot({ path: `${OUT}/02-confirm.png` });
check(await page.getByTestId('start-exam').isDisabled(), 'Start is disabled until the instructions checkbox is ticked');
await page.getByTestId('confirm-check').check();
await page.getByTestId('start-exam').click();

// ---- timer counts down
const readTimer = async () => {
  const t = (await page.getByTestId('timer-value').innerText()).split(':').map(Number);
  return t.length === 3 ? t[0] * 3600 + t[1] * 60 + t[2] : t[0] * 60 + t[1];
};
const t0 = await readTimer();
await page.waitForTimeout(3200);
const t1 = await readTimer();
check(t0 <= 180 * 60 && t0 >= 180 * 60 - 3, `timer starts at ~3:00:00 (${t0}s)`);
check(t0 - t1 >= 2 && t0 - t1 <= 4, `timer counts down (${t0} -> ${t1})`);

// ---- math renders on Q1
check((await page.locator('.qpane .katex').count()) > 0 && (await page.locator('.qpane .katex-error').count()) === 0, 'math renders with KaTeX on question 1');

async function goto(n) {
  await page.getByTestId(`tile-${n}`).click();
  await page.waitForFunction((x) => document.querySelector('[data-testid="question-heading"]')?.textContent === `Question ${x}`, n);
}
async function answer(n) {
  const [kind, v] = plan[n];
  await goto(n);
  if (kind === 'radio') await page.getByTestId(`option-${v}`).click();
  if (kind === 'check') for (const id of v) await page.getByTestId(`option-${id}`).click();
  if (kind === 'num') for (const [k, val] of Object.entries(v)) await page.getByTestId(`numeric-${k}`).fill(val);
  if (kind === 'match') for (const [k, val] of Object.entries(v)) await page.getByTestId(`match-${k}`).selectOption(val);
}

const nums = Object.keys(plan).map(Number);
const firstHalf = nums.filter((n) => n <= 16);
for (const n of firstHalf) await answer(n);
for (const n of flags) {
  await goto(n);
  await page.getByTestId('flag').click();
}
await goto(23);
await page.getByTestId('numeric-value').fill('0,253');
check(await page.getByText('TestVision expects a dot').isVisible(), 'comma in a numeric answer shows the dot hint');
await page.getByTestId('next').click();
check((await page.getByTestId('question-heading').innerText()) === 'Question 24', 'Next button moves to the next question');
await page.getByTestId('prev').click();
check((await page.getByTestId('question-heading').innerText()) === 'Question 23', 'Previous button moves back');

// tile states
check((await page.getByTestId('tile-1').getAttribute('data-state')) === 'answered', 'tile 1 shows answered');
check((await page.getByTestId('tile-3').getAttribute('data-state')) === 'unanswered, flagged', 'tile 3 shows unanswered + flagged');
check((await page.getByTestId('tile-16').getAttribute('data-state')) === 'answered, flagged', 'tile 16 shows answered + flagged');

// ---- calculator
await page.getByTestId('calc-toggle').click();
await page.getByTestId('calc-input').fill('(570-520)/80');
await page.getByTestId('calc-input').press('Enter');
check((await page.getByTestId('calc-result').innerText()) === '0.625', 'calculator: (570-520)/80 = 0.625');
await page.getByTestId('calc-input').fill('');
for (const k of ['√', '1', '6', ')', '+', 'ln', 'e', ')', '=']) await page.getByTestId('calculator').getByRole('button', { name: k, exact: true }).click();
check((await page.getByTestId('calc-result').innerText()) === '5', 'calculator keypad: √(16)+ln(e) = 5');
await page.screenshot({ path: `${OUT}/03-exam-calculator.png` });
await page.getByTestId('calc-toggle').click();
check((await page.getByTestId('calculator').count()) === 0, 'calculator closes');

// ---- formula sheets
await page.getByTestId('resources').click();
const sheetOk = await page.waitForFunction(() => {
  const im = document.querySelector('.resource-img');
  return im && im.complete && im.naturalWidth > 0;
});
check(!!sheetOk, 'formula sheet image loads');
await page.getByRole('button', { name: 'Table T' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/04-formula-sheet.png` });
await page.keyboard.press('Escape');

// ---- figure on Q20 loads
await goto(20);
const figOk = await page
  .waitForFunction(() => {
    const im = document.querySelector('.qpane figure img');
    return im && im.complete && im.naturalWidth > 0;
  }, null, { timeout: 5000 })
  .then(() => true, () => false);
check(figOk, 'question 20 figure (box plots) loads');

// ---- refresh keeps everything
await goto(16);
const answeredBefore = await page.locator('.nav .counts').innerText();
const tBefore = await readTimer();
await page.reload();
await page.getByTestId('timer').waitFor();
const tAfter = await readTimer();
check(tBefore - tAfter >= 0 && tBefore - tAfter <= 3, `timer resumes after refresh (${tBefore} -> ${tAfter})`);
check((await page.getByTestId('question-heading').innerText()) === 'Question 16', 'current question kept after refresh');
check((await page.getByTestId('numeric-t').inputValue()) === '1.973' && (await page.getByTestId('numeric-upper').inputValue()) === '5.57', 'numeric answers kept after refresh');
check((await page.locator('.nav .counts').innerText()) === answeredBefore, `answered/flagged counts kept after refresh (${answeredBefore.replace('\n', ', ')})`);
check((await page.getByTestId('tile-3').getAttribute('data-state')) === 'unanswered, flagged', 'flags kept after refresh');
await goto(15);
check((await page.getByTestId('match-variable').inputValue()) === 'tea', 'drop-down answers kept after refresh');
await goto(6);
check(await page.getByTestId('option-A').locator('input').isChecked(), 'radio answer kept after refresh');

// ---- second half
for (const n of nums.filter((n) => n > 16)) await answer(n);
await goto(10);
await page.screenshot({ path: `${OUT}/05-exam-midway.png` });

// ---- hand-in flow
await page.getByTestId('ready').click();
const unans = (await page.getByTestId('unanswered-list').innerText()).split(/\s+/).filter(Boolean).map(Number);
const flg = (await page.getByTestId('flagged-list').innerText()).split(/\s+/).filter(Boolean).map(Number);
check(JSON.stringify(unans) === JSON.stringify(blanks), `overview lists unanswered ${unans}`);
check(JSON.stringify(flg) === JSON.stringify(flags), `overview lists flagged ${flg}`);
await page.screenshot({ path: `${OUT}/06-handin-overview.png` });
await page.getByTestId('handin-continue').click();
await page.getByTestId('handin-confirm').waitFor();
await page.getByTestId('handin-confirm-yes').click();
await page.getByTestId('summary').waitFor();

const pts = (await page.getByTestId('points').innerText()).replace(/\s+/g, ' ');
const pct = await page.getByTestId('percentage').innerText();
const grade = await page.getByTestId('grade').innerText();
check(pts === `${expectedPoints} / 28`, `points: ${pts} (expected ${expectedPoints} / 28)`);
check(pct === `${expectedPct.toFixed(1)}%`, `percentage: ${pct}`);
check(grade === expectedGrade.toFixed(1), `grade: ${grade} (expected ${expectedGrade.toFixed(1)})`);
check((await page.getByTestId('pass-fail').innerText()) === (expectedGrade >= 5.5 ? 'Pass' : 'Fail'), 'pass/fail matches 5.5 threshold');
check(/\d/.test(await page.getByTestId('time-used').innerText()), `time used shown: ${(await page.getByTestId('time-used').innerText()).replace('\n', ' ')}`);

// per-question statuses
const statusOf = async (n) => page.getByTestId(`review-${n}`).getAttribute('data-status');
check((await statusOf(6)) === 'correct', 'Q6 alternative correct form accepted');
check((await statusOf(15)) === 'partial' && (await statusOf(16)) === 'partial', 'Q15 matching and Q16 multi-field numeric are partial');
check((await statusOf(23)) === 'correct' && (await statusOf(26)) === 'correct', 'Q23 (comma) and Q26 (accept range) correct');
check((await statusOf(3)) === 'blank' && (await statusOf(2)) === 'wrong', 'blank and wrong statuses');
check((await page.getByTestId('review-15').getByTestId('ai-badge').count()) === 1, 'AI-solved badge on Q15');

// per-topic table vs. independent expectation
const expTopics = {};
for (const q of exam.questions) {
  const e = plan[q.number]?.[2] ?? 0;
  expTopics[q.topic] ??= { e: 0, m: 0 };
  expTopics[q.topic].e += e;
  expTopics[q.topic].m += q.points;
}
const rows = await page.getByTestId('topics').locator('tbody tr').all();
let topicOk = rows.length === Object.keys(expTopics).length;
for (const r of rows) {
  const cells = await r.locator('td').allInnerTexts();
  const exp = expTopics[cells[0]];
  const want = `${Math.round(exp.e * 100) / 100} / ${exp.m}`;
  if (cells[2] !== want) {
    topicOk = false;
    console.log('   topic mismatch', cells[0], cells[2], 'expected', want);
  }
}
check(topicOk, `per-topic table matches (${rows.length} topics)`);
await page.screenshot({ path: `${OUT}/07-results.png`, fullPage: false });
await page.getByTestId('review-16').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${OUT}/08-review.png` });

// ---- retry wrong questions
const notRight = Object.keys(plan).filter((n) => plan[n][2] < 1).length + blanks.length;
await page.getByTestId('retry-wrong').click();
await page.getByTestId('confirm-screen').waitFor();
const dur = await page.getByTestId('confirm-duration').innerText();
check(dur.startsWith(`${Math.round((180 * notRight) / 28)} minutes`), `retry duration scaled: ${dur}`);
await page.getByTestId('confirm-check').check();
await page.getByTestId('start-exam').click();
const tiles = await page.locator('[data-testid^="tile-"]').count();
check(tiles === notRight, `retry contains ${tiles} questions (expected ${notRight})`);
await page.getByTestId('ready').click();
await page.getByTestId('handin-continue').click();
await page.getByTestId('handin-confirm-yes').click();
await page.getByTestId('summary').waitFor();
check((await page.getByTestId('points').innerText()).includes(`/ ${notRight}`), 'retry results out of the retried questions');

// ---- history and best score
await page.getByTestId('back-overview').click();
await page.getByTestId('history').waitFor();
const histRows = await page.getByTestId('history').locator('tbody tr').count();
check(histRows === 2, `history shows 2 attempts (${histRows})`);
const best = await page.getByTestId(`exam-row-${exam.id}`).getByTestId('best-score').innerText();
check(best.startsWith(expectedGrade.toFixed(1)), `best score on start screen: ${best.replace('\n', ' ')}`);
await page.screenshot({ path: `${OUT}/09-start-with-history.png`, fullPage: true });

// ---- demo exam: open question + auto hand-in when the timer hits zero
await page.goto(`${BASE}?demo=1#/start/demo-all-question-types`);
await page.getByTestId('confirm-check').check();
await page.getByTestId('start-exam').click();
await page.getByTestId('option-A').click(); // q1 correct (1)
await page.getByTestId('tile-2').click();
await page.getByTestId('option-A').click(); // q2 half (0.5)
await page.getByTestId('tile-3').click();
await page.getByTestId('numeric-lower').fill('48.04');
await page.getByTestId('numeric-upper').fill('51.96'); // q3 (1)
await page.getByTestId('tile-4').click();
await page.getByTestId('open-answer').fill('The probability of data at least this extreme if H0 is true.');
await page.getByTestId('tile-5').click();
await page.getByTestId('match-p1').selectOption('strat');
await page.getByTestId('match-p2').selectOption('conv'); // q5 half (0.5)
// Simulate the clock running out: set the saved remaining time to 3 s and reload.
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('mtv:v1:session'));
  s.remainingSec = 3;
  localStorage.setItem('mtv:v1:session', JSON.stringify(s));
});
await page.reload();
await page.getByTestId('tile-4').click();
check((await page.getByTestId('open-answer').inputValue()).startsWith('The probability'), 'open answer kept after refresh');
await page.getByTestId('auto-submitted').waitFor({ timeout: 8000 });
check(true, 'exam handed in automatically when the timer reached zero');
check((await page.getByTestId('points').innerText()).replace(/\s+/g, ' ') === '3 / 6', `demo before self-marking: ${(await page.getByTestId('points').innerText()).replace(/\s+/g, ' ')}`);
await page.getByTestId('self-mark-4').getByTestId('self-score').fill('1.5');
await page.waitForTimeout(200);
check((await page.getByTestId('points').innerText()).replace(/\s+/g, ' ') === '4.5 / 6', 'self-awarded points update the total live (4.5 / 6)');
check((await page.getByTestId('grade').innerText()) === '7.5', 'grade updates to 7.5');
await page.getByTestId('self-mark-4').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${OUT}/10-open-self-mark.png` });
await page.reload();
await page.getByTestId('summary').waitFor();
check((await page.getByTestId('points').innerText()).replace(/\s+/g, ' ') === '4.5 / 6', 'self-awarded points persist after refresh');

if (errors.length) check(false, `no console errors (${[...new Set(errors)].join(' | ')})`);
else check(true, 'no console errors');
await browser.close();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
