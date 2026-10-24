import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { manualProvider } from '../federation/manualProvider'
import { createSwissVolleyProvider } from '../federation/swiss/provider'
import { createScoresheet, emptyPlayer } from '../scoresheet/factory'
import { FilledScoresheet } from './FilledScoresheet'

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    pointerId: number
    pointerType: string
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
      this.pointerType = init.pointerType ?? 'mouse'
    }
  })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('puts substitution scores under the matching position and timeouts under the points column', () => {
  const sheet = createScoresheet()
  sheet.toss = { leftSide: 'B', firstServe: 'A' }
  const players = Array.from({ length: 7 }, (_, index) => ({ ...emptyPlayer(), number: index + 1 }))
  sheet.teams.B.players = players
  const set = sheet.sets[0]!
  set.firstServe = 'A'
  set.lineups.B.slots = players.slice(0, 6).map((player) => player.id)
  set.rallies = ['A', 'B', 'A'].map((winner) => ({ winner: winner as 'A' | 'B' }))
  set.substitutions.B.push({ slot: 2, outPlayerId: players[2]!.id, inPlayerId: players[6]!.id, atRally: 2, scoreA: 2, scoreB: 1 })
  set.timeouts.push({ team: 'B', atRally: 2, scoreA: 2, scoreB: 1 })
  render(<FilledScoresheet sheet={sheet} provider={manualProvider} />)

  const setBox = screen.getByRole('region', { name: 'Set 1' })
  const team = within(setBox).getByRole('region', { name: /Team A/ })
  const substitutions = within(team).getByText('Substitutions', { selector: 'th' }).closest('tr')!
  const scores = within(team).getByRole('row', { name: 'Substitutions Score' })
  expect(within(substitutions).getAllByRole('cell')[2]!.textContent).toBe('7')
  expect(within(scores).getAllByRole('cell')[2]!.textContent).toBe('1:2')
  const timeouts = within(team).getByLabelText('Time-outs')
  expect(within(timeouts).getByText('1:2')).toBeTruthy()
  expect(timeouts.previousElementSibling?.classList.contains('paper-points')).toBe(true)
  expect(timeouts.parentElement?.classList.contains('paper-score-column')).toBe(true)
  expect(within(setBox).queryByText('Liberos')).toBeNull()
  const points = within(team).getByLabelText('Score')
  expect(points.querySelectorAll('.paper-point-scored')).toHaveLength(1)
  expect(points.querySelectorAll('.paper-point-unused[aria-hidden="true"]')).toHaveLength(47)
})

function viewport() {
  render(<FilledScoresheet sheet={createScoresheet()} provider={manualProvider} />)
  const element = screen.getByRole('region', { name: 'Filled scoresheet' })
  Object.defineProperties(element, { clientWidth: { value: 1000 }, clientHeight: { value: 600 } })
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1000, 600))
  return element
}

it('circles the captain, repeats liberos below all players, and omits unnumbered and empty staff rows', () => {
  const sheet = createScoresheet()
  sheet.toss.leftSide = 'B'
  sheet.teams.B.players = [
    { ...emptyPlayer(), number: 1, name: 'Player' },
    { ...emptyPlayer(), number: 9, name: 'Captain', isCaptain: true },
    { ...emptyPlayer(), number: 12, name: 'Libero One', licence: 'L1', isLibero: true },
    { ...emptyPlayer(), number: 13, name: 'Libero Two', licence: 'L2', isLibero: true },
    { ...emptyPlayer(), name: 'Unnumbered libero', isLibero: true },
    emptyPlayer(),
  ]
  sheet.teams.B.staff.coach = 'Coach Name'
  render(<FilledScoresheet sheet={sheet} provider={manualProvider} />)
  const roster = screen.getByRole('region', { name: 'Team A roster' })
  const table = within(roster).getByRole('table') as HTMLTableElement
  expect(table.tBodies[0]!.rows).toHaveLength(4)
  expect(within(roster).getByLabelText('Captain A: 9').classList.contains('paper-captain')).toBe(true)
  expect(within(roster).queryByRole('columnheader', { name: 'C' })).toBeNull()
  expect(within(roster).queryByRole('columnheader', { name: 'L' })).toBeNull()
  const liberos = within(roster).getByRole('rowgroup', { name: 'Liberos' })
  expect(within(liberos).getByText('Libero One')).toBeTruthy()
  expect(within(liberos).getByText('Libero Two')).toBeTruthy()
  expect(within(roster).getAllByText('Libero One')).toHaveLength(2)
  expect(within(roster).getAllByText('Libero Two')).toHaveLength(2)
  expect(within(roster).queryByText('Unnumbered libero')).toBeNull()
  expect(within(roster).getByText('Coach Name')).toBeTruthy()
  expect(within(roster).queryByText('Assistant coach')).toBeNull()
})

it('prints Swiss staff birthdays in their roster licence column and keeps generic licence identifiers unchanged', () => {
  const sheet = createScoresheet()
  sheet.teams.A.staff.coach = 'Coach Name'
  sheet.teams.A.staff.assistantCoach = 'Assistant Name'
  sheet.teams.A.staff.physiotherapist = 'Physio Name'
  sheet.teams.A.staff.doctor = 'Doctor Name'
  sheet.teams.A.staff.licences = { coach: '1980-03-12', assistantCoach: '1981-04-13', physiotherapist: '1982-05-14', doctor: '1983-06-15' }
  const { rerender } = render(<FilledScoresheet sheet={sheet} provider={createSwissVolleyProvider()} />)
  const roster = screen.getByRole('region', { name: 'Team A roster' })
  expect([...((within(roster).getByRole('table') as HTMLTableElement).tHead!.rows[0]!.cells)].map((cell) => cell.textContent)).toEqual([
    'Date of birth', 'No.', 'Name',
  ])
  expect(within(roster).getByRole('columnheader', { name: 'Date of birth' })).toBeTruthy()
  const staff = within(roster).getByRole('rowgroup', { name: 'Staff' })
  expect(within(staff).getByText('12.03.80')).toBeTruthy()
  expect(within(staff).getByText('13.04.81')).toBeTruthy()
  expect(within(staff).getByText('14.05.82')).toBeTruthy()
  expect(within(staff).getByText('15.06.83')).toBeTruthy()
  expect([...((staff as HTMLTableSectionElement).rows[1]!.cells)].map((cell) => cell.textContent)).toEqual(['12.03.80', 'C', 'Coach Name'])
  sheet.teams.A.staff.licences.coach = 'COACH-42'
  rerender(<FilledScoresheet sheet={sheet} provider={manualProvider} />)
  expect(within(roster).getByRole('columnheader', { name: 'Licence' })).toBeTruthy()
  expect(within(roster).getByText('COACH-42')).toBeTruthy()
})

it('circles the substitute on the starter\'s return and records both scores in the original position', () => {
  const sheet = createScoresheet()
  sheet.toss.leftSide = 'B'
  sheet.teams.B.players = Array.from({ length: 7 }, (_, index) => ({ ...emptyPlayer(), number: index + 1 }))
  const set = sheet.sets[0]!
  const players = sheet.teams.B.players
  set.firstServe = 'A'
  set.lineups.B.slots = players.slice(0, 6).map((player) => player.id)
  set.rallies = [{ winner: 'A' }, { winner: 'B' }, { winner: 'A' }]
  set.substitutions.B = [
    { slot: 2, outPlayerId: players[2]!.id, inPlayerId: players[6]!.id, atRally: 1, scoreA: 1, scoreB: 1 },
    { slot: 2, outPlayerId: players[6]!.id, inPlayerId: players[2]!.id, atRally: 2, scoreA: 2, scoreB: 1 },
  ]
  render(<FilledScoresheet sheet={sheet} provider={manualProvider} />)
  const team = within(screen.getByRole('region', { name: 'Set 1' })).getByRole('region', { name: /Team A/ })
  const changes = within(team).getByText('Substitutions', { selector: 'th' }).closest('tr')!
  const cell = within(changes).getAllByRole('cell')[2]!
  expect(cell.textContent).toBe('7')
  expect(cell.querySelector('.paper-returned')?.textContent).toBe('7')
  const scoreCell = within(within(team).getByRole('row', { name: 'Substitutions Score' })).getAllByRole('cell')[2]!
  expect([...scoreCell.children].map((entry) => entry.textContent)).toEqual(['1:1', '1:2'])
})

it('zooms the wheel around the cursor and prevents page scrolling', () => {
  const element = viewport()
  const wheel = new WheelEvent('wheel', { deltaY: -100, clientX: 300, clientY: 200, bubbles: true, cancelable: true })
  act(() => { element.dispatchEvent(wheel) })
  expect(wheel.defaultPrevented).toBe(true)
  expect(Number(element.querySelector<HTMLElement>('article')!.style.zoom)).toBeCloseTo(0.625 * Math.exp(0.2))
  expect(element.scrollLeft).toBeCloseTo(284 * Math.exp(0.2) + 16 - 300)
  expect(element.scrollTop).toBeCloseTo(184 * Math.exp(0.2) + 16 - 200)
})

it('pans a mouse drag and stops tracking when the pointer is cancelled', () => {
  const element = viewport()
  fireEvent.pointerDown(element, { pointerId: 1, clientX: 450, clientY: 350, button: 0 })
  fireEvent.pointerMove(element, { pointerId: 1, clientX: 400, clientY: 320 })
  fireEvent.pointerMove(element, { pointerId: 1, clientX: 350, clientY: 300 })
  expect(element.scrollLeft).toBe(100)
  expect(element.scrollTop).toBe(50)
  fireEvent.pointerCancel(element, { pointerId: 1 })
  fireEvent.pointerMove(element, { pointerId: 1, clientX: 100, clientY: 100 })
  expect(element.scrollLeft).toBe(100)
  expect(element.scrollTop).toBe(50)
})

it('pinches and moves with two touches, then continues panning with the remaining finger', () => {
  const element = viewport()
  fireEvent.pointerDown(element, { pointerType: 'touch', pointerId: 1, clientX: 200, clientY: 200, button: 0 })
  fireEvent.pointerDown(element, { pointerType: 'touch', pointerId: 2, clientX: 400, clientY: 200, button: 0 })
  fireEvent.pointerMove(element, { pointerType: 'touch', pointerId: 2, clientX: 500, clientY: 200 })
  expect(Number(element.querySelector<HTMLElement>('article')!.style.zoom)).toBeCloseTo(0.9375)
  expect(element.scrollLeft).toBeCloseTo(92)
  expect(element.scrollTop).toBeCloseTo(92)
  fireEvent.pointerUp(element, { pointerType: 'touch', pointerId: 2 })
  fireEvent.pointerMove(element, { pointerType: 'touch', pointerId: 1, clientX: 180, clientY: 180 })
  expect(element.scrollLeft).toBeCloseTo(112)
  expect(element.scrollTop).toBeCloseTo(112)
  expect(Number(element.querySelector<HTMLElement>('article')!.style.zoom)).toBeCloseTo(0.9375)
})

it('fits a selected section in both dimensions and allows selecting it with a tap', () => {
  const element = viewport()
  const section = within(element).getByRole('region', { name: 'Set 1' })
  vi.spyOn(section, 'getBoundingClientRect').mockReturnValue(new DOMRect(300, 400, 400, 200))
  fireEvent.pointerDown(within(section).getByRole('heading', { name: 'Set 1' }), { pointerId: 1, clientX: 350, clientY: 450, button: 0 })
  fireEvent.pointerUp(element, { pointerId: 1, clientX: 350, clientY: 450 })
  expect(Number(element.querySelector<HTMLElement>('article')!.style.zoom)).toBeCloseTo(1.5125)
  expect(element.scrollLeft).toBeCloseTo(726)
  expect(element.scrollTop).toBeCloseTo(926)
  expect((screen.getByLabelText('Show section') as HTMLSelectElement).value).toBe('set-1')
})

it('keeps officials separate from the header and hides unscored points after the set', () => {
  const sheet = createScoresheet()
  sheet.officials.firstReferee.name = 'Referee Name'
  sheet.remarks = 'Recorded remark'
  sheet.sets[0]!.firstServe = 'A'
  sheet.sets[0]!.rallies = Array.from({ length: 25 }, () => ({ winner: 'A' }))
  render(<FilledScoresheet sheet={sheet} provider={manualProvider} />)
  const header = screen.getByRole('region', { name: 'Match header' })
  expect(within(header).queryByText('Referee Name')).toBeNull()
  expect(within(screen.getByRole('region', { name: 'Officials' })).getByText('Referee Name')).toBeTruthy()
  expect(within(screen.getByRole('region', { name: 'Remarks' })).getByText('Recorded remark')).toBeTruthy()
  expect(screen.queryByRole('region', { name: 'Remarks and signatures' })).toBeNull()
  expect(screen.queryByText(/signatures|have signed/i)).toBeNull()
  const set = screen.getByRole('region', { name: 'Set 1' })
  const team = within(set).getByRole('region', { name: /Team A/ })
  const points = within(team).getByLabelText('Score')
  expect(points.querySelectorAll('.paper-point-scored')).toHaveLength(25)
  expect(points.querySelectorAll('.paper-point-unused[aria-hidden="true"]')).toHaveLength(23)
})

it('prints officials with country and provider-formatted licence data and keeps four line judge rows', () => {
  const sheet = createScoresheet()
  sheet.officials.firstReferee = { name: 'Meier Robin', country: 'CH', licence: '1980-03-12' }
  sheet.officials.lineJudges = ['Judge One', '', 'Judge Three', '']
  render(<FilledScoresheet sheet={sheet} provider={createSwissVolleyProvider()} />)
  const officials = screen.getByRole('region', { name: 'Officials' })
  expect(within(officials).getByText('Meier Robin')).toBeTruthy()
  expect(within(officials).getByText('CH')).toBeTruthy()
  expect(within(officials).getByText('12.03.80')).toBeTruthy()
  expect(within(officials).getByText('Judge One')).toBeTruthy()
  expect(within(officials).getByText('Judge Three')).toBeTruthy()
  expect(within(officials).getAllByRole('row')).toHaveLength(9)
})
