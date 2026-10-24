import { describe, expect, it } from 'vitest'
import { computeSetState } from './engine'
import { createScoresheet } from './factory'
import { paperScoresheet, serviceEntries } from './paper'

describe('paper team assignment', () => {
  it('keeps home first before the toss', () => {
    const sheet = createScoresheet()
    expect(paperScoresheet(sheet)).toBe(sheet)
  })

  it('remaps every team-dependent entry without changing the saved match', () => {
    const sheet = createScoresheet()
    sheet.teams.A.name = 'Home'
    sheet.teams.B.name = 'Guest'
    sheet.toss = { firstServe: 'A', leftSide: 'B' }
    const set = sheet.sets[0]!
    set.firstServe = 'B'
    set.leftSide = 'A'
    set.lineups.A.slots[0] = 'home-player'
    set.rallies.push({ winner: 'A' })
    set.timeouts.push({ team: 'B', atRally: 0, scoreA: 1, scoreB: 0 })
    set.substitutions.A.push({ slot: 0, outPlayerId: 'out', inPlayerId: 'in', atRally: 0, scoreA: 1, scoreB: 0 })
    sheet.sanctions.push({ kind: 'warning', team: 'A', member: '3', set: 1, scoreA: 1, scoreB: 0, remark: '' })
    const original = structuredClone(sheet)
    const paper = paperScoresheet(sheet)
    expect(paper.teams.A.name).toBe('Guest')
    expect(paper.teams.B.name).toBe('Home')
    expect(paper.toss).toEqual({ firstServe: 'B', leftSide: 'A' })
    expect(paper.sets[0]!.firstServe).toBe('A')
    expect(paper.sets[0]!.leftSide).toBe('B')
    expect(paper.sets[0]!.lineups.B.slots[0]).toBe('home-player')
    expect(paper.sets[0]!.rallies).toEqual([{ winner: 'B' }])
    expect(paper.sets[0]!.timeouts[0]).toMatchObject({ team: 'A', scoreA: 0, scoreB: 1 })
    expect(paper.sets[0]!.substitutions.B[0]).toMatchObject({ scoreA: 0, scoreB: 1 })
    expect(paper.sanctions[0]).toMatchObject({ team: 'B', scoreA: 0, scoreB: 1 })
    expect(sheet).toEqual(original)
  })
})

describe('paper service entries', () => {
  it('records the winning side-out point in the would-be server\'s next box', () => {
    const sheet = createScoresheet()
    sheet.sets[0]!.firstServe = 'A'
    sheet.sets[0]!.rallies = [
      ...Array.from({ length: 24 }, () => ({ winner: 'A' as const })),
      ...Array.from({ length: 23 }, () => ({ winner: 'B' as const })),
      { winner: 'A' },
    ]
    const state = computeSetState(sheet, 0)
    expect(serviceEntries(state, 'A').at(-1)).toEqual({ slot: 1, row: 0, score: 25, closed: true })
    expect(serviceEntries(state, 'B').at(-1)?.score).toBe(23)
  })

  it('retains the losing team\'s final service turn when it scored no points on service', () => {
    const sheet = createScoresheet()
    sheet.sets[0]!.firstServe = 'A'
    sheet.sets[0]!.rallies = [
      ...Array.from({ length: 44 }, (_, index) => ({ winner: index % 2 ? 'B' as const : 'A' as const })),
      ...Array.from({ length: 3 }, () => ({ winner: 'A' as const })),
    ]
    const state = computeSetState(sheet, 0)
    expect(serviceEntries(state, 'B').at(-1)?.score).toBe(22)
  })

  it('writes the cumulative score at loss of service, including rounds with no service points', () => {
    const sheet = createScoresheet()
    sheet.sets[0]!.firstServe = 'A'
    sheet.sets[0]!.rallies = ['A', 'A', 'B', 'B', 'A', 'B'].map((winner) => ({ winner: winner as 'A' | 'B' }))
    const state = computeSetState(sheet, 0)
    expect(serviceEntries(state, 'A')).toEqual([
      { slot: 0, row: 0, score: 2, closed: true },
      { slot: 1, row: 0, score: 3, closed: true },
    ])
    expect(serviceEntries(state, 'B')).toEqual([
      { slot: 1, row: 0, score: 2, closed: true },
    ])
  })

  it('keeps the service order and score across the deciding-set side change', () => {
    const sheet = createScoresheet()
    sheet.sets[0]!.firstServe = 'A'
    sheet.sets[0]!.rallies = Array.from({ length: 15 }, () => ({ winner: 'A' }))
    sheet.rules.pointsPerSet = 15
    const state = computeSetState(sheet, 0)
    expect(serviceEntries(state, 'A', 8)).toEqual([{ slot: 0, row: 0, score: 8, closed: false }])
    expect(serviceEntries(state, 'A')).toEqual([{ slot: 0, row: 0, score: 15, closed: true }])
  })
})
