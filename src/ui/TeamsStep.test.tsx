import { useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import { manualProvider } from '../federation/manualProvider'
import { createSwissVolleyProvider } from '../federation/swiss/provider'
import type { FederationProvider } from '../federation/types'
import { createScoresheet, emptyPlayer } from '../scoresheet/factory'
import type { Scoresheet } from '../scoresheet/model'
import { PlayStep } from './PlayStep'
import { RosterSection } from './SheetSections'
import { TeamsStep } from './TeamsStep'

function Harness({ initial = createScoresheet(), provider = manualProvider }: { initial?: Scoresheet; provider?: FederationProvider }) {
  const [sheet, setSheet] = useState(initial)
  return <>
    <TeamsStep sheet={sheet} provider={provider} onReplaceSheet={setSheet} update={(mutate) => setSheet((previous) => {
      const next = structuredClone(previous)
      mutate(next)
      return next
    })} />
    <output data-testid="saved-roster">{JSON.stringify(sheet.teams.A.players)}</output>
    <output data-testid="saved-staff">{JSON.stringify(sheet.teams.A.staff)}</output>
  </>
}

afterEach(cleanup)

it('requires and saves a date of birth for every named Swiss staff member', () => {
  const sheet = createScoresheet()
  sheet.teams.A.staff = { coach: 'Coach Name', assistantCoach: 'Assistant Name', assistantCoach2: 'Assistant Two', physiotherapist: 'Physio Name', doctor: 'Doctor Name' }
  render(<Harness initial={sheet} provider={createSwissVolleyProvider()} />)
  const team = screen.getByRole('region', { name: 'Team A - (unnamed)' })
  const labels = ['Coach', 'Assistant coach', 'Assistant coach 2', 'Physiotherapist', 'Doctor']
  const keys = ['coach', 'assistantCoach', 'assistantCoach2', 'physiotherapist', 'doctor'] as const
  labels.forEach((label, index) => {
    const input = within(team).getByLabelText(`${label}: Date of birth`) as HTMLInputElement
    expect(input.type).toBe('date')
    expect(input.required).toBe(true)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    fireEvent.change(input, { target: { value: `198${index}-06-15` } })
    expect(input.hasAttribute('aria-invalid')).toBe(false)
  })
  const saved = JSON.parse(screen.getByTestId('saved-staff').textContent ?? '')
  keys.forEach((key, index) => expect(saved.licences[key]).toBe(`198${index}-06-15`))
  expect(saved.coach).toBe('Coach Name')
})

it('shows six required rows plus a spare without creating players, removes row controls, and puts staff below the roster', () => {
  render(<Harness />)
  const team = screen.getByRole('region', { name: 'Team A - (unnamed)' })
  expect([...((within(team).getAllByRole('table')[0] as HTMLTableElement).tHead!.rows[0]!.cells)].map((cell) => cell.textContent)).toEqual([
    'Licence', 'No.', 'Name', 'C', 'L',
  ])
  expect(within(team).getAllByLabelText('No.')).toHaveLength(7)
  expect(screen.getByTestId('saved-roster').textContent).toBe('[]')
  expect(screen.queryByRole('button', { name: 'Add player' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull()
  expect(within(within(team).getAllByRole('table')[0]!).queryByRole('columnheader', { name: 'Position' })).toBeNull()
  expect(within(team).queryByText('No captain marked. The sheet needs the captain circled.')).toBeNull()
  expect(within(team).getAllByRole('table')[0]!.compareDocumentPosition(within(team).getByLabelText('Coach')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it('keeps entered players together, preserves focus, and always leaves one spare after six players', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  const team = screen.getByRole('region', { name: 'Team A - (unnamed)' })
  const name = within(team).getAllByLabelText('Name')[0]!
  await user.type(name, 'M. Example')
  expect(document.activeElement).toBe(name)
  expect((name as HTMLInputElement).value).toBe('M. Example')
  const firstNumber = within(team).getAllByLabelText('No.')[0] as HTMLInputElement
  expect(firstNumber.required).toBe(true)
  expect(firstNumber.getAttribute('aria-invalid')).toBe('true')
  fireEvent.change(firstNumber, { target: { value: '1' } })
  expect(within(team).getAllByLabelText('No.')).toHaveLength(7)
  for (let index = 1; index < 6; index++) {
    fireEvent.change(within(team).getAllByLabelText('No.')[index]!, { target: { value: String(index + 1) } })
  }
  expect(within(team).getAllByLabelText('No.')).toHaveLength(7)
  await user.type(within(team).getAllByLabelText('Licence')[6]!, '123')
  expect(within(team).getAllByLabelText('No.')).toHaveLength(7)
  fireEvent.change(within(team).getAllByLabelText('No.')[6]!, { target: { value: '7' } })
  expect(within(team).getAllByLabelText('No.')).toHaveLength(8)
  await user.clear(within(team).getAllByLabelText('No.')[0]!)
  expect(within(team).getAllByLabelText('No.')).toHaveLength(7)
  expect((within(team).getAllByLabelText('Name')[6] as HTMLInputElement).value).toBe('M. Example')
  await user.clear(within(team).getAllByLabelText('Name')[6]!)
  expect(within(team).getAllByLabelText('No.')).toHaveLength(7)
  expect((within(team).getAllByLabelText('No.')[0] as HTMLInputElement).value).toBe('2')
  expect((within(team).getAllByLabelText('Licence')[5] as HTMLInputElement).value).toBe('123')
  expect((within(team).getAllByLabelText('Licence')[6] as HTMLInputElement).value).toBe('')
  expect(JSON.parse(screen.getByTestId('saved-roster').textContent ?? '').length).toBe(6)
})

it('does not count blank saved rows against roster limits or include them in selection and copying', () => {
  const sheet = createScoresheet()
  sheet.rules.maxPlayers = 1
  sheet.teams.A.players = Array.from({ length: 8 }, emptyPlayer)
  sheet.teams.A.players[5]!.number = 12
  sheet.teams.A.players[0]!.name = 'Missing number'
  render(<Harness initial={sheet} />)
  expect(screen.queryByText(/players listed; the rules allow/)).toBeNull()
  cleanup()
  render(<PlayStep sheet={sheet} update={() => {}} activeSetIndex={0} onActiveSetChange={() => {}} />)
  const select = screen.getAllByLabelText('Position I')[0] as HTMLSelectElement
  expect([...select.options].map((option) => option.textContent)).toEqual(['--', '12'])
  cleanup()
  render(<RosterSection sheet={sheet} side="A" />)
  expect(screen.getAllByRole('row')).toHaveLength(2)
})
