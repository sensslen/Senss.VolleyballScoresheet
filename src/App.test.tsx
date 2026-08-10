import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import App from './App'
import { POSITION_LABELS } from './scoresheet/model'

type User = ReturnType<typeof userEvent.setup>

function cardFor(name: RegExp | string): HTMLElement {
  return screen.getByRole('region', { name }) as HTMLElement
}

async function fillRoster(user: User, side: 'A' | 'B'): Promise<void> {
  const card = cardFor(new RegExp(`^Team ${side} -`))
  await user.type(within(card).getByLabelText('Team name'), `Club ${side}`)

  for (let index = 0; index < 6; index += 1) {
    await user.click(within(card).getByRole('button', { name: 'Add player' }))
  }

  const numbers = within(card)
    .getAllByRole('textbox')
    .filter((input) => input.classList.contains('num'))
  for (const [index, input] of numbers.entries()) {
    await user.type(input, String(index + 1))
  }
}

async function selectLineups(user: User): Promise<void> {
  for (const [slot, label] of POSITION_LABELS.entries()) {
    // One select per team, in A then B order.
    const selects = screen.getAllByLabelText(`Position ${label}`) as HTMLSelectElement[]
    for (const select of selects) {
      const option = select.options[slot + 1]
      if (option) await user.selectOptions(select, option.value)
    }
  }
}

function scoreValues(): string[] {
  return Array.from(document.querySelectorAll('.score-value')).map((node) => node.textContent ?? '')
}

describe('app walkthrough', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(cleanup)

  it('opens on the fixture step and says what a token would add', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /volleyball scoresheet assistant/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Blank sheet' })).toBeTruthy()
    expect(screen.getByText(/needs volley manager api token/i)).toBeTruthy()
  })

  it('falls back to manual entry when the federation is switched off', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.selectOptions(screen.getByLabelText('Country / federation'), 'manual')
    await user.click(screen.getByRole('button', { name: '1. Match' }))

    expect(screen.getByText(/does not offer fixture browsing/i)).toBeTruthy()
  })

  it('walks a blank sheet from header to a scored rally', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Blank sheet' }))

    await user.type(screen.getByLabelText('Competition'), 'Regional league')
    await user.click(screen.getByRole('button', { name: '3. Teams' }))
    await fillRoster(user, 'A')
    await fillRoster(user, 'B')

    await user.click(screen.getByRole('button', { name: '4. Score' }))
    expect((screen.getByRole('button', { name: 'Point Team A' }) as HTMLButtonElement).disabled).toBe(true)

    await user.selectOptions(screen.getByLabelText('Serves first in set 1'), 'A')
    await selectLineups(user)

    const pointA = screen.getByRole('button', { name: 'Point Team A' }) as HTMLButtonElement
    expect(pointA.disabled).toBe(false)

    await user.click(pointA)
    expect(scoreValues()).toEqual(['1', '0'])

    await user.click(screen.getByRole('button', { name: 'Point Team B' }))
    expect(scoreValues()).toEqual(['1', '1'])

    await user.click(screen.getByRole('button', { name: 'Undo last rally' }))
    expect(scoreValues()).toEqual(['1', '0'])
  })

  it('names the next server so the scorer can write it down', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Blank sheet' }))
    await user.click(screen.getByRole('button', { name: '3. Teams' }))
    await fillRoster(user, 'A')
    await fillRoster(user, 'B')
    await user.click(screen.getByRole('button', { name: '4. Score' }))
    await user.selectOptions(screen.getByLabelText('Serves first in set 1'), 'A')
    await selectLineups(user)

    expect(screen.getByText(/next server no\. 1/i)).toBeTruthy()

    // A side-out makes B serve, and B rotates before its first service.
    await user.click(screen.getByRole('button', { name: 'Point Team B' }))
    expect(screen.getByText(/next server no\. 2/i)).toBeTruthy()
  })

  it('shows a chosen sheet section for copying', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Blank sheet' }))

    await user.type(screen.getByLabelText('Match number'), 'M-42')
    await user.click(screen.getByRole('button', { name: '5. Copy' }))
    expect(screen.getByText('M-42')).toBeTruthy()

    await user.selectOptions(screen.getByLabelText('Section'), 'results')
    expect(screen.getByRole('heading', { name: 'Results table' })).toBeTruthy()
  })

  it('keeps a sheet in the saved list', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Blank sheet' }))
    await user.type(screen.getByLabelText('Competition'), 'Cup')
    await user.click(screen.getByRole('button', { name: '1. Match' }))

    const saved = cardFor('Saved sheets')
    expect(within(saved).getByRole('button', { name: 'Open' })).toBeTruthy()
  })
})
