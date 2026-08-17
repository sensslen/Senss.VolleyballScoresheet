# Translating

Strings live in `locales/<code>.json`, one file per language, loaded through
i18next in `src/i18n.ts`. `locales/en.json` is the source of truth: it defines the
key set, and a test fails if any other file misses a key, adds one, or changes the
`{{placeholders}}` in a string.

## Shipped languages

The ten languages covering the largest volleyball communities, plus German:
English, Portuguese, Italian, Polish, Russian, Japanese, Chinese, French, Spanish,
Turkish, German. `SUPPORTED_LANGUAGES` in `src/i18n.ts` carries the order the
picker shows.

The language follows the browser until someone picks one in Settings, after which
the choice is remembered in local storage. Regional tags resolve to the base
language, so `pt-BR` gets `pt` and `zh-Hans-CN` gets `zh`.

## Adding a language

1. Copy `locales/en.json` to `locales/<code>.json` and translate the values.
2. Import it in `src/i18n.ts`, add it to `resources`, and add an entry to
   `SUPPORTED_LANGUAGES` with the language's name in that language.
3. `npm test` reports any key that drifted from English.

## Rules that matter

- **Translate values, never keys.** A key is an identifier.
- **Keep every `{{placeholder}}`**, spelled the same. Word order around them is
  free; dropping one silently loses a number the scorer needs.
- **Volleyball vocabulary beats literal translation.** Use the terms the
  federation's own scoresheet uses, e.g. `Matchblatt` and `Anschreiber` in German,
  `súmula` and `apontador` in Portuguese.
- **Strings produced outside React are keys too.** The scoring engine returns
  `LocalizedMessage` values (`src/localizedMessage.ts`) so a rule problem is
  reported in the reader's language; the same goes for federation errors the app
  authors. Text that came from a federation's API is passed through untranslated.
