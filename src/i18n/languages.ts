// The 24 official EU languages. `name` is the endonym shown in the language switcher; `locale` is what
// Intl uses to format dates and numbers for that language.
export const LANGS = [
  { code: 'bg', name: 'Български', locale: 'bg-BG' },
  { code: 'cs', name: 'Čeština', locale: 'cs-CZ' },
  { code: 'da', name: 'Dansk', locale: 'da-DK' },
  { code: 'de', name: 'Deutsch', locale: 'de-DE' },
  { code: 'el', name: 'Ελληνικά', locale: 'el-GR' },
  { code: 'en', name: 'English', locale: 'en-GB' },
  { code: 'es', name: 'Español', locale: 'es-ES' },
  { code: 'et', name: 'Eesti', locale: 'et-EE' },
  { code: 'fi', name: 'Suomi', locale: 'fi-FI' },
  { code: 'fr', name: 'Français', locale: 'fr-FR' },
  { code: 'ga', name: 'Gaeilge', locale: 'ga-IE' },
  { code: 'hr', name: 'Hrvatski', locale: 'hr-HR' },
  { code: 'hu', name: 'Magyar', locale: 'hu-HU' },
  { code: 'it', name: 'Italiano', locale: 'it-IT' },
  { code: 'lt', name: 'Lietuvių', locale: 'lt-LT' },
  { code: 'lv', name: 'Latviešu', locale: 'lv-LV' },
  { code: 'mt', name: 'Malti', locale: 'mt-MT' },
  { code: 'nl', name: 'Nederlands', locale: 'nl-NL' },
  { code: 'pl', name: 'Polski', locale: 'pl-PL' },
  { code: 'pt', name: 'Português', locale: 'pt-PT' },
  { code: 'ro', name: 'Română', locale: 'ro-RO' },
  { code: 'sk', name: 'Slovenčina', locale: 'sk-SK' },
  { code: 'sl', name: 'Slovenščina', locale: 'sl-SI' },
  { code: 'sv', name: 'Svenska', locale: 'sv-SE' },
] as const;

export type Lang = (typeof LANGS)[number]['code'];

export const DEFAULT_LANG: Lang = 'en';

export function isLang(x: string): x is Lang {
  return LANGS.some((l) => l.code === x);
}

export function localeOf(lang: Lang): string {
  return LANGS.find((l) => l.code === lang)?.locale ?? 'en-GB';
}

/** First supported language in the browser's preference list (e.g. "de-AT" → de), else English. */
export function detectLang(preferred: readonly string[]): Lang {
  for (const tag of preferred) {
    const primary = tag.toLowerCase().split(/[-_]/)[0];
    if (isLang(primary)) return primary;
  }
  return DEFAULT_LANG;
}
