import { describe, expect, it } from 'vitest'

import type { GameDetail, GameSummary, Roster } from '../federation/types'
import { applyRoster, createScoresheet, scoresheetFromGame } from './factory'

const FIXTURE: GameSummary = {
  id: '104884',
  playDate: '2026-09-06 16:00:00',
  home: { id: '1701', name: 'VBC Buochs 1' },
  away: { id: '3844', name: 'Volleya Obwalden 3' },
  gender: 'f',
  venue: { id: '34', name: 'Breitli', street: 'Schulstrasse 15', postalCode: '6374', city: 'Buochs' },
}

describe('prefill from a fixture', () => {
  it('uses imported birthdays as licences without replacing another coach\'s identity', () => {
    const roster: Roster = {
      team: { id: '1', name: 'Club' },
      players: [{ firstName: 'Player', lastName: 'Name', number: 1, birthDate: '1990-06-15T00:00:00' }],
      staff: [{ firstName: 'Coach', lastName: 'Name', role: 'Trainer', birthDate: '1980-03-12T00:00:00' }],
    }
    const imported = applyRoster(createScoresheet(), 'A', roster)
    expect(imported.teams.A.players[0]!.licence).toBe('1990-06-15')
    expect(imported.teams.A.players[0]!.name).toBe('Name Player')
    expect(imported.teams.A.staff.licences?.coach).toBe('1980-03-12')
    const existing = createScoresheet()
    existing.teams.A.staff.coach = 'Another Coach'
    const preserved = applyRoster(existing, 'A', roster)
    expect(preserved.teams.A.staff.coach).toBe('Another Coach')
    expect(preserved.teams.A.staff.licences?.coach).toBe('')
  })

  it('takes hall and town from the fixture, with no detail call', () => {
    const header = scoresheetFromGame(FIXTURE, 'swiss-volley').header

    expect(header.hall).toBe('Breitli')
    expect(header.city).toBe('Buochs')
  })

  it('imports officials in paper name order with available country and licence data', () => {
    const game: GameDetail = {
      ...FIXTURE,
      officials: [
        { firstName: 'Robin', lastName: 'Meier', role: '1st referee', country: 'CH', licence: 'R-1' },
        { firstName: 'Rita', lastName: 'Müller', role: '2nd referee', birthDate: '1980-03-12' },
        { firstName: 'Alex', lastName: 'Keller', role: 'Scorer' },
        { firstName: 'Sam', lastName: 'Frei', role: 'Assistant scorer' },
        { firstName: 'Eve', lastName: 'Baum', role: 'Line judge' },
      ],
    }

    const officials = scoresheetFromGame(game, 'manual').officials
    expect(officials.firstReferee).toEqual({ name: 'Meier Robin', country: 'CH', licence: 'R-1' })
    expect(officials.secondReferee).toEqual({ name: 'Müller Rita', country: '', licence: '1980-03-12' })
    expect(officials.scorer.name).toBe('Keller Alex')
    expect(officials.assistantScorer.name).toBe('Frei Sam')
    expect(officials.lineJudges).toEqual(['Baum Eve', '', '', ''])
  })
})
