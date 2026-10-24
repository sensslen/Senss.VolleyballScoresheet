import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createScoresheet, emptyPlayer, emptySet } from '../scoresheet/factory'
import { computeSetState } from '../scoresheet/engine'
import { TEAM_SIDES, type Scoresheet } from '../scoresheet/model'
import { PlayStep } from './PlayStep'

function readySheet(): Scoresheet {
  const sheet = createScoresheet()
  sheet.toss = { firstServe: 'A', leftSide: 'A' }
  for (const side of TEAM_SIDES) {
    sheet.teams[side].players = Array.from({ length: 6 }, (_, index) => ({
      ...emptyPlayer(),
      number: index + 1,
    }))
    sheet.sets[0]!.lineups[side].slots = sheet.teams[side].players.map((player) => player.id)
  }
  sheet.sets[0]!.firstServe = 'A'
  return sheet
}

function Harness({ initial }: { initial: Scoresheet }) {
  const [sheet, setSheet] = useState(initial)
  const [activeSetIndex, setActiveSetIndex] = useState(0)
  return (
    <>
      <PlayStep
        sheet={sheet}
        update={(mutate) => setSheet((previous) => {
          const next = structuredClone(previous)
          mutate(next)
          return next
        })}
        activeSetIndex={activeSetIndex}
        onActiveSetChange={setActiveSetIndex}
      />
      <output data-testid="sheet">{JSON.stringify(sheet)}</output>
    </>
  )
}

function storedSheet(): Scoresheet {
  return JSON.parse(screen.getByTestId('sheet').textContent ?? '') as Scoresheet
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('set timing', () => {
  it('records system timestamps, elapsed minutes, and clears them when rallies are undone', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-24T23:55:00Z'))
    render(<Harness initial={readySheet()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Point Team A' }))
    expect(storedSheet().sets[0]!.startTime).toBe('2026-10-24T23:55:00.000Z')
    expect(storedSheet().sets[0]!.endTime).toBe('')

    vi.setSystemTime(new Date('2026-10-25T00:20:00Z'))
    for (let point = 1; point < 25; point += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Point Team A' }))
    }
    expect(storedSheet().sets[0]!.endTime).toBe('2026-10-25T00:20:00.000Z')
    expect(storedSheet().sets[0]!.durationMinutes).toBe(25)

    fireEvent.click(screen.getByRole('button', { name: 'Undo last rally' }))
    expect(storedSheet().sets[0]!.endTime).toBe('')
    expect(storedSheet().sets[0]!.durationMinutes).toBeNull()
    for (let point = 0; point < 24; point += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Undo last rally' }))
    }
    expect(storedSheet().sets[0]!.startTime).toBe('')
  })
})

function pointOrder(): string[] {
  return screen.getAllByRole('button', { name: /^Point Team/ }).map((button) => button.textContent ?? '')
}

describe('court sides', () => {
  it('aligns point buttons with the score cards and shows all six rotation positions', () => {
    render(<Harness initial={readySheet()} />)
    const pointButtons = screen.getAllByRole('button', { name: /^Point Team/ })
    const undo = screen.getByRole('button', { name: 'Undo last rally' })
    expect(pointButtons[0]!.parentElement?.classList.contains('grid-cols-2')).toBe(true)
    expect(undo.parentElement).not.toBe(pointButtons[0]!.parentElement)

    const rotation = screen.getByRole('group', { name: 'Position - Team A' })
    expect(rotation.children).toHaveLength(6)
    expect(rotation.querySelector('[aria-label="Position I: 1"]')).toBeTruthy()
    expect(rotation.querySelector('[aria-label="Position VI: 6"]')).toBeTruthy()
  })

  it('follows the initial toss and alternates between sets', () => {
    const sheet = readySheet()
    sheet.toss.leftSide = 'B'
    sheet.sets.push(emptySet(2))
    render(<Harness initial={sheet} />)
    expect(pointOrder()).toEqual(['Point Team A', 'Point Team B'])
    fireEvent.click(screen.getByRole('button', { name: 'Point Team A' }))
    expect(storedSheet().sets[0]!.rallies).toEqual([{ winner: 'B' }])
    fireEvent.click(screen.getByRole('button', { name: /^Set 2/ }))
    expect(pointOrder()).toEqual(['Point Team B', 'Point Team A'])
  })

  it('uses the deciding-set toss, switches at eight, and reverses the switch on undo', () => {
    const sheet = readySheet()
    for (let number = 2; number <= 5; number += 1) {
      const record = emptySet(number)
      record.lineups = structuredClone(sheet.sets[0]!.lineups)
      record.firstServe = 'B'
      sheet.sets.push(record)
    }
    render(<Harness initial={sheet} />)
    fireEvent.click(screen.getByRole('button', { name: /^Set 5/ }))
    expect(pointOrder()).toEqual(['Point Team A', 'Point Team B'])
    expect(screen.getByText('Record which team starts on the left in the deciding set.')).toBeTruthy()
    const selects = screen.getAllByLabelText('Starts on the left side')
    fireEvent.change(selects[1]!, { target: { value: 'B' } })
    expect(pointOrder()).toEqual(['Point Team B', 'Point Team A'])
    for (let point = 0; point < 8; point += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Point Team A' }))
    }
    expect(pointOrder()).toEqual(['Point Team A', 'Point Team B'])
    fireEvent.click(screen.getByRole('button', { name: 'Undo last rally' }))
    expect(pointOrder()).toEqual(['Point Team B', 'Point Team A'])
    fireEvent.click(screen.getByRole('button', { name: 'Point Team B' }))
    fireEvent.click(screen.getByRole('button', { name: 'Point Team A' }))
    expect(pointOrder()).toEqual(['Point Team A', 'Point Team B'])
  })

  it('starts the fifth set with a fresh toss and the previous lineup', () => {
    const sheet = readySheet()
    sheet.sets[0]!.rallies = Array.from({ length: 25 }, () => ({ winner: 'A' }))
    for (let number = 2; number <= 4; number += 1) {
      const record = emptySet(number)
      record.lineups = structuredClone(sheet.sets[0]!.lineups)
      record.firstServe = number % 2 === 0 ? 'B' : 'A'
      record.rallies = Array.from({ length: 25 }, () => ({ winner: number % 2 === 0 ? 'B' : 'A' }))
      sheet.sets.push(record)
    }

    render(<Harness initial={sheet} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start set 5' }))

    const fifth = storedSheet().sets[4]!
    expect(fifth.firstServe).toBeNull()
    expect(fifth.leftSide).toBeNull()
    expect(fifth.lineups).toEqual(sheet.sets[3]!.lineups)
    expect(screen.getByRole('region', { name: 'Set 5 lineups' })).toBeTruthy()
    expect(screen.getByLabelText('Serves first in this set')).toBeTruthy()
  })

  it('alternates service automatically in sets before the deciding set', () => {
    const sheet = readySheet()
    sheet.sets[0]!.rallies = Array.from({ length: 25 }, () => ({ winner: 'A' }))
    render(<Harness initial={sheet} />)

    fireEvent.click(screen.getByRole('button', { name: 'Start set 2' }))

    expect(storedSheet().sets[1]!.firstServe).toBe('B')
    expect(screen.queryByLabelText('Serves first in this set')).toBeNull()
  })
})

describe('lineup selection', () => {
  it('emphasizes jersey numbers in lineup options without changing their keyboard labels', () => {
    const sheet = readySheet()
    sheet.teams.A.players[0]!.number = 12
    sheet.teams.A.players[0]!.name = 'Nora Keller'
    render(<Harness initial={sheet} />)
    const position = screen.getAllByLabelText('Position I')[0] as HTMLSelectElement
    expect(position.querySelector('option strong')?.textContent).toBe('12')
    expect(position.options[1]!.textContent).toBe('12 Nora Keller')
  })

  it('keeps plain native lineup options when styled selects are unsupported', () => {
    vi.stubGlobal('CSS', { supports: () => false })
    try {
      render(<Harness initial={readySheet()} />)
      const position = screen.getAllByLabelText('Position I')[0] as HTMLSelectElement
      expect(position.querySelector('strong')).toBeNull()
      expect(position.options[1]!.textContent).toBe('1')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('records a substitute and restores the starter with an explicit return button', () => {
    const sheet = readySheet()
    const substitute = { ...emptyPlayer(), number: 7 }
    sheet.teams.A.players.push(substitute)
    const starter = sheet.sets[0]!.lineups.A.slots[2]!
    render(<Harness initial={sheet} />)
    fireEvent.click(screen.getByRole('button', { name: 'Point Team A' }))
    fireEvent.change(screen.getAllByLabelText('Position leaving')[0]!, { target: { value: '2' } })
    fireEvent.change(screen.getAllByLabelText('Player entering')[0]!, { target: { value: substitute.id } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Record substitution' })[0]!)
    expect(computeSetState(storedSheet(), 0).courtSlots.A[2]).toBe(substitute.id)
    fireEvent.click(screen.getByRole('button', { name: 'Point Team B' }))
    fireEvent.click(screen.getByRole('button', { name: 'Return no. 3 for no. 7' }))
    const updated = storedSheet()
    expect(computeSetState(updated, 0).courtSlots.A[2]).toBe(starter)
    expect(updated.sets[0]!.substitutions.A).toEqual([
      { slot: 2, outPlayerId: starter, inPlayerId: substitute.id, atRally: 0, scoreA: 1, scoreB: 0 },
      { slot: 2, outPlayerId: substitute.id, inPlayerId: starter, atRally: 1, scoreA: 1, scoreB: 1 },
    ])
    expect(screen.queryByRole('button', { name: 'Return no. 3 for no. 7' })).toBeNull()
  })

  it('highlights every repeated selection and blocks scoring until it is corrected', () => {
    const sheet = readySheet()
    render(<Harness initial={sheet} />)
    const first = screen.getAllByLabelText('Position I')[0] as HTMLSelectElement
    const second = screen.getAllByLabelText('Position II')[0] as HTMLSelectElement
    const original = second.value
    fireEvent.change(second, { target: { value: first.value } })
    expect(first.getAttribute('aria-invalid')).toBe('true')
    expect(second.getAttribute('aria-invalid')).toBe('true')
    expect((screen.getByRole('button', { name: 'Point Team A' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(second, { target: { value: original } })
    expect(first.hasAttribute('aria-invalid')).toBe(false)
    expect(second.hasAttribute('aria-invalid')).toBe(false)
    expect((screen.getByRole('button', { name: 'Point Team A' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('copies starting positions to a new set and opens it', () => {
    const sheet = readySheet()
    sheet.sets[0]!.rallies = Array.from({ length: 25 }, () => ({ winner: 'A' }))
    render(<Harness initial={sheet} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start set 2' }))
    const updated = storedSheet()
    expect(updated.sets[1]!.lineups).toEqual(sheet.sets[0]!.lineups)
    expect(updated.sets[1]!.lineups.A).not.toHaveProperty('liberoIds')
    expect(updated.sets[1]!.firstServe).toBe('B')
    expect(screen.getByRole('region', { name: 'Set 2 lineups' })).toBeTruthy()
    const positions = screen.getAllByLabelText('Position I')
    fireEvent.change(positions[0]!, { target: { value: '' } })
    expect(storedSheet().sets[0]!.lineups).toEqual(sheet.sets[0]!.lineups)
  })

  it('focuses and opens the next position after selecting a player', () => {
    render(<Harness initial={readySheet()} />)
    const first = screen.getAllByLabelText('Position I')[0] as HTMLSelectElement
    const next = screen.getAllByLabelText('Position II')[0] as HTMLSelectElement
    const showPicker = vi.fn()
    next.showPicker = showPicker
    vi.stubGlobal('navigator', { userActivation: { isActive: true } })
    fireEvent.change(first, { target: { value: first.options[2]!.value } })
    expect(document.activeElement).toBe(next)
    expect(showPicker).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })

  it('continues from the last position of one team to the first position of the other', () => {
    render(<Harness initial={readySheet()} />)
    const lastOfTeamA = screen.getAllByLabelText('Position VI')[0] as HTMLSelectElement
    const firstOfTeamB = screen.getAllByLabelText('Position I')[1] as HTMLSelectElement
    const showPicker = vi.fn()
    firstOfTeamB.showPicker = showPicker
    vi.stubGlobal('navigator', { userActivation: { isActive: true } })
    fireEvent.change(lastOfTeamA, { target: { value: lastOfTeamA.options[2]!.value } })
    expect(document.activeElement).toBe(firstOfTeamB)
    expect(showPicker).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })
})
