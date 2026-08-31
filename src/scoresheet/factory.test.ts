import { describe, expect, it } from 'vitest'

import type { GameSummary } from '../federation/types'
import { scoresheetFromGame } from './factory'

const FIXTURE: GameSummary = {
  id: '104884',
  playDate: '2026-09-06 16:00:00',
  home: { id: '1701', name: 'VBC Buochs 1' },
  away: { id: '3844', name: 'Volleya Obwalden 3' },
  gender: 'f',
  venue: { id: '34', name: 'Breitli', street: 'Schulstrasse 15', postalCode: '6374', city: 'Buochs' },
}

describe('prefill from a fixture', () => {
  it('takes hall and town from the fixture, with no detail call', () => {
    const header = scoresheetFromGame(FIXTURE, 'swiss-volley').header

    expect(header.hall).toBe('Breitli')
    expect(header.city).toBe('Buochs')
  })
})
