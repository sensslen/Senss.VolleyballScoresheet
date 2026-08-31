import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { FederationProvider, GameQuery, GameSummary } from '../federation/types'
import type { Settings } from '../scoresheet/storage'
import { GameBrowser } from './GameBrowser'

function game(
  id: string,
  gender: 'm' | 'f',
  competition: [string, string],
  stage: [string, string],
  pool: [string, string],
): GameSummary {
  return {
    id,
    gender,
    home: { id: `${id}h`, name: `Home ${id}` },
    away: { id: `${id}a`, name: `Away ${id}` },
    competitionId: competition[0],
    competitionName: competition[1],
    stageId: stage[0],
    stageName: stage[1],
    poolId: pool[0],
    poolName: pool[1],
  }
}

const NLA_W_QUALI = game('1', 'f', ['5027', 'NLA'], ['10032', 'Qualifikation'], ['9069', 'Gruppe A'])
const NLA_W_PLAYOFF = game('2', 'f', ['5027', 'NLA'], ['10033', 'Playoff'], ['9070', 'Gruppe B'])
const NLA_M_QUALI = game('3', 'm', ['5026', 'NLA'], ['10040', 'Qualifikation'], ['9080', 'Gruppe C'])

function stubProvider(overrides: Partial<FederationProvider> = {}): FederationProvider {
  return {
    id: 'stub',
    name: 'Stub Federation',
    country: { code: 'CH', nameKey: 'provider.swiss.country', flag: '🇨🇭' },
    capabilities: {
      browseGames: true,
      gameDetail: true,
      rosters: true,
      officials: true,
      regions: true,
      submitResult: false,
    },
    isReady: () => true,
    listRegions: async () => [{ id: 'SVRZ', name: 'Region Zürich' }],
    listGames: async () => [NLA_W_QUALI, NLA_W_PLAYOFF, NLA_M_QUALI],
    listUpcomingGames: async () => [NLA_W_QUALI, NLA_W_PLAYOFF, NLA_M_QUALI],
    ...overrides,
  }
}

function Harness({ provider }: { provider: FederationProvider }) {
  const [settings, setSettings] = useState<Settings>({ providerId: 'stub' })
  return (
    <GameBrowser
      provider={provider}
      settings={settings}
      onSettingsChange={setSettings}
      onOpenSettings={() => {}}
      onPick={() => {}}
    />
  )
}

function matchRows(): string[] {
  return Array.from(document.querySelectorAll('tbody tr td:nth-child(2)')).map((cell) => cell.textContent ?? '')
}

function optionsOf(label: string): string[] {
  return Array.from((screen.getByLabelText(label) as HTMLSelectElement).options).map((option) => option.text)
}

describe('fixture filters', () => {
  afterEach(cleanup)

  it('loads the upcoming fixtures without being asked', async () => {
    const listUpcomingGames = vi.fn<(query: GameQuery) => Promise<GameSummary[]>>(async () => [NLA_W_QUALI])
    render(<Harness provider={stubProvider({ listUpcomingGames })} />)

    await waitFor(() => expect(matchRows()).toEqual(['Home 1 vs Away 1']))
    expect(listUpcomingGames).toHaveBeenCalledTimes(1)
  })

  it('reloads for the picked region and for a date range', async () => {
    const user = userEvent.setup()
    const listGames = vi.fn<(query: GameQuery) => Promise<GameSummary[]>>(async () => [NLA_W_QUALI])
    const listUpcomingGames = vi.fn<(query: GameQuery) => Promise<GameSummary[]>>(async () => [NLA_W_PLAYOFF])
    render(<Harness provider={stubProvider({ listGames, listUpcomingGames })} />)

    const region = screen.getByLabelText('Region') as HTMLSelectElement
    await waitFor(() => expect(region.disabled).toBe(false))
    await user.selectOptions(region, 'SVRZ')

    await waitFor(() => expect(listUpcomingGames).toHaveBeenCalledTimes(2))
    expect(listUpcomingGames.mock.calls.at(-1)?.at(0)).toMatchObject({ regionId: 'SVRZ' })
    expect(listGames).not.toHaveBeenCalled()

    // A date range switches to the dated endpoint.
    await user.type(screen.getByLabelText('From'), '2026-09-01')

    await waitFor(() => expect(listGames).toHaveBeenCalled())
    expect(listGames.mock.calls.at(-1)?.at(0)).toMatchObject({ regionId: 'SVRZ', dateFrom: '2026-09-01' })
  })

  it('builds the competition, stage and pool choices out of the loaded fixtures', async () => {
    const user = userEvent.setup()
    render(<Harness provider={stubProvider()} />)

    await waitFor(() => expect(matchRows()).toHaveLength(3))
    expect(optionsOf('Competition')).toEqual(['--', 'NLA (M)', 'NLA (W)'])

    await user.selectOptions(screen.getByLabelText('Competition'), '5027')
    expect(matchRows()).toEqual(['Home 1 vs Away 1', 'Home 2 vs Away 2'])
    expect(optionsOf('Stage')).toEqual(['--', 'Playoff', 'Qualifikation'])

    await user.selectOptions(screen.getByLabelText('Stage'), '10032')
    expect(matchRows()).toEqual(['Home 1 vs Away 1'])
    expect(optionsOf('Pool')).toEqual(['--', 'Gruppe A'])

    await user.selectOptions(screen.getByLabelText('Pool'), '9069')
    expect(matchRows()).toEqual(['Home 1 vs Away 1'])
  })

  it('says the filters excluded everything rather than looking unloaded', async () => {
    const user = userEvent.setup()
    render(<Harness provider={stubProvider()} />)

    await waitFor(() => expect(matchRows()).toHaveLength(3))
    await user.type(screen.getByLabelText('Filter list'), 'nothing matches this')

    expect(screen.getByText('No loaded fixture matches these filters.')).toBeTruthy()
  })
})
