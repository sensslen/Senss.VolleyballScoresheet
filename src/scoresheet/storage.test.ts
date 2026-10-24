import { afterEach, expect, it } from 'vitest'
import { sheetStore } from './storage'

afterEach(() => window.localStorage.clear())

it('refuses unsupported saved sheet formats without changing the stored data', () => {
  const legacy = JSON.stringify([{ id: 'old', version: 1 }])
  window.localStorage.setItem('vbs.sheets.v1', legacy)

  expect(() => sheetStore.all()).toThrow('unsupported format v1')
  expect(window.localStorage.getItem('vbs.sheets.v1')).toBe(legacy)
})

it('refuses malformed saved sheet entries without changing the stored data', () => {
  const malformed = JSON.stringify([null])
  window.localStorage.setItem('vbs.sheets.v1', malformed)

  expect(() => sheetStore.all()).toThrow('unsupported format')
  expect(window.localStorage.getItem('vbs.sheets.v1')).toBe(malformed)
})

it('refuses incomplete current-format sheets without changing the stored data', () => {
  const incomplete = JSON.stringify([{ id: 'broken', version: 2 }])
  window.localStorage.setItem('vbs.sheets.v1', incomplete)

  expect(() => sheetStore.all()).toThrow('incomplete or corrupted')
  expect(window.localStorage.getItem('vbs.sheets.v1')).toBe(incomplete)
})
