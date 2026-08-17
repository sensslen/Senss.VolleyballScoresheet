import type { LocalizedMessage } from '../localizedMessage'
import { TEAM_SIDES, type Scoresheet, type TeamSide } from './model'

export type SectionKind =
  | 'header'
  | 'toss'
  | 'roster'
  | 'lineup'
  | 'score'
  | 'changes'
  | 'results'
  | 'sanctions'
  | 'remarks'
  | 'submit'

export interface SheetSection {
  /** Stable across renders, so a "copied" mark survives adding another set. */
  id: string
  kind: SectionKind
  title: LocalizedMessage
  /** What the scorer actually writes into this box of the paper sheet. */
  help: LocalizedMessage
  side?: TeamSide
  setIndex?: number
}

function section(kind: SectionKind, id: string, params?: Record<string, string | number>): SheetSection {
  return {
    id,
    kind,
    title: params ? { key: `section.${kind}.title`, params } : { key: `section.${kind}.title` },
    help: { key: `section.${kind}.help` },
  }
}

/**
 * The boxes of the paper sheet in the order a scorer fills them, which is the
 * order the transfer wizard walks. The final step is reporting the result, since
 * handing the sheet over is not the end of the job.
 */
export function sheetSections(sheet: Scoresheet): SheetSection[] {
  const sections: SheetSection[] = [section('header', 'header'), section('toss', 'toss')]

  for (const side of TEAM_SIDES) {
    sections.push({ ...section('roster', `roster-${side}`, { side }), side })
  }

  sheet.sets.forEach((record, index) => {
    const number = record.number
    sections.push({ ...section('lineup', `lineup-${number}`, { number }), setIndex: index })
    sections.push({ ...section('score', `score-${number}`, { number }), setIndex: index })
    sections.push({ ...section('changes', `changes-${number}`, { number }), setIndex: index })
  })

  sections.push(section('results', 'results'))
  sections.push(section('sanctions', 'sanctions'))
  sections.push(section('remarks', 'remarks'))
  sections.push(section('submit', 'submit'))

  return sections
}
