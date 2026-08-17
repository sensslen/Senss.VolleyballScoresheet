import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  describeError,
  providerName,
  type Competition,
  type FederationProvider,
  type GameSummary,
  type Pool,
  type Region,
  type Stage,
} from '../federation/types'
import type { Settings } from '../scoresheet/storage'
import { Banner, Card, EmptyState, SelectField, Spinner, TextField } from './components'

type LoadingWhat = 'regions' | 'competitions' | 'stages' | 'pools' | 'games'

/**
 * A list together with the parent selection it was loaded for, `null` before the
 * first attempt. Everything else follows: the child list of a parent that has not
 * been fetched yet is empty, and "still loading" is that mismatch rather than a
 * separate flag to keep in step.
 */
interface Loaded<T> {
  forId: string | null
  items: T[]
}

const nothingLoaded = { forId: null, items: [] }

function listFor<T>(loaded: Loaded<T>, parentId: string): T[] {
  return loaded.forId === parentId ? loaded.items : []
}

function isPending<T>(loaded: Loaded<T>, parentId: string): boolean {
  return loaded.forId !== parentId
}

/**
 * Loads one level of the hierarchy whenever its parent changes. A `null` parent
 * means the level does not apply and nothing is fetched; a superseded request is
 * dropped rather than allowed to overwrite a newer one.
 */
function useLoadedList<T>(
  parentId: string | null,
  fetch: (parentId: string) => Promise<T[]>,
  onSettled: (cause: unknown) => void,
): Loaded<T> {
  const [loaded, setLoaded] = useState<Loaded<T>>(nothingLoaded)

  useEffect(() => {
    if (parentId === null) return
    let cancelled = false

    void (async () => {
      try {
        const items = await fetch(parentId)
        if (cancelled) return
        setLoaded({ forId: parentId, items })
        onSettled(null)
      } catch (cause) {
        if (cancelled) return
        // Settle the slot anyway, or the level stays "loading" forever.
        setLoaded({ forId: parentId, items: [] })
        onSettled(cause)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [parentId, fetch, onSettled])

  return loaded
}

/**
 * Browses a federation's fixture list down the neutral hierarchy
 * (region -> competition -> stage -> pool) and hands the chosen game back.
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

  const onSettled = useCallback(
    (cause: unknown) => setError(cause === null ? null : describeError(cause, t)),
    [t],
  )

  const fetchRegions = useCallback(() => provider.listRegions?.() ?? Promise.resolve([]), [provider])
  const fetchCompetitions = useCallback(
    (id: string) => provider.listCompetitions?.({ regionId: id || undefined }) ?? Promise.resolve([]),
    [provider],
  )
  const fetchStages = useCallback((id: string) => provider.listStages?.(id) ?? Promise.resolve([]), [provider])
  const fetchPools = useCallback((id: string) => provider.listPools?.(id) ?? Promise.resolve([]), [provider])

  const regions = useLoadedList<Region>(
    ready && provider.listRegions ? provider.id : null,
    fetchRegions,
    onSettled,
  )
  const competitions = useLoadedList<Competition>(
    ready && provider.listCompetitions ? regionId : null,
    fetchCompetitions,
    onSettled,
  )
  const stages = useLoadedList<Stage>(
    competitionId && provider.listStages ? competitionId : null,
    fetchStages,
    onSettled,
  )
  const pools = useLoadedList<Pool>(stageId && provider.listPools ? stageId : null, fetchPools, onSettled)

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

  const filters = {
    regionId: regionId || undefined,
    competitionId: competitionId || undefined,
    stageId: stageId || undefined,
    poolId: poolId || undefined,
  }

  const loadGames = () => {
    if (!provider.listGames) return
    void fetchGames(() =>
      provider.listGames!({ ...filters, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
    )
  }

  const loadUpcoming = () => {
    if (!provider.listUpcomingGames) return
    void fetchGames(() => provider.listUpcomingGames!(filters))
  }

  const pending: LoadingWhat | null = loadingGames
    ? 'games'
    : provider.capabilities.regions && isPending(regions, provider.id)
      ? 'regions'
      : isPending(competitions, regionId)
        ? 'competitions'
        : competitionId && isPending(stages, competitionId)
          ? 'stages'
          : stageId && isPending(pools, stageId)
            ? 'pools'
            : null

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
  const visible = needle
    ? games.filter((game) =>
        [game.home.name, game.away.name, game.competitionName, game.venueName, game.matchNumber]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(needle)),
      )
    : games

  return (
    <Card title={t('browser.title')} subtitle={`${provider.country.flag} ${name}`}>
      <div className="grid-4">
        {provider.capabilities.regions && (
          <SelectField
            label={t('browser.region')}
            value={regionId}
            options={listFor(regions, provider.id).map((region) => ({ value: region.id, label: region.name }))}
            onChange={(value) => patch({ regionId: value, competitionId: '', stageId: '', poolId: '' })}
          />
        )}
        <SelectField
          label={t('browser.competition')}
          value={competitionId}
          options={listFor(competitions, regionId).map((competition) => ({
            value: competition.id,
            label: `${competition.name}${
              competition.gender ? ` (${competition.gender === 'f' ? t('browser.women') : t('browser.men')})` : ''
            }`,
          }))}
          onChange={(value) => patch({ competitionId: value, stageId: '', poolId: '' })}
        />
        <SelectField
          label={t('browser.stage')}
          value={stageId}
          options={listFor(stages, competitionId).map((stage) => ({ value: stage.id, label: stage.name }))}
          onChange={(value) => patch({ stageId: value, poolId: '' })}
        />
        <SelectField
          label={t('browser.pool')}
          value={poolId}
          options={listFor(pools, stageId).map((pool) => ({ value: pool.id, label: pool.name }))}
          onChange={(value) => patch({ poolId: value })}
        />
        <TextField label={t('browser.from')} type="date" value={dateFrom} onChange={setDateFrom} />
        <TextField label={t('browser.to')} type="date" value={dateTo} onChange={setDateTo} />
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

      {pending && <Spinner label={t(`browser.loading.${pending}`)} />}
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

      {!pending && games.length === 0 && <EmptyState>{t('browser.empty')}</EmptyState>}
    </Card>
  )
}
