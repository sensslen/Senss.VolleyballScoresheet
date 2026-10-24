import { afterEach, expect, it, vi } from 'vitest'
import { browserStorage, readJson, writeJson } from './browserStorage'
import { credentials } from './federation/credentials'
import { settingsStore } from './scoresheet/storage'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

it('keeps credentials and browsing settings in separate storage entries', () => {
  credentials.set('first', 'first-token')
  credentials.set('second', 'second-token')
  settingsStore.write({ providerId: 'first', competitionId: 'league' })
  credentials.clear('first')

  expect(credentials.get('first')).toBe('')
  expect(credentials.get('second')).toBe('second-token')
  expect(settingsStore.read()).toEqual({ providerId: 'first', competitionId: 'league' })
})

it('returns defaults for missing or malformed JSON without changing stored data', () => {
  expect(settingsStore.read()).toEqual({ providerId: '' })
  expect(credentials.get('missing')).toBe('')
  window.localStorage.setItem('vbs.settings.v1', '{broken')
  window.localStorage.setItem('vbs.credentials.v1', '{broken')

  expect(settingsStore.read()).toEqual({ providerId: '' })
  expect(credentials.get('missing')).toBe('')
  expect(window.localStorage.getItem('vbs.settings.v1')).toBe('{broken')
  expect(window.localStorage.getItem('vbs.credentials.v1')).toBe('{broken')
})

it('round-trips JSON values without replacing valid falsey data with the fallback', () => {
  for (const value of [null, false, 0, '', [], { name: 'Nora' }]) {
    writeJson('test', value)
    expect(readJson('test', 'fallback')).toEqual(value)
  }
})

it('returns the fallback when storage refuses reads', () => {
  writeJson('test', 'stored')
  vi.spyOn(Object.getPrototypeOf(window.localStorage), 'getItem').mockImplementation(() => {
    throw new DOMException('Access denied', 'SecurityError')
  })

  expect(readJson('test', 'fallback')).toBe('fallback')
})

it('does not swallow failed writes', () => {
  vi.spyOn(Object.getPrototypeOf(window.localStorage), 'setItem').mockImplementation(() => {
    throw new DOMException('Storage full', 'QuotaExceededError')
  })

  expect(() => writeJson('test', {})).toThrow('Storage full')
})

it('allows reads and writes when there is no browser', () => {
  vi.stubGlobal('window', undefined)

  expect(browserStorage()).toBeNull()
  expect(readJson('test', 'fallback')).toBe('fallback')
  expect(() => writeJson('test', {})).not.toThrow()
})
