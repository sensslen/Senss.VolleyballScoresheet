import { useState } from 'react'

import { credentials } from '../federation/credentials'
import { allProviders } from '../federation/registry'
import type { FederationProvider } from '../federation/types'
import { Banner, Card, Field, SelectField } from './components'

export function SettingsPanel({
  provider,
  onProviderChange,
}: {
  provider: FederationProvider
  onProviderChange: (providerId: string) => void
}) {
  const providers = allProviders()
  const [token, setToken] = useState(() => credentials.get(provider.id))
  const [saved, setSaved] = useState(false)

  const selectProvider = (providerId: string) => {
    onProviderChange(providerId)
    setToken(credentials.get(providerId))
    setSaved(false)
  }

  return (
    <Card title="Federation" subtitle="Which country's data source fills the sheet in for you.">
      <div className="grid grid-2">
        <SelectField
          label="Country / federation"
          value={provider.id}
          placeholder={provider.name}
          options={providers.map((candidate) => ({
            value: candidate.id,
            label: `${candidate.country.flag} ${candidate.name}`,
          }))}
          onChange={(value) => value && selectProvider(value)}
        />
        {provider.infoUrl && (
          <p className="muted">
            <a href={provider.infoUrl} target="_blank" rel="noreferrer noopener">
              API documentation
            </a>
          </p>
        )}
      </div>

      {provider.auth ? (
        <>
          <Field label={provider.auth.label} hint={provider.auth.helpText}>
            <input
              type="password"
              value={token}
              placeholder="Paste token"
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
              Save token
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
              Forget token
            </button>
            {provider.auth.helpUrl && (
              <a className="link-button" href={provider.auth.helpUrl} target="_blank" rel="noreferrer noopener">
                Where to get one
              </a>
            )}
          </div>
          {saved && <Banner kind="ok">Stored in this browser only.</Banner>}
          <Banner kind="info">
            The token is kept in this browser's local storage and sent only to the federation's API over HTTPS. Nothing
            is uploaded anywhere else, and the app has no backend. Without a token everything still works, you just type
            the match details in yourself.
          </Banner>
        </>
      ) : (
        <Banner kind="info">{provider.name} needs no credential.</Banner>
      )}
    </Card>
  )
}
