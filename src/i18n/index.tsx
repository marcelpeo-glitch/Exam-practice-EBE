import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { makeFormatters, type Formatters } from '../lib/format';
import { DICTS } from './dicts';
import { DEFAULT_LANG, detectLang, isLang, localeOf, type Lang } from './languages';
import { UI_EN, type Plural, type PluralKey, type TextKey } from './ui-en';

export { LANGS, type Lang } from './languages';

// The chosen language is kept in localStorage; without a saved choice the browser's languages decide.
export const KEY_LANG = 'mtv:v1:lang';

function savedLang(): Lang | null {
  try {
    const v = localStorage.getItem(KEY_LANG);
    return v && isLang(v) ? v : null;
  } catch {
    return null;
  }
}

export function initialLang(): Lang {
  const saved = savedLang();
  if (saved) return saved;
  try {
    return detectLang(navigator.languages?.length ? navigator.languages : [navigator.language]);
  } catch {
    return DEFAULT_LANG;
  }
}

export type Vars = Record<string, string | number>;

export interface I18n {
  lang: Lang;
  locale: string;
  setLang: (lang: Lang) => void;
  /** Translate a text key. Number variables are formatted for the active locale. */
  t: (key: TextKey, vars?: Vars) => string;
  /** Translate a plural key for count n (available as {n}). */
  tn: (key: PluralKey, n: number, vars?: Vars) => string;
  /** Like t(), but renders **bold** markers as <strong>. */
  rich: (key: TextKey, vars?: Vars) => ReactNode;
  fmt: Formatters;
}

function interpolate(s: string, vars: Vars | undefined, num: (x: number) => string): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => {
    if (!(k in vars)) return m;
    const v = vars[k];
    return typeof v === 'number' ? num(v) : v;
  });
}

/** Turn "a **b** c" into ["a ", <strong>b</strong>, " c"]. */
export function renderBold(s: string): ReactNode {
  const parts = s.split(/\*\*(.+?)\*\*/g);
  if (parts.length === 1) return s;
  return parts.map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : <Fragment key={i}>{p}</Fragment>));
}

export function makeI18n(lang: Lang, setLang: (l: Lang) => void = () => {}): I18n {
  const locale = localeOf(lang);
  const dict = DICTS[lang];
  const fmt = makeFormatters(locale);
  const plural = new Intl.PluralRules(locale);
  const num = (x: number) => fmt.num(x, 2);
  const t = (key: TextKey, vars?: Vars) => interpolate((dict[key] as string | undefined) ?? (UI_EN[key] as string), vars, num);
  const tn = (key: PluralKey, n: number, vars?: Vars) => {
    const forms = (dict[key] as Plural | undefined) ?? (UI_EN[key] as Plural);
    const form = forms[plural.select(n)] ?? forms.other;
    return interpolate(form, { n, ...vars }, num);
  };
  return { lang, locale, setLang, t, tn, rich: (key, vars) => renderBold(t(key, vars)), fmt };
}

const Ctx = createContext<I18n>(makeI18n(DEFAULT_LANG));

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY_LANG, l);
    } catch {
      /* saving blocked: the choice lasts for this tab only */
    }
  }, []);
  const value = useMemo(() => makeI18n(lang, setLang), [lang, setLang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.querySelector('meta[name="description"]')?.setAttribute('content', value.t('meta.description'));
  }, [lang, value]);

  // Follow a language change made in another tab.
  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.key === KEY_LANG && e.newValue && isLang(e.newValue)) setLangState(e.newValue);
    };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, []);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
