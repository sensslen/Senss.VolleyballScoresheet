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
