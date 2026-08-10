import type { Scoresheet } from '../scoresheet/model'

/** Mutate a draft copy; the caller re-renders with the result. */
export type SheetUpdater = (mutate: (draft: Scoresheet) => void) => void
