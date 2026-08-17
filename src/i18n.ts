import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import localizationsDe from '../locales/de.json'
import localizationsEn from '../locales/en.json'
import localizationsEs from '../locales/es.json'
import localizationsFr from '../locales/fr.json'
import localizationsIt from '../locales/it.json'
import localizationsJa from '../locales/ja.json'
import localizationsPl from '../locales/pl.json'
import localizationsPt from '../locales/pt.json'
import localizationsRu from '../locales/ru.json'
import localizationsTr from '../locales/tr.json'
import localizationsZh from '../locales/zh.json'

/**
 * The ten languages covering the largest volleyball communities, plus German.
 * Ordered by how much competitive volleyball each one serves, so the picker
 * reads as a ranking rather than an alphabet.
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', nativeName: 'English' },
  { code: 'pt', nativeName: 'Português' },
  { code: 'it', nativeName: 'Italiano' },
  { code: 'pl', nativeName: 'Polski' },
  { code: 'ru', nativeName: 'Русский' },
  { code: 'ja', nativeName: '日本語' },
  { code: 'zh', nativeName: '中文' },
  { code: 'fr', nativeName: 'Français' },
  { code: 'es', nativeName: 'Español' },
  { code: 'tr', nativeName: 'Türkçe' },
  { code: 'de', nativeName: 'Deutsch' },
] as const

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code']

export const LANGUAGE_STORAGE_KEY = 'vbs.language.v1'

export const resources = {
  en: { translation: localizationsEn },
  pt: { translation: localizationsPt },
  it: { translation: localizationsIt },
  pl: { translation: localizationsPl },
  ru: { translation: localizationsRu },
  ja: { translation: localizationsJa },
  zh: { translation: localizationsZh },
  fr: { translation: localizationsFr },
  es: { translation: localizationsEs },
  tr: { translation: localizationsTr },
  de: { translation: localizationsDe },
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES.map((language) => language.code),
    // "pt-BR" and "zh-Hans-CN" both resolve to the base language we ship.
    load: 'languageOnly',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
    },
    interpolation: {
      escapeValue: false,
    },
  })

i18n.on('languageChanged', (language) => {
  if (typeof document !== 'undefined') document.documentElement.lang = language
})

export default i18n
