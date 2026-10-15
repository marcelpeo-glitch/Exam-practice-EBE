import { describe, expect, it } from 'vitest';
import { LANGS, detectLang, localeOf } from './languages';
import { UI_EN, type Plural, type UiDict } from './ui-en';

// Checks every ui-xx.ts file against the English master. Restrict to some languages with I18N_LANGS=de,fr.
const files = import.meta.glob('./ui-*.ts', { eager: true }) as Record<string, Record<string, UiDict>>;
const only = (process.env.I18N_LANGS ?? '').split(',').filter(Boolean);
const dicts = Object.entries(files)
  .map(([path, mod]) => ({ lang: path.match(/ui-(\w+)\.ts$/)![1], dict: Object.values(mod)[0] }))
  .filter((d) => d.lang !== 'en' && (!only.length || only.includes(d.lang)));

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const boldCount = (s: string) => s.split('**').length - 1;
const englishText = (v: string | Plural) => (typeof v === 'string' ? v : v.other);

describe('language files', () => {
  it('there is one file per EU language', () => {
    if (only.length) return;
    const have = Object.keys(files).map((p) => p.match(/ui-(\w+)\.ts$/)![1]).sort();
    expect(have).toEqual(LANGS.map((l) => l.code).sort());
  });

  for (const { lang, dict } of dicts) {
    describe(lang, () => {
      const rules = new Intl.PluralRules(localeOf(lang as never));
      const needed = new Set<string>();
      for (let n = 0; n <= 1000; n++) needed.add(rules.select(n));

      it('has exactly the English keys', () => {
        expect(Object.keys(dict).sort()).toEqual(Object.keys(UI_EN).sort());
      });

      for (const [key, en] of Object.entries(UI_EN) as [keyof UiDict, string | Plural][]) {
        it(key, () => {
          const v = dict[key];
          expect(v, 'missing').toBeDefined();
          if (typeof en === 'string') {
            expect(typeof v, 'should be a string').toBe('string');
            const s = v as string;
            expect(s.trim(), 'empty').not.toBe('');
            expect(placeholders(s), 'placeholders differ from English').toEqual(placeholders(en));
            expect(boldCount(s), '**bold** markers differ from English').toBe(boldCount(en));
          } else {
            expect(typeof v, 'should be a plural object').toBe('object');
            const p = v as Plural;
            expect(p.other, 'plural needs "other"').toBeTruthy();
            for (const cat of needed) expect(p[cat as keyof Plural], `plural form "${cat}" missing`).toBeTruthy();
            const enVars = placeholders(en.other).filter((x) => x !== 'n');
            for (const [cat, form] of Object.entries(p)) {
              expect(['zero', 'one', 'two', 'few', 'many', 'other'], `unknown plural category ${cat}`).toContain(cat);
              const vars = placeholders(form as string);
              for (const x of enVars) expect(vars, `"${cat}" form lacks {${x}}`).toContain(x);
              for (const x of vars) expect(['n', ...enVars], `"${cat}" form has unknown {${x}}`).toContain(x);
              if (cat === 'few' || cat === 'many' || cat === 'other') expect(vars, `"${cat}" form lacks {n}`).toContain('n');
            }
          }
        });
      }

      it('is actually translated (most strings differ from English)', () => {
        const long = (Object.keys(UI_EN) as (keyof UiDict)[]).filter((k) => englishText(UI_EN[k]).length > 12);
        const same = long.filter((k) => englishText(dict[k]) === englishText(UI_EN[k]));
        expect(same.length / long.length, `untranslated: ${same.join(', ')}`).toBeLessThan(0.1);
      });
    });
  }
});

describe('detectLang', () => {
  it('picks the first supported browser language', () => {
    expect(detectLang(['de-AT', 'en'])).toBe('de');
    expect(detectLang(['nb-NO', 'fr-BE'])).toBe('fr');
    expect(detectLang(['EL'])).toBe('el');
  });
  it('falls back to English', () => {
    expect(detectLang(['ja-JP', 'zh'])).toBe('en');
    expect(detectLang([])).toBe('en');
  });
});
