import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import App from './App'
import { POSITION_LABELS } from './scoresheet/model'

type User = ReturnType<typeof userEvent.setup>

function cardFor(name: RegExp | string): HTMLElement {
  return screen.getByRole('region', { name }) as HTMLElement
}

function step(name: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`${name}$`) })
}

async function fillRoster(user: User, side: 'A' | 'B'): Promise<void> {
  const card = cardFor(new RegExp(`^Team ${side} -`))
  await user.type(within(card).getByLabelText('Team name'), `Club ${side}`)

  for (let index = 0; index < 6; index += 1) {
    await user.click(within(card).getByRole('button', { name: 'Add player' }))
  }

  const numbers = within(card).getAllByLabelText('No.') as HTMLInputElement[]
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

  it('sends you to settings from where the missing token is noticed', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(within(cardFor('Browse fixtures')).getByRole('button', { name: 'Open settings' }))

    expect(within(cardFor('Federation')).getByLabelText('Country / federation')).toBeTruthy()
  })

  it('falls back to manual entry when the federation is switched off', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.selectOptions(screen.getByLabelText('Country / federation'), 'manual')
    await user.click(step('Match'))

    expect(screen.getByText(/does not offer fixture browsing/i)).toBeTruthy()
  })

  it('walks a blank sheet from header to a scored rally', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Blank sheet' }))

    await user.type(screen.getByLabelText('Competition'), 'Regional league')
    await user.click(step('Teams'))
    await fillRoster(user, 'A')
    await fillRoster(user, 'B')

    await user.click(step('Score'))
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
    await user.click(step('Teams'))
    await fillRoster(user, 'A')
    await fillRoster(user, 'B')
    await user.click(step('Score'))
    await user.selectOptions(screen.getByLabelText('Serves first in set 1'), 'A')
    await selectLineups(user)

    expect(screen.getByText(/next server no\. 1/i)).toBeTruthy()

    // A side-out makes B serve, and B rotates before its first service.
    await user.click(screen.getByRole('button', { name: 'Point Team B' }))
    expect(screen.getByText(/next server no\. 2/i)).toBeTruthy()
  })

  it('keeps a sheet in the saved list', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Blank sheet' }))
    await user.type(screen.getByLabelText('Competition'), 'Cup')
    await user.click(step('Match'))

    const saved = cardFor('Saved sheets')
    expect(within(saved).getByRole('button', { name: 'Open' })).toBeTruthy()
  })

  it('translates the whole app when the language changes', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.selectOptions(within(cardFor('Language')).getByLabelText('Language'), 'de')

    expect(screen.getByRole('heading', { name: /matchblatt-assistent/i })).toBeTruthy()

    await user.selectOptions(within(cardFor('Sprache')).getByLabelText('Sprache'), 'en')
  })

  it('keeps following the browser once that is chosen', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    const picker = () => within(cardFor('Language')).getByLabelText('Language') as HTMLSelectElement

    await user.selectOptions(picker(), 'de')
    expect(window.localStorage.getItem('vbs.language.v1')).toBe('de')

    await user.selectOptions(within(cardFor('Sprache')).getByLabelText('Sprache'), '')

    expect(picker().value).toBe('')
    expect(screen.getByText(/following your browser/i)).toBeTruthy()
    expect(window.localStorage.getItem('vbs.language.v1')).toBeNull()
  })
})

describe('transfer wizard', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(cleanup)

  it('opens on the first box and states what to write', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Blank sheet' }))
    await user.type(screen.getByLabelText('Match number'), 'M-42')
    await user.click(step('Transfer'))

    expect(screen.getByText(/step 1 of/i)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Header and officials' })).toBeTruthy()
    expect(screen.getByText(/top band of the sheet/i)).toBeTruthy()
    expect(screen.getByText('M-42')).toBeTruthy()
  })

  it('advances a box at a time and records what has been copied', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Blank sheet' }))
    await user.click(step('Transfer'))

    expect(screen.getByText(/0 of \d+ boxes marked done/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Copied, next box' }))

    expect(screen.getByText(/step 2 of/i)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Toss and sides' })).toBeTruthy()
    expect(screen.getByText(/1 of \d+ boxes marked done/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('heading', { name: 'Header and officials' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mark not copied' })).toBeTruthy()
  })

  it('ends on reporting the result, which no federation API accepts', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Blank sheet' }))
    await user.click(step('Transfer'))

    const overview = screen.getAllByRole('button', { name: /Report the result$/ })
    await user.click(overview[0] as HTMLElement)

    expect(screen.getByText(/no direct submission/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy the summary' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Finish' })).toBeTruthy()
  })
})
