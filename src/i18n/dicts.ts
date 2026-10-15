import type { Lang } from './languages';
import { UI_BG } from './ui-bg';
import { UI_CS } from './ui-cs';
import { UI_DA } from './ui-da';
import { UI_DE } from './ui-de';
import { UI_EL } from './ui-el';
import { UI_EN, type UiDict } from './ui-en';
import { UI_ES } from './ui-es';
import { UI_ET } from './ui-et';
import { UI_FI } from './ui-fi';
import { UI_FR } from './ui-fr';
import { UI_GA } from './ui-ga';
import { UI_HR } from './ui-hr';
import { UI_HU } from './ui-hu';
import { UI_IT } from './ui-it';
import { UI_LT } from './ui-lt';
import { UI_LV } from './ui-lv';
import { UI_MT } from './ui-mt';
import { UI_NL } from './ui-nl';
import { UI_PL } from './ui-pl';
import { UI_PT } from './ui-pt';
import { UI_RO } from './ui-ro';
import { UI_SK } from './ui-sk';
import { UI_SL } from './ui-sl';
import { UI_SV } from './ui-sv';

// Every language must be here (Record<Lang, …>), and every file must match the English keys (UiDict).
export const DICTS: Record<Lang, UiDict> = {
  bg: UI_BG,
  cs: UI_CS,
  da: UI_DA,
  de: UI_DE,
  el: UI_EL,
  en: UI_EN,
  es: UI_ES,
  et: UI_ET,
  fi: UI_FI,
  fr: UI_FR,
  ga: UI_GA,
  hr: UI_HR,
  hu: UI_HU,
  it: UI_IT,
  lt: UI_LT,
  lv: UI_LV,
  mt: UI_MT,
  nl: UI_NL,
  pl: UI_PL,
  pt: UI_PT,
  ro: UI_RO,
  sk: UI_SK,
  sl: UI_SL,
  sv: UI_SV,
};
