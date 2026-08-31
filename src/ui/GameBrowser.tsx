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

/**
 * The competition, stage and pool the loaded fixtures report. Federations publish
 * the hierarchy behind endpoints of its own, but a club credential is not always
 * allowed to read those and every fixture carries the same values anyway.
 */
function facetOptions(
  games: GameSummary[],
  idKey: IdKey,
  label: (game: GameSummary) => string,
): Array<{ value: string; label: string }> {
  const named = new Map<string, string>()
  for (const game of games) {
    const id = game[idKey]
    if (id) named.set(id, label(game))
  }
  return [...named]
    .map(([value, text]) => ({ value, label: text }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * Browses a federation's fixture list and hands the chosen game back. Region and
 * date range decide what is fetched; competition, stage, pool and the free text
 * box narrow what came back.
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
  // The fixtures together with the request they answer, so that "still loading" is
  // that mismatch rather than a second flag to keep in step.
  const [loaded, setLoaded] = useState<{ forRequest: string; games: GameSummary[] } | null>(null)
  // The cause is kept untranslated so that switching language re-renders the
  // message rather than leaving the one the fetch happened to be phrased in.
  const [failure, setFailure] = useState<unknown>(null)
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
      (cause) => !cancelled && setFailure(cause),
    )

    return () => {
      cancelled = true
    }
  }, [provider, ready])

  // A dateless range means "what is coming up", which most federations answer from
  // an endpoint of its own.
  const dated = Boolean(dateFrom || dateTo)
  const fetchable = dated ? provider.listGames : (provider.listUpcomingGames ?? provider.listGames)
  const request = JSON.stringify([provider.id, dated, regionId, dateFrom, dateTo])

  useEffect(() => {
    if (!ready || !fetchable) return
    let cancelled = false

    void fetchable({
      regionId: regionId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }).then(
      (items) => {
        if (cancelled) return
        setLoaded({ forRequest: request, games: items })
        setFailure(null)
      },
      (cause) => {
        if (cancelled) return
        // Settle the request anyway, or the list stays "loading" forever.
        setLoaded({ forRequest: request, games: [] })
        setFailure(cause)
      },
    )

    return () => {
      cancelled = true
    }
  }, [fetchable, ready, request, regionId, dateFrom, dateTo])

  const games = loaded?.games ?? []
  const loadingGames = ready && Boolean(fetchable) && loaded?.forRequest !== request

  const patch = (change: Partial<Settings>) => onSettingsChange({ ...settings, ...change })

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

  // Federations run a men's and a women's competition under one name, so the mark
  // is what tells the two entries apart.
  const genderMark = (game: GameSummary) =>
    game.gender === 'f' ? ` (${t('browser.women')})` : game.gender === 'm' ? ` (${t('browser.men')})` : ''

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
            onChange={(value) => patch({ regionId: value, competitionId: '', stageId: '', poolId: '' })}
          />
        )}
        <SelectField
          label={t('browser.competition')}
          value={competitionId}
          options={facetOptions(
            games,
            'competitionId',
            (game) => `${game.competitionName ?? game.competitionId}${genderMark(game)}`,
          )}
          onChange={(value) => patch({ competitionId: value, stageId: '', poolId: '' })}
        />
        <SelectField
          label={t('browser.stage')}
          value={stageId}
          options={facetOptions(
            games.filter((game) => !competitionId || game.competitionId === competitionId),
            'stageId',
            (game) => game.stageName ?? game.stageId ?? '',
          )}
          onChange={(value) => patch({ stageId: value, poolId: '' })}
        />
        <SelectField
          label={t('browser.pool')}
          value={poolId}
          options={facetOptions(
            games.filter((game) => !stageId || game.stageId === stageId),
            'poolId',
            (game) => game.poolName ?? game.poolId ?? '',
          )}
          onChange={(value) => patch({ poolId: value })}
        />
        <TextField
          label={t('browser.from')}
          type="date"
          value={dateFrom}
          onChange={setDateFrom}
          hint={t('browser.dateHint')}
        />
        <TextField label={t('browser.to')} type="date" value={dateTo} onChange={setDateTo} />
        <TextField
          label={t('browser.filter')}
          value={search}
          onChange={setSearch}
          placeholder={t('browser.filterPlaceholder')}
        />
      </div>

      {loadingGames && <Spinner label={t('browser.loading.games')} />}
      {failure !== null && <Banner kind="error">{describeError(failure, t)}</Banner>}

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
