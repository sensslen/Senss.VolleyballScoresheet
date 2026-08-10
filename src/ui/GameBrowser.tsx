import { useCallback, useEffect, useState } from 'react'

import type {
  Competition,
  FederationProvider,
  GameSummary,
  Pool,
  Region,
  Stage,
} from '../federation/types'
import type { Settings } from '../scoresheet/storage'
import { Banner, Card, EmptyState, SelectField, Spinner, TextField } from './components'

/**
 * Browses a federation's fixture list down the neutral hierarchy
 * (region -> competition -> stage -> pool) and hands the chosen game back.
 */
export function GameBrowser({
  provider,
  settings,
  onSettingsChange,
  onPick,
}: {
  provider: FederationProvider
  settings: Settings
  onSettingsChange: (settings: Settings) => void
  onPick: (game: GameSummary) => void
}) {
  const [regions, setRegions] = useState<Region[]>([])
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [stages, setStages] = useState<Stage[]>([])
  const [pools, setPools] = useState<Pool[]>([])
  const [games, setGames] = useState<GameSummary[]>([])
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const regionId = settings.regionId ?? ''
  const competitionId = settings.competitionId ?? ''
  const stageId = settings.stageId ?? ''
  const poolId = settings.poolId ?? ''

  const run = useCallback(async <T,>(what: string, work: () => Promise<T>, apply: (value: T) => void) => {
    setLoading(what)
    setError(null)
    try {
      apply(await work())
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setLoading(null)
    }
  }, [])

  useEffect(() => {
    if (!provider.isReady() || !provider.listRegions) return
    void run('regions', () => provider.listRegions!(), setRegions)
  }, [provider, run])

  useEffect(() => {
    if (!provider.isReady() || !provider.listCompetitions) return
    setCompetitions([])
    void run('competitions', () => provider.listCompetitions!({ regionId: regionId || undefined }), setCompetitions)
  }, [provider, regionId, run])

  useEffect(() => {
    if (!competitionId || !provider.listStages) {
      setStages([])
      return
    }
    void run('stages', () => provider.listStages!(competitionId), setStages)
  }, [provider, competitionId, run])

  useEffect(() => {
    if (!stageId || !provider.listPools) {
      setPools([])
      return
    }
    void run('pools', () => provider.listPools!(stageId), setPools)
  }, [provider, stageId, run])

  const patch = (change: Partial<Settings>) => onSettingsChange({ ...settings, ...change })

  const loadGames = () => {
    if (!provider.listGames) return
    void run(
      'games',
      () =>
        provider.listGames!({
          regionId: regionId || undefined,
          competitionId: competitionId || undefined,
          stageId: stageId || undefined,
          poolId: poolId || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        }),
      setGames,
    )
  }

  const loadUpcoming = () => {
    if (!provider.listUpcomingGames) return
    void run(
      'games',
      () =>
        provider.listUpcomingGames!({
          regionId: regionId || undefined,
          competitionId: competitionId || undefined,
          stageId: stageId || undefined,
          poolId: poolId || undefined,
        }),
      setGames,
    )
  }

  if (!provider.capabilities.browseGames) {
    return (
      <Card title="Browse fixtures">
        <EmptyState>
          {provider.name} does not offer fixture browsing. Start a blank sheet and type the match details in.
        </EmptyState>
      </Card>
    )
  }

  if (!provider.isReady()) {
    return (
      <Card title="Browse fixtures">
        <Banner kind="info">
          {provider.name} needs {provider.auth?.label ?? 'a credential'} before it can list games. Add it under
          Settings, or start a blank sheet and fill everything in by hand.
        </Banner>
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
    <Card title="Browse fixtures" subtitle={`${provider.country.flag} ${provider.name}`}>
      <div className="grid grid-4">
        {provider.capabilities.regions && (
          <SelectField
            label="Region"
            value={regionId}
            options={regions.map((region) => ({ value: region.id, label: region.name }))}
            onChange={(value) => patch({ regionId: value, competitionId: '', stageId: '', poolId: '' })}
          />
        )}
        <SelectField
          label="Competition"
          value={competitionId}
          options={competitions.map((competition) => ({
            value: competition.id,
            label: `${competition.name}${competition.gender ? ` (${competition.gender === 'f' ? 'W' : 'M'})` : ''}`,
          }))}
          onChange={(value) => patch({ competitionId: value, stageId: '', poolId: '' })}
        />
        <SelectField
          label="Stage"
          value={stageId}
          options={stages.map((stage) => ({ value: stage.id, label: stage.name }))}
          onChange={(value) => patch({ stageId: value, poolId: '' })}
        />
        <SelectField
          label="Pool"
          value={poolId}
          options={pools.map((pool) => ({ value: pool.id, label: pool.name }))}
          onChange={(value) => patch({ poolId: value })}
        />
        <TextField label="From" type="date" value={dateFrom} onChange={setDateFrom} />
        <TextField label="To" type="date" value={dateTo} onChange={setDateTo} />
        <TextField label="Filter list" value={search} onChange={setSearch} placeholder="Team, hall, match no." />
      </div>

      <div className="button-row">
        <button type="button" className="primary" onClick={loadGames}>
          Load games
        </button>
        {provider.listUpcomingGames && (
          <button type="button" onClick={loadUpcoming}>
            Upcoming only
          </button>
        )}
      </div>

      {loading && <Spinner label={`Loading ${loading}...`} />}
      {error && <Banner kind="error">{error}</Banner>}

      {visible.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Match</th>
              <th>Competition</th>
              <th>Venue</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((game) => (
              <tr key={game.id}>
                <td className="nowrap">{game.playDate ?? ''}</td>
                <td>
                  <strong>{game.home.name}</strong> vs <strong>{game.away.name}</strong>
                </td>
                <td>
                  {game.competitionName}
                  {game.poolName ? ` / ${game.poolName}` : ''}
                </td>
                <td>{game.venueName ?? ''}</td>
                <td>
                  <button type="button" className="primary" onClick={() => onPick(game)}>
                    Use this match
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && games.length === 0 && <EmptyState>Pick a competition and load the fixture list.</EmptyState>}
    </Card>
  )
}
