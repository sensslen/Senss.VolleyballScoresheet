import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { credentials } from '../federation/credentials'
import { allProviders } from '../federation/registry'
import { providerName, type FederationProvider } from '../federation/types'
import { languagePreference, setLanguagePreference, SUPPORTED_LANGUAGES } from '../i18n'
import { Banner, Card, Field, SelectField } from './components'

export function SettingsPanel({
  provider,
  onProviderChange,
}: {
  provider: FederationProvider
  onProviderChange: (providerId: string) => void
}) {
  const { t, i18n } = useTranslation()
  const providers = allProviders()
  const [token, setToken] = useState(() => credentials.get(provider.id))
  const [saved, setSaved] = useState(false)
  const [preference, setPreference] = useState(languagePreference)

  const activeLanguage =
    SUPPORTED_LANGUAGES.find((language) => language.code === i18n.resolvedLanguage)?.nativeName ?? ''

  const selectProvider = (providerId: string) => {
    onProviderChange(providerId)
    setToken(credentials.get(providerId))
    setSaved(false)
  }

  return (
    <>
      <Card title={t('settings.language.title')} subtitle={t('settings.language.subtitle')}>
        <div className="grid-2">
          <SelectField
            label={t('settings.language.label')}
            value={preference}
            placeholder={t('settings.language.system')}
            options={SUPPORTED_LANGUAGES.map((language) => ({
              value: language.code,
              label: language.nativeName,
            }))}
            onChange={(value) => {
              setPreference(value)
              setLanguagePreference(value)
            }}
            hint={preference ? undefined : t('settings.language.detected', { language: activeLanguage })}
          />
        </div>
      </Card>

      <Card title={t('settings.title')} subtitle={t('settings.subtitle')}>
        <div className="grid-2 mb-4">
          <div>
            <SelectField
              label={t('settings.country')}
              value={provider.id}
              required
              options={providers.map((candidate) => ({
                value: candidate.id,
                label: `${candidate.country.flag} ${providerName(candidate, t)}`,
              }))}
              onChange={(value) => value && selectProvider(value)}
            />
            {provider.infoUrl && (
              <a
                className="inline-block text-sm text-indigo-600 underline underline-offset-2 dark:text-indigo-300"
                href={provider.infoUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                {t('settings.apiDocs')}
              </a>
            )}
          </div>
        </div>

        {provider.auth ? (
          <>
            <Field label={t(provider.auth.labelKey)} hint={t(provider.auth.helpTextKey)}>
              <input
                type="password"
                value={token}
                placeholder={t('settings.tokenPlaceholder')}
                autoComplete="off"
                onChange={(event) => {
                  setToken(event.target.value)
                  setSaved(false)
                }}
              />
            </Field>
            <div className="button-row">
              <button
                type="button"
                className="primary"
                onClick={() => {
                  credentials.set(provider.id, token.trim())
                  setSaved(true)
                }}
              >
                {t('settings.save')}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  credentials.clear(provider.id)
                  setToken('')
                  setSaved(true)
                }}
              >
                {t('settings.forget')}
              </button>
              {provider.auth.helpUrl && (
                <a
                  className="self-center text-sm text-indigo-600 underline underline-offset-2 dark:text-indigo-300"
                  href={provider.auth.helpUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {t('settings.whereToGet')}
                </a>
              )}
            </div>
            {saved && <Banner kind="ok">{t('settings.stored')}</Banner>}
            <Banner kind="info">{t('settings.privacy')}</Banner>
          </>
        ) : (
          <Banner kind="info">{t('settings.noCredential', { name: providerName(provider, t) })}</Banner>
        )}
      </Card>
    </>
  )
}
