/**
 * Always reach localStorage through the window: a bare `localStorage` reference
 * picks up Node's unavailable global under the test runner instead of the DOM one.
 */
export function browserStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    // Private-mode browsers can throw on access rather than return null.
    return null
  }
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = browserStorage()?.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): void {
  browserStorage()?.setItem(key, JSON.stringify(value))
}
