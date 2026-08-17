import { describe, expect, it } from 'vitest'

import { resources, SUPPORTED_LANGUAGES } from './i18n'

type Tree = { [key: string]: string | Tree }

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const flat = new Map<string, string>()
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') flat.set(path, value)
    else for (const [nested, text] of flatten(value, path)) flat.set(nested, text)
  }
  return flat
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1] as string).sort()
}

const english = flatten(resources.en.translation as Tree)
const others = SUPPORTED_LANGUAGES.filter((language) => language.code !== 'en')

describe('catalogues', () => {
  it.each(others)('$code covers every English key', ({ code }) => {
    const catalogue = flatten(resources[code].translation as Tree)

    expect([...english.keys()].filter((key) => !catalogue.has(key))).toEqual([])
    expect([...catalogue.keys()].filter((key) => !english.has(key))).toEqual([])
  })

  it.each(others)('$code interpolates the same placeholders as English', ({ code }) => {
    const catalogue = flatten(resources[code].translation as Tree)
    const mismatched = [...english].filter(([key, text]) => {
      const translation = catalogue.get(key)
      return translation !== undefined && placeholders(translation).join() !== placeholders(text).join()
    })

    expect(mismatched.map(([key]) => key)).toEqual([])
  })
})
