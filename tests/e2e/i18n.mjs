// Language checks in a real browser, for all 24 languages:
// - browser-language detection on the first visit, the switcher, persistence across reloads, <html lang>, page title;
// - no untranslated keys or unfilled {placeholders} on any screen;
// - no horizontal overflow and no clipped buttons on a phone (375 px), with extra screenshots for de, fi, hu;
// - Greek (el) and Cyrillic (bg) text renders with real glyphs (no missing-glyph boxes) + screenshots.
// Run with the dev server on :5173:  node tests/e2e/i18n.mjs
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173/';
const OUT = path.dirname(new URL(import.meta.url).pathname) + '/shots';
const EXAM = 'qm1-2025-exam';
const LANGS = 'bg cs da de el en es et fi fr ga hr hu it lt lv mt nl pl pt ro sk sl sv'.split(' ');
let failures = 0;
const check = (cond, msg) => {
  if (!cond || process.env.VERBOSE) console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures++;
};

const browser = await chromium.launch();
const errors = [];
const watch = (page) => {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
};

// ---- detection, switcher, persistence ----
{
  const ctx = await browser.newContext({ locale: 'de-AT' });
  const page = await ctx.newPage();
  watch(page);
  await page.goto(BASE);
  check((await page.evaluate(() => document.documentElement.lang)) === 'de', 'first visit with a de-AT browser opens in German');
  await page.getByTestId('lang-select').selectOption('el');
  check((await page.evaluate(() => document.documentElement.lang)) === 'el', 'switcher sets <html lang="el">');
  await page.reload();
  check((await page.evaluate(() => document.documentElement.lang)) === 'el', 'the choice survives a reload');
  const options = await page.getByTestId('lang-select').locator('option').allTextContents();
  check(options.length === 24 && options.includes('Ελληνικά') && options.includes('Eesti') && options.includes('Български'), `switcher lists 24 endonyms (${options.length})`);
  await ctx.close();
}
{
  const ctx = await browser.newContext({ locale: 'ja-JP' });
  const page = await ctx.newPage();
  await page.goto(BASE);
  check((await page.evaluate(() => document.documentElement.lang)) === 'en', 'unsupported browser language falls back to English');
  await ctx.close();
}

// Visible text of the page without exam content (marked lang="en" inside a translated page).
const uiText = (page) =>
  page.evaluate(() => {
    const root = document.body.cloneNode(true);
    root.querySelectorAll('[lang="en"], .katex, select option, script, style, noscript').forEach((n) => n.remove());
    return root.innerText;
  });

const overflow = (page) =>
  page.evaluate(() => {
    const out = [];
    if (document.documentElement.scrollWidth > window.innerWidth + 1) out.push(`page is ${document.documentElement.scrollWidth}px wide`);
    for (const el of document.querySelectorAll('button, .btn, .pill, .lang-face, h1, h2, h3, dt, th, .tile-group-label, .k')) {
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible') out.push(`clipped: ${el.textContent.trim().slice(0, 40)}`);
      // Anything sticking out of the viewport on the right (tables scroll inside .table-wrap, so skip those).
      if (r.right > window.innerWidth + 1 && !el.closest('.table-wrap')) out.push(`off-screen: ${el.textContent.trim().slice(0, 40)}`);
    }
    return out;
  });

const KEY_RE = /\b(meta|lang|common|storage|examType|key|notFound|start|confirm|exam|handin|claimed|answer|calc|results|status|review|selfMark|predict)\.[a-z][A-Za-z.]*[A-Za-z]\b/;

async function screens(page, lang, shots) {
  const found = [];
  const visit = async (name) => {
    const text = await uiText(page);
    const key = text.match(KEY_RE);
    if (key) found.push(`${name}: raw key "${key[0]}"`);
    const ph = text.match(/\{[a-zA-Z]+\}/);
    if (ph) found.push(`${name}: unfilled placeholder ${ph[0]}`);
    for (const o of await overflow(page)) found.push(`${name}: ${o}`);
    if (shots) await page.screenshot({ path: `${OUT}/i18n-${lang}-${name}.png`, fullPage: name !== 'exam' });
  };
  await page.goto(BASE + '#/');
  await page.getByTestId('exam-table').first().waitFor();
  const details = page.locator('.predict-how');
  if (await details.count()) await details.first().evaluate((d) => (d.open = true));
  await visit('overview');
  await page.goto(BASE + `#/start/${EXAM}`);
  await page.getByTestId('confirm-screen').waitFor();
  await visit('confirm');
  await page.getByTestId('confirm-check').check();
  await page.getByTestId('start-exam').click();
  await page.getByTestId('timer').waitFor();
  await page.getByTestId('tile-15').click(); // a matching question
  await visit('exam');
  await page.getByTestId('ready').click();
  await page.getByTestId('handin-overview').waitFor();
  await visit('handin');
  await page.getByTestId('handin-continue').click();
  await page.getByTestId('handin-confirm-yes').click();
  await page.getByTestId('summary').waitFor();
  await visit('results');
  return found;
}

for (const lang of LANGS) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 740 }, deviceScaleFactor: 1, locale: 'en-GB' });
  await ctx.addInitScript((l) => {
    if (!sessionStorage.getItem('init')) {
      localStorage.clear();
      localStorage.setItem('mtv:v1:lang', l);
      sessionStorage.setItem('init', '1');
    }
  }, lang);
  const page = await ctx.newPage();
  watch(page);
  await page.goto(BASE);
  check((await page.evaluate(() => document.documentElement.lang)) === lang, `${lang}: <html lang>`);
  const title = await page.title();
  check(lang === 'en' || !title.startsWith('Overview'), `${lang}: translated page title "${title}"`);
  const found = await screens(page, lang, ['de', 'fi', 'hu', 'el', 'bg'].includes(lang));
  check(found.length === 0, `${lang}: all screens fine on a phone${found.length ? '\n     ' + found.join('\n     ') : ''}`);
  if (lang === 'el' || lang === 'bg') {
    // Missing glyphs would all be drawn as the same "tofu" box: compare widths of the letters against a private-use
    // code point that no font has, in the page's own font.
    const missing = await page.evaluate((sample) => {
      const c = document.createElement('canvas').getContext('2d');
      c.font = `16px ${getComputedStyle(document.body).fontFamily}`;
      const tofu = c.measureText('').width;
      return [...sample].filter((ch) => ch.trim() && c.measureText(ch).width === tofu).join('');
    }, lang === 'el' ? 'αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΩάέήίόύώ' : 'абвгдежзийклмнопрстуфхцчшщъьюяБГДЖЗИЙЛПФЦЧШЩЪЮЯ');
    check(missing === '', `${lang}: every ${lang === 'el' ? 'Greek' : 'Cyrillic'} letter has a glyph${missing ? ` (missing: ${missing})` : ''}`);
  }
  await ctx.close();
}

// Desktop sanity check in the longest languages.
for (const lang of ['de', 'fi', 'hu']) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  await ctx.addInitScript((l) => {
    if (!sessionStorage.getItem('init')) {
      localStorage.clear();
      localStorage.setItem('mtv:v1:lang', l);
      sessionStorage.setItem('init', '1');
    }
  }, lang);
  const page = await ctx.newPage();
  const found = await screens(page, `${lang}-desktop`, lang === 'de');
  check(found.length === 0, `${lang}: desktop screens fine${found.length ? '\n     ' + found.join('\n     ') : ''}`);
  await ctx.close();
}

check(errors.length === 0, `no page errors${errors.length ? ': ' + [...new Set(errors)].slice(0, 5).join(' | ') : ''}`);
await browser.close();
console.log(failures ? `\n${failures} check(s) FAILED` : '\nall i18n checks passed');
process.exit(failures ? 1 : 0);
