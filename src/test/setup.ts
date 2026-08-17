export {}

/**
 * Node exposes an experimental global `localStorage` that is unavailable unless the
 * process was started with --localstorage-file, and it shadows the jsdom one. Tests
 * get a plain in-memory Storage instead.
 */
class MemoryStorage implements Storage {
  private entries = new Map<string, string>()

  get length(): number {
    return this.entries.size
  }

  clear(): void {
    this.entries.clear()
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.entries.delete(key)
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, String(value))
  }
}

function install(): void {
  const storage = new MemoryStorage()
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true, writable: true })
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true })
}

let usable: boolean
try {
  usable = typeof window.localStorage?.setItem === 'function'
} catch {
  usable = false
}
if (!usable) install()

// Assertions read English strings, so pin the language rather than letting the
// detector pick up whatever locale the machine running the tests reports.
const { default: i18n } = await import('../i18n')
await i18n.changeLanguage('en')
