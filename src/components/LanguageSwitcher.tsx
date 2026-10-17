import { LANGS, useI18n, type Lang } from '../i18n';
import { GlobeIcon } from './Icons';

/**
 * Language picker for the header. A native <select> (keyboard, screen-reader and phone friendly) lies invisibly
 * over a compact label showing the current language's own name (its code on narrow screens).
 */
export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];
  return (
    <label className="lang-switch" title={t('lang.label')}>
      <span className="lang-face" aria-hidden="true">
        <GlobeIcon />
        <span className="lang-name">{current.name}</span>
        <span className="lang-code">{current.code.toUpperCase()}</span>
      </span>
      <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label={t('lang.label')} data-testid="lang-select">
        {LANGS.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}
