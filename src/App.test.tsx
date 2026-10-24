import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { createScoresheet } from './scoresheet/factory'
import { POSITION_LABELS } from './scoresheet/model'
import { sheetStore } from './scoresheet/storage'

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
  await user.type(within(card).getByLabelText('Coach'), `Coach ${side}`)

  const numbers = within(card).getAllByLabelText('No.') as HTMLInputElement[]
  for (const [index, input] of numbers.slice(0, 6).entries()) {
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

  it('requires six numbered players and a nonblank coach on both teams before scoring', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Blank sheet' }))
    const score = step('Score') as HTMLButtonElement
    expect(score.disabled).toBe(true)
    await user.click(step('Teams'))
    await fillRoster(user, 'A')
    expect(score.disabled).toBe(true)
    await fillRoster(user, 'B')
    expect(score.disabled).toBe(false)

    const team = cardFor(/^Team B -/)
    const coach = within(team).getByLabelText('Coach')
    await user.clear(coach)
    await user.type(coach, '   ')
    expect(score.disabled).toBe(true)
    await user.type(coach, 'Coach B')
    expect(score.disabled).toBe(false)
    await user.clear(within(team).getAllByLabelText('No.')[5]!)
    expect(score.disabled).toBe(true)
  })

  it('opens an incomplete saved sheet on Teams instead of bypassing the disabled Score tab', async () => {
    const user = userEvent.setup()
    sheetStore.save(createScoresheet())
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect((step('Score') as HTMLButtonElement).disabled).toBe(true)
    expect(step('Teams').getAttribute('aria-current')).toBe('page')
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

describe('filled scoresheet', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    })
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows the complete sheet without wizard steps and allows zoom and section selection', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Blank sheet' }))
    await user.type(screen.getByLabelText('Match number'), 'M-42')
    await user.click(step('Transfer'))

    const viewport = screen.getByRole('region', { name: 'Filled scoresheet' })
    expect(within(viewport).getByText('M-42')).toBeTruthy()
    expect(within(viewport).getByRole('heading', { name: 'Set 5' })).toBeTruthy()
    expect(within(viewport).getByRole('heading', { name: 'Results table' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Copied, next box' })).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()

    fireEvent.change(screen.getByRole('slider', { name: /Zoom/ }), { target: { value: '150' } })
    expect((viewport.querySelector('article') as HTMLElement).style.zoom).toBe('1.5')
    Object.defineProperties(viewport, { clientWidth: { value: 1000 }, clientHeight: { value: 600 } })
    const fifth = viewport.querySelector<HTMLElement>('[data-box="set-5"]')!
    vi.spyOn(fifth, 'getBoundingClientRect').mockReturnValue({ ...new DOMRect(), left: 0, top: 0, width: 800, height: 400, right: 800, bottom: 400, x: 0, y: 0, toJSON: () => ({}) })
    await user.selectOptions(screen.getByLabelText('Show section'), 'set-5')
    expect(Number((viewport.querySelector('article') as HTMLElement).style.zoom)).toBeCloseTo(1.815)
    expect(viewport.querySelector('[data-box="set-5"]')?.classList.contains('paper-selected')).toBe(true)
  })

  it('keeps the header in fixture order and assigns paper letters from the selected sides', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Blank sheet' }))
    await user.click(step('Teams'))
    const names = screen.getAllByLabelText('Team name')
    await user.type(names[0]!, 'Home Club')
    await user.type(names[1]!, 'Guest Club')
    for (const side of ['A', 'B']) {
      const team = cardFor(new RegExp(`^Team ${side} -`))
      for (const [index, input] of within(team).getAllByLabelText('No.').slice(0, 6).entries()) {
        fireEvent.change(input, { target: { value: String(index + 1) } })
      }
      fireEvent.change(within(team).getByLabelText('Coach'), { target: { value: `Coach ${side}` } })
    }
    await user.click(step('Transfer'))

    const initialViewport = screen.getByRole('region', { name: 'Filled scoresheet' })
    expect(within(within(initialViewport).getByRole('region', { name: 'Team A roster' })).getByText('Home Club')).toBeTruthy()
    await user.click(step('Score'))
    await user.selectOptions(screen.getByLabelText('Starts on the left side'), 'B')
    await user.click(step('Transfer'))
    expect(screen.queryByLabelText('Team A on paper')).toBeNull()
    const viewport = screen.getByRole('region', { name: 'Filled scoresheet' })
    const header = within(viewport).getByRole('region', { name: 'Match header' })
    const row = within(header).getByText('Home team (B)').closest('.sheet-row')!
    expect(within(row as HTMLElement).getByText('Home Club')).toBeTruthy()
    const roster = within(viewport).getByRole('region', { name: 'Team A roster' })
    expect(within(roster).getByText('Guest Club')).toBeTruthy()
  })

  it('keeps result reporting available below the sheet', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Blank sheet' }))
    await user.click(step('Transfer'))

    expect(screen.getByText(/no direct submission/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy the summary' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Finish' })).toBeNull()
  })
})
