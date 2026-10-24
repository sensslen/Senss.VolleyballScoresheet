import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { createSwissVolleyProvider } from '../federation/swiss/provider'
import { createScoresheet } from '../scoresheet/factory'
import { MatchStep } from './MatchStep'

function Harness() {
  const [sheet, setSheet] = useState(createScoresheet())
  return <>
    <MatchStep sheet={sheet} provider={createSwissVolleyProvider()} update={(mutate) => setSheet((current) => {
      const next = structuredClone(current)
      mutate(next)
      return next
    })} />
    <output data-testid="header">{JSON.stringify(sheet.header)}</output>
    <output data-testid="officials">{JSON.stringify(sheet.officials)}</output>
  </>
}

afterEach(cleanup)

it('edits each header field without changing its label, order or input type', () => {
  render(<Harness />)
  const fields = [
    ['competition', 'Competition', 'Regional league', 'text'],
    ['stage', 'Stage / round', 'Final', 'text'],
    ['pool', 'Pool / group', 'Group A', 'text'],
    ['matchNumber', 'Match number', '123', 'text'],
    ['category', 'Category', 'Women', 'text'],
    ['date', 'Date', '2026-10-24', 'date'],
    ['time', 'Start time', '20:30', 'time'],
    ['hall', 'Hall', 'Sports hall', 'text'],
    ['city', 'City', 'Bern', 'text'],
  ] as const
  const inputs = screen.getByRole('region', { name: 'Match header' }).querySelectorAll('input')
  for (const [index, [key, label, value, type]] of fields.entries()) {
    const input = screen.getByLabelText(label) as HTMLInputElement
    expect(inputs[index]).toBe(input)
    expect(input.type).toBe(type)
    fireEvent.change(input, { target: { value } })
    expect(JSON.parse(screen.getByTestId('header').textContent ?? '')[key]).toBe(value)
  }
  expect(screen.getByPlaceholderText('Women / Men / U19')).toBe(screen.getByLabelText('Category'))
})

it('edits four officials with Swiss birth dates and four separate line judges', () => {
  render(<Harness />)
  const name = screen.getByLabelText('1st referee: Name')
  const country = screen.getByLabelText('1st referee: Country / federation')
  const birthDate = screen.getByLabelText('1st referee: Date of birth') as HTMLInputElement
  fireEvent.change(name, { target: { value: 'Meier Robin' } })
  fireEvent.change(country, { target: { value: 'CH' } })
  fireEvent.change(birthDate, { target: { value: '1980-03-12' } })
  fireEvent.change(screen.getByLabelText('Line judges 2: Name'), { target: { value: 'Judge Two' } })

  const officials = JSON.parse(screen.getByTestId('officials').textContent ?? '')
  expect(birthDate.type).toBe('date')
  expect(officials.firstReferee).toEqual({ name: 'Meier Robin', country: 'CH', licence: '1980-03-12' })
  expect(officials.lineJudges).toEqual(['', 'Judge Two', '', ''])
  expect(screen.getAllByRole('row')).toHaveLength(10)
})
