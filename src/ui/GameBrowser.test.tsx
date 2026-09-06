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
const NLA_W_QUALI_D = game('4', 'f', ['5027', 'NLA'], ['10032', 'Qualifikation'], ['9071', 'Gruppe D'])
const NLA_W_QUALI_A2 = game('5', 'f', ['5027', 'NLA'], ['10032', 'Qualifikation'], ['9069', 'Gruppe A'])

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
      submitResult: false,
    },
    isReady: () => true,
    listGames: async () => [NLA_W_QUALI, NLA_W_PLAYOFF, NLA_M_QUALI, NLA_W_QUALI_D, NLA_W_QUALI_A2],
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

function filterLabels(): string[] {
  return Array.from(document.querySelectorAll('.field-label')).map((span) => span.textContent ?? '')
}

describe('fixture filters', () => {
  afterEach(cleanup)

  it('loads the fixtures without being asked, and with no date range of its own', async () => {
    const listGames = vi.fn<(query: GameQuery) => Promise<GameSummary[]>>(async () => [NLA_W_QUALI])
    render(<Harness provider={stubProvider({ listGames })} />)

    await waitFor(() => expect(matchRows()).toEqual(['Home 1 vs Away 1']))
    expect(listGames).toHaveBeenCalledTimes(1)
    expect(listGames.mock.calls.at(0)?.at(0)).toEqual({ dateFrom: undefined, dateTo: undefined })
  })

  it('reloads for a date range', async () => {
    const user = userEvent.setup()
    const listGames = vi.fn<(query: GameQuery) => Promise<GameSummary[]>>(async () => [NLA_W_QUALI])
    render(<Harness provider={stubProvider({ listGames })} />)

    await waitFor(() => expect(listGames).toHaveBeenCalledTimes(1))
    await user.type(screen.getByLabelText('From'), '2026-09-01')

    await waitFor(() => expect(listGames.mock.calls.length).toBeGreaterThan(1))
    expect(listGames.mock.calls.at(-1)?.at(0)).toMatchObject({ dateFrom: '2026-09-01' })
  })

  it('refetches the same request when refresh is pressed', async () => {
    const user = userEvent.setup()
    const listGames = vi.fn<(query: GameQuery) => Promise<GameSummary[]>>(async () => [NLA_W_QUALI])
    render(<Harness provider={stubProvider({ listGames })} />)

    await waitFor(() => expect(listGames).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => expect(listGames).toHaveBeenCalledTimes(2))
  })

  it('renders a bounded number of rows and says how many are held back', async () => {
    const many = Array.from({ length: 260 }, (_, index) =>
      game(String(index), 'f', ['5027', 'NLA'], ['10032', 'Qualifikation'], ['9069', 'Gruppe A']),
    )
    render(<Harness provider={stubProvider({ listGames: async () => many })} />)

    await waitFor(() => expect(matchRows()).toHaveLength(200))
    expect(screen.getByText('60 more fixtures match. Narrow the filters to reach them.')).toBeTruthy()
  })

  it('opens one level at a time, each built out of the fixtures the level above left', async () => {
    const user = userEvent.setup()
    render(<Harness provider={stubProvider()} />)

    await waitFor(() => expect(matchRows()).toHaveLength(5))
    expect(optionsOf('Competition')).toEqual(['--', 'NLA (M)', 'NLA (W)'])
    expect(screen.queryByLabelText('Stage')).toBeNull()
    expect(screen.queryByLabelText('Pool')).toBeNull()

    await user.selectOptions(screen.getByLabelText('Competition'), '5027')
    expect(matchRows()).toEqual([
      'Home 1 vs Away 1',
      'Home 2 vs Away 2',
      'Home 4 vs Away 4',
      'Home 5 vs Away 5',
    ])
    expect(optionsOf('Stage')).toEqual(['--', 'Playoff', 'Qualifikation'])
    expect(screen.queryByLabelText('Pool')).toBeNull()

    await user.selectOptions(screen.getByLabelText('Stage'), '10032')
    expect(matchRows()).toEqual(['Home 1 vs Away 1', 'Home 4 vs Away 4', 'Home 5 vs Away 5'])
    expect(optionsOf('Pool')).toEqual(['--', 'Gruppe A', 'Gruppe D'])

    await user.selectOptions(screen.getByLabelText('Pool'), '9069')
    expect(matchRows()).toEqual(['Home 1 vs Away 1', 'Home 5 vs Away 5'])
  })

  it('hides a level with nothing to choose and lets the next one take its turn', async () => {
    render(<Harness provider={stubProvider({ listGames: async () => [NLA_W_QUALI, NLA_W_PLAYOFF] })} />)

    await waitFor(() => expect(matchRows()).toHaveLength(2))
    // One competition, and a pool that follows the stage exactly: only the stage
    // is a question worth putting.
    expect(filterLabels()).toEqual(['Stage', 'From', 'To', 'Filter list'])
    expect(optionsOf('Stage')).toEqual(['--', 'Playoff', 'Qualifikation'])
  })

  it('keeps the date and text filters up whatever the fixtures offer', async () => {
    render(<Harness provider={stubProvider({ listGames: async () => [NLA_W_QUALI] })} />)

    await waitFor(() => expect(matchRows()).toHaveLength(1))
    // One fixture: every level has a single choice, so no select earns its place.
    expect(filterLabels()).toEqual(['From', 'To', 'Filter list'])
  })

  it('offers the teams once one league and group is all that is left', async () => {
    const user = userEvent.setup()
    render(<Harness provider={stubProvider({ listGames: async () => [NLA_W_QUALI, NLA_W_QUALI_A2] })} />)

    await waitFor(() => expect(matchRows()).toHaveLength(2))
    expect(filterLabels()).toEqual(['Team', 'From', 'To', 'Filter list'])
    expect(optionsOf('Team')).toEqual(['--', 'Away 1', 'Away 5', 'Home 1', 'Home 5'])

    await user.selectOptions(screen.getByLabelText('Team'), '5h')
    expect(matchRows()).toEqual(['Home 5 vs Away 5'])
  })

  it('holds the teams back until the levels above are settled', async () => {
    const user = userEvent.setup()
    render(<Harness provider={stubProvider()} />)

    await waitFor(() => expect(matchRows()).toHaveLength(5))
    expect(screen.queryByLabelText('Team')).toBeNull()

    await user.selectOptions(screen.getByLabelText('Competition'), '5027')
    await user.selectOptions(screen.getByLabelText('Stage'), '10032')
    // Two pools still to choose between, so the team is not yet the question.
    expect(screen.queryByLabelText('Team')).toBeNull()

    await user.selectOptions(screen.getByLabelText('Pool'), '9069')
    expect(optionsOf('Team')).toEqual(['--', 'Away 1', 'Away 5', 'Home 1', 'Home 5'])
  })

  it('ignores a stored id the loaded fixtures no longer offer', async () => {
    render(
      <GameBrowser
        provider={stubProvider({ listGames: async () => [NLA_W_QUALI, NLA_W_PLAYOFF] })}
        settings={{ providerId: 'stub', competitionId: '4711' }}
        onSettingsChange={() => {}}
        onOpenSettings={() => {}}
        onPick={() => {}}
      />,
    )

    await waitFor(() => expect(matchRows()).toHaveLength(2))
  })

  it('says the filters excluded everything rather than looking unloaded', async () => {
    const user = userEvent.setup()
    render(<Harness provider={stubProvider()} />)

    await waitFor(() => expect(matchRows()).toHaveLength(5))
    await user.type(screen.getByLabelText('Filter list'), 'nothing matches this')

    expect(screen.getByText('No loaded fixture matches these filters.')).toBeTruthy()
  })
})
