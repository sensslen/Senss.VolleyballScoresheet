import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { FederationProvider, GameQuery, GameSummary } from '../federation/types'
import type { Settings } from '../scoresheet/storage'
import { GameBrowser } from './GameBrowser'

function game(id: string, competition: [string, string], stage: [string, string], pool: [string, string]): GameSummary {
  return {
    id,
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

const NLA_QUALI_A = game('1', ['5027', 'NLA'], ['10032', 'Qualifikation'], ['9069', 'Gruppe A'])
const NLA_PLAYOFF_B = game('2', ['5027', 'NLA'], ['10033', 'Playoff'], ['9070', 'Gruppe B'])
const NLB_QUALI_C = game('3', ['5041', 'NLB'], ['10040', 'Qualifikation'], ['9080', 'Gruppe C'])

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
    listGames: async () => [NLA_QUALI_A, NLA_PLAYOFF_B, NLB_QUALI_C],
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

  it('offers the region the federation publishes and asks the query for it', async () => {
    const user = userEvent.setup()
    const listGames = vi.fn<(query: GameQuery) => Promise<GameSummary[]>>(async () => [NLA_QUALI_A])
    render(<Harness provider={stubProvider({ listGames })} />)

    const region = screen.getByLabelText('Region') as HTMLSelectElement
    await waitFor(() => expect(region.disabled).toBe(false))
    await user.selectOptions(region, 'SVRZ')
    await user.click(screen.getByRole('button', { name: 'Load games' }))

    await waitFor(() => expect(listGames).toHaveBeenCalled())
    expect(listGames.mock.calls.at(0)?.at(0)).toMatchObject({ regionId: 'SVRZ' })
  })

  it('builds the competition, stage and pool choices out of the loaded fixtures', async () => {
    const user = userEvent.setup()
    render(<Harness provider={stubProvider()} />)

    const competition = screen.getByLabelText('Competition') as HTMLSelectElement
    expect(competition.disabled).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Load games' }))
    await waitFor(() => expect(matchRows()).toHaveLength(3))

    expect(competition.disabled).toBe(false)
    expect(optionsOf('Competition')).toEqual(['--', 'NLA', 'NLB'])

    await user.selectOptions(competition, '5027')
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

    await user.click(screen.getByRole('button', { name: 'Load games' }))
    await waitFor(() => expect(matchRows()).toHaveLength(3))

    await user.type(screen.getByLabelText('Filter list'), 'nothing matches this')

    expect(screen.getByText('No loaded fixture matches these filters.')).toBeTruthy()
  })
})
