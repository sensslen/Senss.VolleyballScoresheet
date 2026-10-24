import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { createScoresheet, emptySet } from '../scoresheet/factory'
import { paperScoresheet } from '../scoresheet/paper'
import { ruleSetById } from '../scoresheet/rules'
import type { TeamSide } from '../scoresheet/model'
import { ResultsSection } from './SheetSections'

afterEach(cleanup)

it('matches the mirrored paper results columns, totals, win flags and match clock across midnight', () => {
  const sheet = createScoresheet(ruleSetById('fivb-best-of-3'))
  sheet.toss.leftSide = 'B'
  sheet.teams.A.name = 'Home'
  sheet.teams.B.name = 'Guest'
  const scores = [[25, 21], [19, 25], [11, 15]]
  const timeouts = [[1, 2], [2, 1], [0, 0]]
  const substitutions = [[2, 1], [1, 0], [0, 1]]
  sheet.sets = scores.map(([a = 0, b = 0], index) => {
    const set = emptySet(index + 1)
    set.firstServe = 'A'
    const winner: TeamSide = a > b ? 'A' : 'B'
    const loser = winner === 'A' ? 'B' : 'A'
    set.rallies = Array.from({ length: Math.min(a, b) * 2 }, (_, rally) => ({ winner: rally % 2 ? loser : winner }))
      .concat(Array.from({ length: Math.abs(a - b) }, () => ({ winner })))
    set.durationMinutes = index === 2 ? 14 : 15
    for (const [sideIndex, side] of (['A', 'B'] as const).entries()) {
      set.timeouts.push(...Array.from({ length: timeouts[index]![sideIndex]! }, () => ({ team: side, atRally: 0, scoreA: 0, scoreB: 0 })))
      set.substitutions[side] = Array.from({ length: substitutions[index]![sideIndex]! }, () => ({ slot: 0, outPlayerId: 'out', inPlayerId: 'in', atRally: 0, scoreA: 0, scoreB: 0 }))
    }
    return set
  })
  sheet.sets[0]!.startTime = new Date(2026, 9, 24, 23, 50).toISOString()
  sheet.sets[2]!.endTime = new Date(2026, 9, 25, 0, 40).toISOString()
  render(<ResultsSection sheet={paperScoresheet(sheet)} />)
  const table = screen.getByRole('table') as HTMLTableElement
  expect(table.tHead!.rows[0]!.cells[0]!.textContent).toContain('Guest')
  expect(table.tHead!.rows[0]!.cells[2]!.textContent).toContain('Home')
  expect([...table.tHead!.rows[1]!.cells].map((cell) => cell.textContent)).toEqual(['T', 'S', 'W', 'P', 'P', 'W', 'S', 'T'])
  const rows = [...table.tBodies[0]!.rows].map((row) => [...row.cells].map((cell) => cell.textContent))
  expect(rows).toEqual([
    ['2', '1', '0', '21', '1. (15)', '25', '1', '2', '1'],
    ['1', '0', '1', '25', '2. (15)', '19', '0', '1', '2'],
    ['0', '1', '1', '15', '3. (14)', '11', '0', '0', '0'],
    ['3', '2', '2', '61', 'Total (44)', '55', '1', '3', '3'],
  ])
  expect(screen.getByText('23:50')).toBeTruthy()
  expect(screen.getByText('00:40')).toBeTruthy()
  expect(screen.getByText('0:50')).toBeTruthy()
  expect(screen.getByText('Guest 2:1')).toBeTruthy()
})

it('does not copy an unfinished set into the final results', () => {
  const sheet = createScoresheet()
  sheet.sets[0]!.firstServe = 'A'
  sheet.sets[0]!.rallies = Array.from({ length: 8 }, () => ({ winner: 'A' }))
  render(<ResultsSection sheet={sheet} />)
  const table = screen.getByRole('table') as HTMLTableElement
  expect([...table.tBodies[0]!.rows[0]!.cells].map((cell) => cell.textContent)).toEqual(['', '', '', '', '1.', '', '', '', ''])
})
