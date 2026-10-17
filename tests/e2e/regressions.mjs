// Browser regressions for issues found in the pre-merge review:
// 1. Back/Forward (or Resume) during an exam must not reset answers, flags or the timer.
// 2. Calculator: after "=", an operator continues from Ans and a digit starts fresh (dev mode = React StrictMode).
// 3. After hand-in, the Back button must not get stuck on a redirect.
// 4. Discard / Clear use in-page confirmations; the exam screen fits a phone.
// 5. Back to the confirm page of a started exam offers Resume instead of silently restarting it.
// 6. A second tab taking over the exam stops the first tab from saving (no overwriting, no resurrecting).
// 7. Tab stays inside open dialogs. 8. The Start button stays reachable in a half-width window.
// 9. Start-page notes contain no developer instructions. 10. A browser that blocks localStorage still runs an exam.
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
const context = await browser.newContext({ viewport: { width: 1366, height: 860 } });
const page = await context.newPage();
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

// ---- 4. Discard / Clear use in-page confirmations (browser confirm() is blocked in embedded viewers)
page.removeAllListeners('dialog');
let nativeDialog = false;
page.on('dialog', (d) => {
  nativeDialog = true;
  d.dismiss();
});
await page.goto(`${BASE}#/start/${EXAM}`);
await page.getByTestId('confirm-check').check();
await page.getByTestId('start-exam').click();
await page.getByTestId('option-E').click();
await page.goto(`${BASE}#/`);
await page.getByTestId('discard').click();
await page.getByTestId('confirm-dialog').waitFor();
await page.getByTestId('confirm-yes').click();
check((await page.getByTestId('resume-banner').count()) === 0, 'Discard asks in the page and removes the exam in progress');
await page.getByTestId('clear-data').click();
await page.getByTestId('confirm-yes').click();
check((await page.getByTestId('history').count()) === 0, 'Clear saved data asks in the page and empties the history');
check(!nativeDialog, 'no browser confirm() dialogs are used');
await page.setViewportSize({ width: 400, height: 800 });
await page.goto(`${BASE}#/start/qm1-2023-first-sit`);
await page.getByTestId('confirm-check').check();
await page.getByTestId('start-exam').click();
await page.getByTestId('tile-23').click();
const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
check(sw <= iw, `exam screen fits a 400 px phone without sideways scrolling (${sw} <= ${iw})`);

// ---- 5. Back to the confirm page offers Resume (and never silently restarts the same exam)
await page.setViewportSize({ width: 1366, height: 860 });
await page.getByTestId('option-A').click(); // answer Q23 of the 2023 exam
await page.goBack();
await page.getByTestId('confirm-screen').waitFor();
check((await page.getByTestId('resume-here').count()) === 1, 'Back to the confirm page of a started exam offers "Resume exam"');
check(!(await page.getByTestId('confirm-screen').innerText()).includes('another exam in progress'), 'it does not call the same exam "another exam"');
check((await page.getByTestId('start-exam').innerText()) === 'Start over', 'the Start button is labelled "Start over"');
await page.getByTestId('resume-here').click();
await page.getByTestId('timer').waitFor();
check((await page.getByTestId('tile-23').getAttribute('data-state')) === 'answered', 'Resume returns to the exam with the answer intact');

// ---- 6. A second tab takes over: the first tab stops saving and cannot overwrite or resurrect the exam
const page2 = await context.newPage();
await page2.goto(`${BASE}#/`);
await page2.getByTestId('resume').click();
await page2.getByTestId('timer').waitFor();
await page2.getByTestId('tile-24').click();
await page2.getByTestId('option-B').click();
await page.getByTestId('claimed-modal').waitFor({ timeout: 5000 });
check(true, 'the first tab is told that the exam is open in another tab');
await page.waitForTimeout(2500); // the first tab's autosave would run every second
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mtv:v1:session')));
check(saved.answers.q24 === 'B' && saved.answers.q23 === 'A', 'the first tab did not overwrite the second tab (its answers are intact)');
await page2.getByTestId('ready').click();
await page2.getByTestId('handin-continue').click();
await page2.getByTestId('handin-confirm-yes').click();
await page2.getByTestId('summary').waitFor();
await page.waitForTimeout(2500);
check((await page.evaluate(() => localStorage.getItem('mtv:v1:session'))) === null, 'the first tab does not resurrect an exam that was handed in elsewhere');
await page2.close();
await page.getByTestId('claimed-leave').click();
await page.getByTestId('history').waitFor();
check((await page.getByTestId('resume-banner').count()) === 0, 'after leaving, the overview shows no exam in progress');

// ---- 7. Keyboard focus stays inside an open dialog
await page.goto(`${BASE}#/start/qm1-2023-first-sit`);
await page.getByTestId('confirm-check').check();
await page.getByTestId('start-exam').click();
await page.getByTestId('ready').click();
await page.getByTestId('handin-overview').waitFor();
let escaped = 0;
for (let i = 0; i < 12; i++) {
  await page.keyboard.press(i % 5 === 4 ? 'Shift+Tab' : 'Tab');
  if (!(await page.evaluate(() => !!document.activeElement?.closest('.dialog')))) escaped++;
}
check(escaped === 0, `Tab and Shift+Tab stay inside the hand-in dialog (${escaped} escapes in 12 presses)`);
await page.keyboard.press('Escape');
check((await page.getByTestId('handin-overview').count()) === 0, 'Escape closes the dialog');

// ---- 8. The Start button stays reachable in a half-width window (the exam table scrolls sideways there)
await page.goto(`${BASE}#/`);
await page.getByTestId('resume-banner').waitFor();
await page.getByRole('button', { name: 'Discard' }).click();
await page.getByTestId('confirm-yes').click();
await page.setViewportSize({ width: 683, height: 700 });
await page.locator('[data-testid="exam-row-qm1-2023-first-sit"] [data-testid="best-score"]').scrollIntoViewIfNeeded();
const best = await page.evaluate(() => {
  const c = document.querySelector('[data-testid="exam-row-qm1-2023-first-sit"] [data-testid="best-score"]');
  const r = c.getBoundingClientRect();
  const el = document.elementFromPoint(r.left + Math.min(20, r.width / 2), r.top + r.height / 2);
  return { ok: c.contains(el), text: c.innerText.trim().replace(/\s+/g, ' ').slice(0, 30) };
});
check(best.ok && best.text !== '—', `the Best score stays readable in a 683 px wide window (${best.text})`);
const [sw3, iw3] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
check(sw3 <= iw3, `the overview does not scroll sideways at 683 px (${sw3} <= ${iw3})`);
const box = await page.getByTestId('start-qm1-2023-first-sit').boundingBox();
check(!!box && box.x >= 0 && box.x + box.width <= 683, `Start button is inside a 683 px wide window (x ${Math.round(box?.x ?? -1)}..${Math.round((box?.x ?? 0) + (box?.width ?? 0))})`);
await page.getByTestId('start-qm1-2023-first-sit').click(); // fails if something covers it
await page.getByTestId('confirm-screen').waitFor();
check(true, 'the Start button can be clicked in a 683 px wide window');
await page.setViewportSize({ width: 1366, height: 860 });

// ---- 9. Notes on the start pages are written for students (no file names to edit)
for (const id of ['qm1-2021-2022-first-sit', 'qm1-2023-first-sit', 'qm1-2024-2025-first-sit', 'qm1-2025-exam']) {
  await page.goto(`${BASE}#/start/${id}`);
  const txt = await page.getByTestId('confirm-screen').innerText();
  check(!/JSON|durationMinutes/.test(txt), `${id}: start page has no developer instructions`);
}
await page.goto(`${BASE}#/`);
check(!(await page.locator('body').innerText()).includes('data/exams'), 'the overview does not mention data/exams/*.json');

// ---- 11. Idle tabs follow other tabs; a stale Resume / Start cannot bring back or replace an exam
const startIn = async (p, id) => {
  await p.goto(`${BASE}#/start/${id}`);
  await p.getByTestId('confirm-check').check();
  await p.getByTestId('start-exam').click();
  await p.getByTestId('timer').waitFor();
};
const handInIn = async (p) => {
  await p.getByTestId('ready').click();
  await p.getByTestId('handin-continue').click();
  await p.getByTestId('handin-confirm-yes').click();
  await p.getByTestId('summary').waitFor();
};
await page.goto(`${BASE}#/`);
await page.evaluate(() => localStorage.clear());
await startIn(page, 'qm1-2023-first-sit'); // tab A runs the exam
await page.getByTestId('tile-23').click();
await page.getByTestId('option-A').click();
const tabB = await context.newPage();
await tabB.goto(`${BASE}#/`);
await tabB.getByTestId('resume-banner').waitFor();
const tabC = await context.newPage();
await tabC.goto(`${BASE}#/start/qm1-2023-first-sit`);
await tabC.getByTestId('resume-here').waitFor();
await handInIn(page);
await tabB.getByTestId('resume-banner').waitFor({ state: 'detached', timeout: 5000 });
check(true, 'an idle overview tab drops the "Resume" banner when the exam is handed in elsewhere');
await tabC.getByTestId('resume-here').waitFor({ state: 'detached', timeout: 5000 });
check((await tabC.getByTestId('start-exam').innerText()) === 'Start', 'an idle confirm page goes back to "Start"');
await tabB.close();
await tabC.close();

// the same, but the idle tab MISSES the update (its storage events are swallowed): the click re-checks storage
await page.goto(`${BASE}#/`);
await startIn(page, 'qm1-2023-first-sit');
await page.getByTestId('tile-23').click();
await page.getByTestId('option-A').click();
const tabD = await context.newPage();
// this tab never registers 'storage' listeners, so it misses every update from other tabs
await tabD.addInitScript(() => {
  const orig = window.addEventListener.bind(window);
  window.addEventListener = (type, ...rest) => (type === 'storage' ? undefined : orig(type, ...rest));
});
await tabD.goto(`${BASE}#/`);
await tabD.getByTestId('resume-banner').waitFor();
await handInIn(page);
await page.waitForTimeout(1200);
check((await tabD.getByTestId('resume-banner').count()) === 1, '(setup) the idle tab really missed the hand-in and still shows "Resume"');
const attemptsBefore = await tabD.evaluate(() => localStorage.getItem('mtv:v1:attempts'));
await tabD.getByTestId('resume').click();
await tabD.getByTestId('resume-banner').waitFor({ state: 'detached', timeout: 3000 });
check((await tabD.evaluate(() => location.hash)) === '#/', 'a stale "Resume" does not open the finished exam');
check((await tabD.evaluate(() => localStorage.getItem('mtv:v1:session'))) === null, 'a stale "Resume" does not bring the finished exam back');
check((await tabD.evaluate(() => localStorage.getItem('mtv:v1:attempts'))) === attemptsBefore, 'the finished attempt (and its answers) is untouched');

// a stale confirm page cannot replace an exam started in another tab
await tabD.goto(`${BASE}#/start/qm1-2025-exam`);
await tabD.getByTestId('confirm-check').check();
await startIn(page, 'qm1-2025-exam'); // tab A starts that exam meanwhile
await page.getByTestId('tile-1').click();
await page.getByTestId('option-E').click();
await page.waitForTimeout(1200);
const sessionBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('mtv:v1:session')).attemptId);
await tabD.getByTestId('start-exam').click();
await tabD.getByTestId('resume-here').waitFor({ timeout: 3000 });
check((await tabD.evaluate(() => JSON.parse(localStorage.getItem('mtv:v1:session')).attemptId)) === sessionBefore, 'a stale "Start" does not replace the exam another tab is running');
await tabD.close();

// ---- 12. The tab that resumes last owns the exam; the older tab is told, the new one keeps working
const tabE = await context.newPage();
await tabE.goto(`${BASE}#/`);
await tabE.getByTestId('resume').click();
await tabE.getByTestId('timer').waitFor();
await page.getByTestId('claimed-modal').waitFor({ timeout: 5000 });
check(true, 'resuming in a second tab tells the OLDER tab that the exam moved');
await tabE.waitForTimeout(2500);
check((await tabE.getByTestId('claimed-modal').count()) === 0, 'the tab that just resumed is NOT locked out');
await tabE.getByTestId('tile-2').click();
await tabE.getByTestId('option-C').click();
await tabE.waitForTimeout(1500);
check((await tabE.evaluate(() => JSON.parse(localStorage.getItem('mtv:v1:session')).answers.q2)) === 'C', 'the new tab keeps saving its answers');
// the modal's advice works: go to the overview, Resume, and the other tab is the one told
await page.getByTestId('claimed-leave').click();
await page.getByTestId('resume').click();
await page.getByTestId('timer').waitFor();
await tabE.getByTestId('claimed-modal').waitFor({ timeout: 5000 });
await page.waitForTimeout(2500);
check((await page.getByTestId('claimed-modal').count()) === 0, 'following the notice ("Resume") takes the exam back; the other tab is told');
check((await page.getByTestId('tile-2').getAttribute('data-state')) === 'answered', 'and no answer was lost on the way');

// ---- 13. The notice is never hidden behind an open dialog
await page.getByTestId('ready').click();
await page.getByTestId('handin-overview').waitFor();
await tabE.getByTestId('claimed-leave').click();
await tabE.getByTestId('resume').click(); // tabE takes the exam over while A shows its hand-in dialog
await tabE.getByTestId('timer').waitFor();
await page.getByTestId('claimed-modal').waitFor({ timeout: 5000 });
check((await page.getByTestId('handin-overview').count()) === 0, 'the hand-in dialog is closed when the exam is taken over');
const onTop = await page.evaluate(() => {
  const r = document.querySelector('[data-testid="claimed-modal"]').getBoundingClientRect();
  return !!document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('[data-testid="claimed-modal"]');
});
check(onTop, 'the "open in another tab" notice is on top');
await tabE.close();
await page.getByTestId('claimed-leave').click();
await page.getByTestId('resume').click(); // leave a clean, running exam behind
await page.goto(`${BASE}#/`);
await page.evaluate(() => localStorage.clear());

// ---- 10. A browser that refuses localStorage: the exam still starts, with a warning
const blockedCtx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
await blockedCtx.addInitScript(() => {
  Object.defineProperty(window, 'localStorage', {
    get() {
      throw new DOMException('denied', 'SecurityError');
    },
  });
});
const bp = await blockedCtx.newPage();
const blockedErrors = [];
bp.on('pageerror', (e) => blockedErrors.push(e.message));
await bp.goto(BASE);
check((await bp.getByTestId('storage-blocked').count()) === 1, 'the overview warns that this browser blocks saving');
await bp.getByTestId('start-qm1-2023-first-sit').click();
check((await bp.getByTestId('storage-blocked').count()) === 1, 'the confirm page warns too');
await bp.getByTestId('confirm-check').check();
await bp.getByTestId('start-exam').click();
await bp.getByTestId('timer').waitFor({ timeout: 5000 });
check(true, 'Start still opens the exam when saving is blocked');
await bp.getByTestId('tile-23').click();
await bp.getByTestId('option-A').click();
await bp.getByTestId('ready').click();
await bp.getByTestId('handin-continue').click();
await bp.getByTestId('handin-confirm-yes').click();
await bp.getByTestId('summary').waitFor({ timeout: 5000 });
check(/^[\d.]+ \/ 40$/.test((await bp.getByTestId('points').innerText()).replace(/\s+/g, ' ')), 'the exam can be handed in and marked when saving is blocked');
check(blockedErrors.length === 0, `no page errors when saving is blocked ${blockedErrors.join(' | ')}`);
await blockedCtx.close();

check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
await browser.close();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL REGRESSION CHECKS PASSED');
process.exit(failures ? 1 : 0);
