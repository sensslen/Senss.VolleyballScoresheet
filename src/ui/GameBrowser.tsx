import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  describeError,
  providerName,
  type FederationProvider,
  type GameSummary,
  type Region,
} from '../federation/types'
import type { Settings } from '../scoresheet/storage'
import { Banner, Card, EmptyState, SelectField, Spinner, TextField } from './components'

type IdKey = 'competitionId' | 'stageId' | 'poolId'
type NameKey = 'competitionName' | 'stageName' | 'poolName'

/**
 * The competition, stage and pool the loaded fixtures report. Federations publish
 * the hierarchy behind endpoints of its own, but a club credential is not always
 * allowed to read those and every fixture carries the same values anyway.
 */
function facetOptions(games: GameSummary[], idKey: IdKey, nameKey: NameKey): Array<{ value: string; label: string }> {
  const named = new Map<string, string>()
  for (const game of games) {
    const id = game[idKey]
    if (id) named.set(id, game[nameKey] ?? id)
  }
  return [...named]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * Browses a federation's fixture list and hands the chosen game back. Region and
 * date range narrow the request; competition, stage, pool and the free text box
 * narrow what came back.
 */
export function GameBrowser({
  provider,
  settings,
  onSettingsChange,
  onOpenSettings,
  onPick,
}: {
  provider: FederationProvider
  settings: Settings
  onSettingsChange: (settings: Settings) => void
  onOpenSettings: () => void
  onPick: (game: GameSummary) => void
}) {
  const { t } = useTranslation()
  const [regions, setRegions] = useState<Region[]>([])
  const [games, setGames] = useState<GameSummary[]>([])
  const [loadingGames, setLoadingGames] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const regionId = settings.regionId ?? ''
  const competitionId = settings.competitionId ?? ''
  const stageId = settings.stageId ?? ''
  const poolId = settings.poolId ?? ''
  const name = providerName(provider, t)
  const ready = provider.isReady()

  useEffect(() => {
    if (!ready || !provider.listRegions) return
    let cancelled = false

    void provider.listRegions().then(
      (items) => !cancelled && setRegions(items),
      (cause) => !cancelled && setError(describeError(cause, t)),
    )

    return () => {
      cancelled = true
    }
  }, [provider, ready, t])

  const patch = (change: Partial<Settings>) => onSettingsChange({ ...settings, ...change })

  const fetchGames = async (work: () => Promise<GameSummary[]>) => {
    setLoadingGames(true)
    try {
      setGames(await work())
      setError(null)
    } catch (cause) {
      setError(describeError(cause, t))
    } finally {
      setLoadingGames(false)
    }
  }

  const loadGames = () => {
    if (!provider.listGames) return
    void fetchGames(() =>
      provider.listGames!({
        regionId: regionId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    )
  }

  const loadUpcoming = () => {
    if (!provider.listUpcomingGames) return
    void fetchGames(() => provider.listUpcomingGames!({ regionId: regionId || undefined }))
  }

  if (!provider.capabilities.browseGames) {
    return (
      <Card title={t('browser.title')}>
        <EmptyState>{t('browser.unsupported', { name })}</EmptyState>
      </Card>
    )
  }

  if (!ready) {
    return (
      <Card title={t('browser.title')}>
        <Banner kind="info">
          {t('browser.needCredential', {
            name,
            credential: provider.auth ? t(provider.auth.labelKey) : t('browser.credentialFallback'),
          })}
        </Banner>
        <div className="button-row">
          <button type="button" className="primary" onClick={onOpenSettings}>
            {t('browser.openSettings')}
          </button>
        </div>
      </Card>
    )
  }

  const needle = search.trim().toLowerCase()
  const visible = games.filter(
    (game) =>
      (!competitionId || game.competitionId === competitionId) &&
      (!stageId || game.stageId === stageId) &&
      (!poolId || game.poolId === poolId) &&
      (!needle ||
        [game.home.name, game.away.name, game.competitionName, game.venueName, game.matchNumber]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(needle))),
  )

  return (
    <Card title={t('browser.title')} subtitle={`${provider.country.flag} ${name}`}>
      <div className="grid-4">
        {provider.capabilities.regions && (
          <SelectField
            label={t('browser.region')}
            value={regionId}
            options={regions.map((region) => ({ value: region.id, label: region.name }))}
            onChange={(value) => patch({ regionId: value })}
          />
        )}
        <TextField label={t('browser.from')} type="date" value={dateFrom} onChange={setDateFrom} />
        <TextField label={t('browser.to')} type="date" value={dateTo} onChange={setDateTo} />
        <SelectField
          label={t('browser.competition')}
          value={competitionId}
          options={facetOptions(games, 'competitionId', 'competitionName')}
          onChange={(value) => patch({ competitionId: value, stageId: '', poolId: '' })}
        />
        <SelectField
          label={t('browser.stage')}
          value={stageId}
          options={facetOptions(
            games.filter((game) => !competitionId || game.competitionId === competitionId),
            'stageId',
            'stageName',
          )}
          onChange={(value) => patch({ stageId: value, poolId: '' })}
        />
        <SelectField
          label={t('browser.pool')}
          value={poolId}
          options={facetOptions(
            games.filter((game) => !stageId || game.stageId === stageId),
            'poolId',
            'poolName',
          )}
          onChange={(value) => patch({ poolId: value })}
        />
        <TextField
          label={t('browser.filter')}
          value={search}
          onChange={setSearch}
          placeholder={t('browser.filterPlaceholder')}
        />
      </div>

      <div className="button-row">
        <button type="button" className="primary" onClick={loadGames}>
          {t('browser.load')}
        </button>
        {provider.listUpcomingGames && (
          <button type="button" onClick={loadUpcoming}>
            {t('browser.upcoming')}
          </button>
        )}
      </div>

      {loadingGames && <Spinner label={t('browser.loading.games')} />}
      {error && <Banner kind="error">{error}</Banner>}

      {visible.length > 0 && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('common.match')}</th>
                <th>{t('common.competition')}</th>
                <th>{t('common.venue')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((game) => (
                <tr key={game.id}>
                  <td className="mono whitespace-nowrap">{game.playDate ?? ''}</td>
                  <td>
                    <strong>{game.home.name}</strong> {t('common.vs')} <strong>{game.away.name}</strong>
                  </td>
                  <td>
                    {game.competitionName}
                    {game.poolName ? ` / ${game.poolName}` : ''}
                  </td>
                  <td>{game.venueName ?? ''}</td>
                  <td>
                    <button type="button" className="primary whitespace-nowrap" onClick={() => onPick(game)}>
                      {t('browser.use')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loadingGames && visible.length === 0 && (
        <EmptyState>{games.length === 0 ? t('browser.empty') : t('browser.noMatch')}</EmptyState>
      )}
    </Card>
  )
}
