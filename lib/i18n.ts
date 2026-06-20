import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from '../locales/en.json';
import fr from '../locales/fr.json';
import ar from '../locales/ar.json';

const SUPPORTED = ['en', 'fr', 'ar'] as const;
type SupportedLocale = (typeof SUPPORTED)[number];

function detectLocale(): SupportedLocale {
  const code = Localization.getLocales()[0]?.languageCode ?? '';
  return (SUPPORTED as readonly string[]).includes(code)
    ? (code as SupportedLocale)
    : 'en';
}

export async function initI18n(overrideLanguage?: string | null): Promise<void> {
  const lng: SupportedLocale =
    overrideLanguage && (SUPPORTED as readonly string[]).includes(overrideLanguage)
      ? (overrideLanguage as SupportedLocale)
      : detectLocale();

  if (!i18next.isInitialized) {
    await i18next.use(initReactI18next).init({
      lng,
      fallbackLng: 'en',
      resources: {
        en: { translation: en },
        fr: { translation: fr },
        ar: { translation: ar },
      },
      interpolation: { escapeValue: false },
    });
  } else {
    await i18next.changeLanguage(lng);
  }
}
