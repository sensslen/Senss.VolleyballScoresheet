import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  describeError,
  providerName,
  type FederationProvider,
  type GameSummary,
} from '../federation/types'
import type { Settings } from '../scoresheet/storage'
import { Banner, Card, EmptyState, SelectField, Spinner, TextField } from './components'

// A whole season runs into the thousands of fixtures, and putting every row in the
// DOM is what makes the page crawl. The filters still work on the full list.
const ROW_LIMIT = 200

interface Choice {
  value: string
  label: string
}

/**
 * The choices the given fixtures offer at one level of the hierarchy, named and
 * deduplicated. A fixture contributes more than one where the level belongs to the
 * sides playing it rather than to the fixture itself.
 */
function facetOptions(games: GameSummary[], choices: (game: GameSummary) => Choice[]): Choice[] {
  const named = new Map<string, string>()
  for (const game of games) {
    for (const { value, label } of choices(game)) if (value) named.set(value, label)
  }
  return [...named]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * One level of the hierarchy: the choices the fixtures above it left, and the one in
 * force. Federations publish the hierarchy behind endpoints of its own, but a club
 * credential is not always allowed to read those and every fixture carries the same
 * values anyway.
 *
 * A stored id the level does not offer, because the fixtures moved on or because the
 * level above has yet to be settled, filters nothing. No control that is off screen
 * can narrow the list.
 */
function facet(
  games: GameSummary[],
  choices: (game: GameSummary) => Choice[],
  stored: string,
  aboveSettled = true,
) {
  const options = facetOptions(games, choices)
  const carries = (game: GameSummary, id: string) => choices(game).some((option) => option.value === id)
  // A level is worth asking about only where some choice would leave a fixture out.
  // One choice narrows nothing, and neither do the two sides of a lone fixture.
  const narrows = options.some((option) => games.some((game) => !carries(game, option.value)))
  const value = aboveSettled && options.some((option) => option.value === stored) ? stored : ''
  return {
    options,
    value,
    show: aboveSettled && narrows,
    /** Settled: nothing left to ask, or the choice made. The level below can take its turn. */
    settled: aboveSettled && (!narrows || value !== ''),
    matches: (game: GameSummary) => !value || carries(game, value),
  }
}

/**
 * Browses a federation's fixture list and hands the chosen game back. The date range
 * decides what is fetched; competition, stage, pool, team and the free text box narrow
 * what came back.
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
  // The fixtures together with the request they answer, so that "still loading" is
  // that mismatch rather than a second flag to keep in step.
  const [loaded, setLoaded] = useState<{ forRequest: string; games: GameSummary[] } | null>(null)
  // The cause is kept untranslated so that switching language re-renders the
  // message rather than leaving the one the fetch happened to be phrased in.
  const [failure, setFailure] = useState<unknown>(null)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  // Counts the manual refreshes, so that asking for the same fixtures again is a
  // different request and fetches rather than sitting on what is already held.
  const [refreshes, setRefreshes] = useState(0)

  const competitionId = settings.competitionId ?? ''
  const stageId = settings.stageId ?? ''
  const poolId = settings.poolId ?? ''
  const teamId = settings.teamId ?? ''
  const name = providerName(provider, t)
  const ready = provider.isReady()

  const fetchable = provider.listGames
  const request = JSON.stringify([provider.id, dateFrom, dateTo, refreshes])

  useEffect(() => {
    if (!ready || !fetchable) return
    let cancelled = false

    void fetchable({
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
  }, [fetchable, ready, request, dateFrom, dateTo])

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

  // Each level narrows the fixtures the level below draws its choices from, so a
  // level only ever offers what is still reachable.
  const competition = facet(
    games,
    (game) => [
      {
        value: game.competitionId ?? '',
        label: `${game.competitionName ?? game.competitionId}${genderMark(game)}`,
      },
    ],
    competitionId,
  )
  const inCompetition = games.filter(competition.matches)
  const stage = facet(
    inCompetition,
    (game) => [{ value: game.stageId ?? '', label: game.stageName ?? game.stageId ?? '' }],
    stageId,
    competition.settled,
  )
  const inStage = inCompetition.filter(stage.matches)
  const pool = facet(
    inStage,
    (game) => [{ value: game.poolId ?? '', label: game.poolName ?? game.poolId ?? '' }],
    poolId,
    stage.settled,
  )
  const inPool = inStage.filter(pool.matches)
  const team = facet(
    inPool,
    (game) => [
      { value: game.home.id, label: game.home.name },
      { value: game.away.id, label: game.away.name },
    ],
    teamId,
    pool.settled,
  )

  const needle = search.trim().toLowerCase()
  const visible = inPool.filter(
    (game) =>
      team.matches(game) &&
      (!needle ||
        [game.home.name, game.away.name, game.competitionName, game.venue?.name, game.matchNumber]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(needle))),
  )

  const shown = visible.slice(0, ROW_LIMIT)

  return (
    <Card title={t('browser.title')} subtitle={`${provider.country.flag} ${name}`}>
      <div className="grid-4">
        {competition.show && (
          <SelectField
            label={t('browser.competition')}
            value={competition.value}
            options={competition.options}
            onChange={(value) => patch({ competitionId: value, stageId: '', poolId: '', teamId: '' })}
          />
        )}
        {stage.show && (
          <SelectField
            label={t('browser.stage')}
            value={stage.value}
            options={stage.options}
            onChange={(value) => patch({ stageId: value, poolId: '', teamId: '' })}
          />
        )}
        {pool.show && (
          <SelectField
            label={t('browser.pool')}
            value={pool.value}
            options={pool.options}
            onChange={(value) => patch({ poolId: value, teamId: '' })}
          />
        )}
        {team.show && (
          <SelectField
            label={t('common.team')}
            value={team.value}
            options={team.options}
            onChange={(value) => patch({ teamId: value })}
          />
        )}
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

      <div className="button-row">
        <button type="button" onClick={() => setRefreshes(refreshes + 1)} disabled={loadingGames}>
          {t('browser.refresh')}
        </button>
      </div>

      {loadingGames && <Spinner label={t('browser.loading.games')} />}
      {failure !== null && <Banner kind="error">{describeError(failure, t)}</Banner>}

      {shown.length > 0 && (
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
              {shown.map((game) => (
                <tr key={game.id}>
                  <td className="mono whitespace-nowrap">{game.playDate ?? ''}</td>
                  <td>
                    <strong>{game.home.name}</strong> {t('common.vs')} <strong>{game.away.name}</strong>
                  </td>
                  <td>
                    {game.competitionName}
                    {game.poolName ? ` / ${game.poolName}` : ''}
                  </td>
                  <td>{game.venue?.name ?? ''}</td>
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

      {visible.length > shown.length && (
        <EmptyState>{t('browser.more', { count: visible.length - shown.length })}</EmptyState>
      )}

      {!loadingGames && visible.length === 0 && (
        <EmptyState>{games.length === 0 ? t('browser.empty') : t('browser.noMatch')}</EmptyState>
      )}
    </Card>
  )
}
