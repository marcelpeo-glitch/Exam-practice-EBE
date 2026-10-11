// Browser regressions for issues found in the pre-merge review:
// 1. Back/Forward (or Resume) during an exam must not reset answers, flags or the timer.
// 2. Calculator: after "=", an operator continues from Ans and a digit starts fresh (dev mode = React StrictMode).
// 3. After hand-in, the Back button must not get stuck on a redirect.
// Run with the dev server on :5173:  node tests/e2e/regressions.mjs
// Needs Playwright with Chromium (set PLAYWRIGHT_MODULE to its path if it is installed globally).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');

const BASE = process.env.BASE_URL ?? 'http://localhost:5173/';
const EXAM = 'qm1-2025-exam';
let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures++;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 860 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('dialog', (d) => d.accept());
const seconds = async () => {
  const t = (await page.getByTestId('timer-value').innerText()).split(':').map(Number);
  return t.length === 3 ? t[0] * 3600 + t[1] * 60 + t[2] : t[0] * 60 + t[1];
};

await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.goto(BASE);
await page.getByTestId(`start-${EXAM}`).click();
await page.getByTestId('confirm-check').check();
await page.getByTestId('start-exam').click();

// ---- 1. Back / Forward / Resume keep progress
await page.getByTestId('option-E').click();
await page.getByTestId('flag').click();
await page.getByTestId('tile-2').click();
await page.getByTestId('option-C').click();
await page.waitForTimeout(2500);
const before = await seconds();
await page.goBack();
await page.getByTestId('confirm-screen').waitFor();
await page.goForward();
await page.getByTestId('timer').waitFor();
check((await page.getByTestId('tile-1').getAttribute('data-state')) === 'answered, flagged', 'Back + Forward keeps the answer and flag on Q1');
check((await page.getByTestId('tile-2').getAttribute('data-state')) === 'answered', 'Back + Forward keeps the answer on Q2');
check((await page.getByTestId('question-heading').innerText()) === 'Question 2', 'Back + Forward keeps the current question');
const after = await seconds();
check(after <= before && after >= before - 3, `Back + Forward keeps the remaining time (${before} -> ${after})`);

await page.goto(`${BASE}#/`);
const banner = await page.getByTestId('resume-banner').innerText();
const m = /(\d+):(\d\d):(\d\d) left/.exec(banner);
const bannerSec = m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : -1;
check(bannerSec > 0 && bannerSec < 10800, `resume banner shows the saved remaining time (${m ? m[0] : banner})`);
await page.getByTestId('resume').click();
check((await page.getByTestId('tile-1').getAttribute('data-state')) === 'answered, flagged', 'Resume keeps the answers and flags');

// ---- 2. Calculator continues from Ans
await page.getByTestId('calc-toggle').click();
const key = (k) => page.getByTestId('calculator').getByRole('button', { name: k, exact: true }).click();
for (const k of ['2', '+', '3', '=']) await key(k);
check((await page.getByTestId('calc-result').innerText()) === '5', 'calculator: 2+3 = 5');
await key('+');
check((await page.getByTestId('calc-input').inputValue()) === 'Ans+', `after "=", "+" continues from Ans (${await page.getByTestId('calc-input').inputValue()})`);
for (const k of ['1', '=']) await key(k);
check((await page.getByTestId('calc-result').innerText()) === '6', 'Ans+1 = 6');
await key('7');
check((await page.getByTestId('calc-input').inputValue()) === '7', 'after "=", a digit starts a new calculation');
await page.getByTestId('calc-input').fill('1÷2π');
await page.getByTestId('calc-input').press('Enter');
check((await page.getByTestId('calc-result').innerText()) === '0.1591549431', '1÷2π = 0.1591549431 (Casio precedence)');
await page.getByTestId('calc-toggle').click();

// ---- 3. Back after hand-in is not stuck
await page.getByTestId('ready').click();
await page.getByTestId('handin-continue').click();
await page.getByTestId('handin-confirm-yes').click();
await page.getByTestId('summary').waitFor();
const resultsHash = await page.evaluate(() => location.hash);
await page.goBack();
await page.waitForTimeout(300);
const h1 = await page.evaluate(() => location.hash);
check(h1 !== '#/exam' && h1 !== resultsHash, `Back from the results leaves the results page (${h1})`);
await page.goForward();
await page.waitForTimeout(300);
check((await page.evaluate(() => location.hash)) === resultsHash, 'Forward returns to the results page');
// Keep pressing Back: an old #/exam entry redirects to #/ by *replacing* itself, so history keeps
// moving and we reach the exam's start page (with the old bug every Back pushed #/ again: stuck).
const seen = [];
for (let i = 0; i < 4; i++) {
  await page.goBack();
  await page.waitForTimeout(300);
  seen.push(await page.evaluate(() => location.hash));
}
check(seen.includes(`#/start/${EXAM}`), `repeated Back walks through history (${seen.join(' → ')})`);

check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
await browser.close();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL REGRESSION CHECKS PASSED');
process.exit(failures ? 1 : 0);
