import { describe, expect, it } from 'vitest'

import { computeMatchState, computeSetState, rallyEntryBlocker, validateSubstitution } from './engine'
import { createScoresheet, emptySet } from './factory'
import type { Scoresheet, TeamSide } from './model'
import { ruleSetById } from './rules'

function sheetWithLineups(): Scoresheet {
  const sheet = createScoresheet(ruleSetById('fivb-best-of-5'))
  for (const side of ['A', 'B'] as TeamSide[]) {
    sheet.teams[side].name = `Team ${side}`
    sheet.teams[side].players = Array.from({ length: 8 }, (_, index) => ({
      id: `${side}${index + 1}`,
      number: index + 1,
      firstName: 'First',
      lastName: `${side}${index + 1}`,
      licence: '',
      isCaptain: index === 0,
      isLibero: index === 7,
      position: index === 7 ? 'libero' : '',
    }))
    const set = sheet.sets[0]!
    set.lineups[side].slots = [1, 2, 3, 4, 5, 6].map((number) => `${side}${number}`)
  }
  sheet.sets[0]!.firstServe = 'A'
  return sheet
}

function playRallies(sheet: Scoresheet, setIndex: number, winners: TeamSide[]): void {
  const set = sheet.sets[setIndex]!
  for (const winner of winners) set.rallies.push({ winner })
}

describe('service order', () => {
  it('keeps the same server while the serving team scores', () => {
    const sheet = sheetWithLineups()
    playRallies(sheet, 0, ['A', 'A', 'A'])
    const state = computeSetState(sheet, 0)

    expect(state.score).toEqual({ A: 3, B: 0 })
    expect(state.serviceRounds.A).toHaveLength(1)
    expect(state.serviceRounds.A[0]!.server.number).toBe(1)
    expect(state.serviceRounds.A[0]!.pointsScored).toEqual([1, 2, 3])
    expect(state.servingSide).toBe('A')
  })

  it('rotates the receiving team before its first service', () => {
    const sheet = sheetWithLineups()
    playRallies(sheet, 0, ['B'])
    const state = computeSetState(sheet, 0)

    expect(state.servingSide).toBe('B')
    // B started in position I..VI as B1..B6; on side-out the position II player serves.
    expect(state.nextServer.B?.number).toBe(2)
    expect(state.serviceRounds.B).toHaveLength(1)
    expect(state.serviceRounds.B[0]!.server.number).toBe(2)
    expect(state.serviceRounds.B[0]!.pointsScored).toEqual([])
  })

  it('advances one slot each time a team regains service', () => {
    const sheet = sheetWithLineups()
    // A serves, loses, regains, loses, regains.
    playRallies(sheet, 0, ['B', 'A', 'B', 'A'])
    const state = computeSetState(sheet, 0)

    expect(state.serviceRounds.A.map((round) => round.server.number)).toEqual([1, 2, 3])
    expect(state.serviceRounds.B.map((round) => round.server.number)).toEqual([2, 3])
  })

  it('wraps the service order after six rounds', () => {
    const sheet = sheetWithLineups()
    // Alternating side-outs give each team a new server every two rallies.
    playRallies(sheet, 0, ['B', 'A', 'B', 'A', 'B', 'A', 'B', 'A', 'B', 'A', 'B', 'A'])
    const state = computeSetState(sheet, 0)

    expect(state.serviceRounds.A.map((round) => round.server.number)).toEqual([1, 2, 3, 4, 5, 6, 1])
  })

  it('records the score a service round started at', () => {
    const sheet = sheetWithLineups()
    playRallies(sheet, 0, ['A', 'A', 'B'])
    const state = computeSetState(sheet, 0)

    expect(state.serviceRounds.B[0]!.scoreAtStart).toEqual({ own: 1, opponent: 2 })
  })
})

describe('set completion', () => {
  it('needs a two point lead past 25', () => {
    const sheet = sheetWithLineups()
    const winners: TeamSide[] = []
    for (let i = 0; i < 24; i += 1) winners.push('A', 'B')
    winners.push('A') // 25-24
    playRallies(sheet, 0, winners)

    const state = computeSetState(sheet, 0)
    expect(state.score).toEqual({ A: 25, B: 24 })
    expect(state.isComplete).toBe(false)
  })

  it('ends at 26-24', () => {
    const sheet = sheetWithLineups()
    const winners: TeamSide[] = []
    for (let i = 0; i < 24; i += 1) winners.push('A', 'B')
    winners.push('A', 'A')
    playRallies(sheet, 0, winners)

    const state = computeSetState(sheet, 0)
    expect(state.score).toEqual({ A: 26, B: 24 })
    expect(state.isComplete).toBe(true)
    expect(state.winner).toBe('A')
  })

  it('ignores rallies recorded after the set was decided', () => {
    const sheet = sheetWithLineups()
    playRallies(sheet, 0, [...Array.from<unknown, TeamSide>({ length: 27 }, () => 'A')])
    const state = computeSetState(sheet, 0)

    expect(state.score).toEqual({ A: 25, B: 0 })
    expect(state.isComplete).toBe(true)
  })

  it('plays the fifth set to fifteen', () => {
    const sheet = sheetWithLineups()
    for (let setNumber = 2; setNumber <= 5; setNumber += 1) sheet.sets.push(emptySet(setNumber))
    const fifth = sheet.sets[4]!
    fifth.firstServe = 'A'
    for (const side of ['A', 'B'] as TeamSide[]) {
      fifth.lineups[side].slots = [1, 2, 3, 4, 5, 6].map((number) => `${side}${number}`)
    }
    playRallies(sheet, 4, Array.from<unknown, TeamSide>({ length: 15 }, () => 'B'))

    const state = computeSetState(sheet, 4)
    expect(state.target).toBe(15)
    expect(state.isDeciding).toBe(true)
    expect(state.winner).toBe('B')
  })
})

describe('match state', () => {
  it('stops the match once a team wins three sets', () => {
    const sheet = sheetWithLineups()
    for (let setNumber = 2; setNumber <= 3; setNumber += 1) sheet.sets.push(emptySet(setNumber))
    for (const index of [0, 1, 2]) {
      const set = sheet.sets[index]!
      set.firstServe = 'A'
      for (const side of ['A', 'B'] as TeamSide[]) {
        set.lineups[side].slots = [1, 2, 3, 4, 5, 6].map((number) => `${side}${number}`)
      }
      playRallies(sheet, index, Array.from<unknown, TeamSide>({ length: 25 }, () => 'A'))
    }

    const match = computeMatchState(sheet)
    expect(match.setsWon).toEqual({ A: 3, B: 0 })
    expect(match.isComplete).toBe(true)
    expect(match.winner).toBe('A')
    expect(match.currentSetNumber).toBeNull()
  })

  it('reports the set in progress', () => {
    const sheet = sheetWithLineups()
    playRallies(sheet, 0, ['A', 'B'])
    expect(computeMatchState(sheet).currentSetNumber).toBe(1)
  })
})

describe('entry guards', () => {
  it('blocks rally entry until lineups and first service are known', () => {
    const sheet = createScoresheet()
    expect(rallyEntryBlocker(sheet, 0)).toMatch(/serves first/i)

    const ready = sheetWithLineups()
    expect(rallyEntryBlocker(ready, 0)).toBeNull()
  })
})

describe('substitutions', () => {
  it('substitutes a bench player into a rotation slot', () => {
    const sheet = sheetWithLineups()
    playRallies(sheet, 0, ['A', 'B'])

    expect(validateSubstitution(sheet, 0, 'A', 2, 'A7')).toBeNull()
    sheet.sets[0]!.substitutions.A.push({
      slot: 2,
      outPlayerId: 'A3',
      inPlayerId: 'A7',
      atRally: 1,
      scoreA: 1,
      scoreB: 1,
    })

    const state = computeSetState(sheet, 0)
    expect(state.courtSlots.A[2]).toBe('A7')
    expect(state.substitutionsUsed.A).toBe(1)
  })

  it('lets the starter return only for the player who replaced them', () => {
    const sheet = sheetWithLineups()
    playRallies(sheet, 0, ['A'])
    sheet.sets[0]!.substitutions.A.push({
      slot: 2,
      outPlayerId: 'A3',
      inPlayerId: 'A7',
      atRally: 0,
      scoreA: 1,
      scoreB: 0,
    })

    expect(validateSubstitution(sheet, 0, 'A', 2, 'A3')).toBeNull()
    // A3 did not leave slot 4, so it cannot re-enter there.
    expect(validateSubstitution(sheet, 0, 'A', 4, 'A3')).toMatch(/replaced them/i)
  })

  it('refuses a second entry for the same substitute', () => {
    const sheet = sheetWithLineups()
    playRallies(sheet, 0, ['A'])
    const set = sheet.sets[0]!
    set.substitutions.A.push(
      { slot: 2, outPlayerId: 'A3', inPlayerId: 'A7', atRally: 0, scoreA: 1, scoreB: 0 },
      { slot: 2, outPlayerId: 'A7', inPlayerId: 'A3', atRally: 0, scoreA: 1, scoreB: 0 },
    )

    expect(validateSubstitution(sheet, 0, 'A', 3, 'A7')).toMatch(/only enter once/i)
  })

  it('refuses to exceed the allowed substitution count', () => {
    const sheet = sheetWithLineups()
    playRallies(sheet, 0, ['A'])
    const set = sheet.sets[0]!
    set.substitutions.A = Array.from({ length: 6 }, (_, index) => ({
      slot: index,
      outPlayerId: `A${index + 1}`,
      inPlayerId: `A7`,
      atRally: 0,
      scoreA: 1,
      scoreB: 0,
    }))

    expect(validateSubstitution(sheet, 0, 'A', 5, 'A8')).toMatch(/all 6 substitutions/i)
  })

  it('keeps liberos out of the substitution box', () => {
    const sheet = sheetWithLineups()
    playRallies(sheet, 0, ['A'])
    expect(validateSubstitution(sheet, 0, 'A', 1, 'A8')).toMatch(/libero/i)
  })

  it('serves with the substitute once the slot comes round', () => {
    const sheet = sheetWithLineups()
    playRallies(sheet, 0, ['B', 'A'])
    sheet.sets[0]!.substitutions.A.push({
      slot: 1,
      outPlayerId: 'A2',
      inPlayerId: 'A7',
      atRally: 0,
      scoreA: 0,
      scoreB: 1,
    })

    const state = computeSetState(sheet, 0)
    expect(state.serviceRounds.A[1]!.server.number).toBe(7)
  })
})

describe('issues', () => {
  it('flags a libero left in the service position', () => {
    const sheet = sheetWithLineups()
    sheet.sets[0]!.lineups.A.slots[0] = 'A8'
    const state = computeSetState(sheet, 0)

    expect(state.issues.join(' ')).toMatch(/libero/i)
  })

  it('flags an incomplete lineup', () => {
    const sheet = sheetWithLineups()
    sheet.sets[0]!.lineups.B.slots[5] = null
    const state = computeSetState(sheet, 0)

    expect(state.issues.join(' ')).toMatch(/only 5 of 6/i)
  })
})
