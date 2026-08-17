import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { FederationProvider } from '../federation/types'
import type { Scoresheet } from '../scoresheet/model'
import { sheetSections, type SheetSection } from '../scoresheet/sections'
import { Banner, Card } from './components'
import { SectionBody } from './SheetSections'
import type { SheetUpdater } from './updater'

/**
 * Walks the scorer through the paper sheet one box at a time. The order is the
 * order the sheet is filled in, and each box carries the instruction for what
 * actually goes on the paper, so the wizard replaces the printed guide rather
 * than just displaying data.
 */
export function TransferWizard({
  sheet,
  update,
  provider,
}: {
  sheet: Scoresheet
  update: SheetUpdater
  provider: FederationProvider
}) {
  const { t } = useTranslation()
  const sections = useMemo(() => sheetSections(sheet), [sheet])
  const [index, setIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  const position = Math.min(index, sections.length - 1)
  const section = sections[position] as SheetSection
  const done = sheet.copiedSections
  const isDone = done.includes(section.id)
  const doneCount = sections.filter((candidate) => done.includes(candidate.id)).length
  const isLast = position === sections.length - 1

  const goTo = (next: number) => {
    setIndex(Math.max(0, Math.min(next, sections.length - 1)))
    setCopied(false)
  }

  const setDone = (sectionId: string, value: boolean) =>
    update((draft) => {
      const marked = new Set(draft.copiedSections)
      if (value) marked.add(sectionId)
      else marked.delete(sectionId)
      draft.copiedSections = [...marked]
    })

  // The rendered box is the single source of truth for its text, so the clipboard
  // copy reads it back rather than maintaining a parallel plain-text renderer.
  const copySection = () => {
    const text = bodyRef.current?.innerText?.trim()
    if (!text) return
    void navigator.clipboard?.writeText(text)
    setCopied(true)
  }

  return (
    <>
      <Card title={t('transfer.title')} subtitle={t('transfer.subtitle')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="muted">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {t('transfer.step', { current: position + 1, total: sections.length })}
            </span>
            <span className="mx-2 text-slate-300 dark:text-slate-600">/</span>
            {t('transfer.progress', { done: doneCount, total: sections.length })}
          </p>
          {doneCount > 0 && (
            <button type="button" className="ghost no-print" onClick={() => {
              update((draft) => void (draft.copiedSections = []))
              goTo(0)
            }}>
              {t('transfer.restart')}
            </button>
          )}
        </div>

        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
          role="progressbar"
          aria-valuenow={doneCount}
          aria-valuemin={0}
          aria-valuemax={sections.length}
        >
          <div
            className="h-full rounded-full bg-indigo-600 transition-[width] duration-300 dark:bg-indigo-500"
            style={{ width: `${(doneCount / sections.length) * 100}%` }}
          />
        </div>

        <h3>{t('transfer.overview')}</h3>
        <ol className="no-print flex flex-wrap gap-2">
          {sections.map((candidate, candidateIndex) => {
            const complete = done.includes(candidate.id)
            const active = candidateIndex === position
            return (
              <li key={candidate.id}>
                <button
                  type="button"
                  className={`tab text-xs ${active ? 'tab-active' : ''}`}
                  aria-current={active ? 'step' : undefined}
                  onClick={() => goTo(candidateIndex)}
                >
                  <span aria-hidden className={complete ? 'text-emerald-500' : 'text-slate-400'}>
                    {complete ? '✓' : candidateIndex + 1}
                  </span>
                  {t(candidate.title.key, candidate.title.params)}
                </button>
              </li>
            )
          })}
        </ol>

        {doneCount === sections.length && <Banner kind="ok">{t('transfer.allDone')}</Banner>}
      </Card>

      <div className="printable">
        <Card
          title={t(section.title.key, section.title.params)}
          actions={
            <>
              <button type="button" onClick={copySection}>
                {copied ? t('common.copied') : t('transfer.copySection')}
              </button>
              <button type="button" onClick={() => window.print()}>
                {t('transfer.printSection')}
              </button>
            </>
          }
        >
          <div className="mb-4 rounded-xl border-l-4 border-indigo-500 bg-indigo-50/70 px-4 py-3 dark:bg-indigo-950/40">
            <p className="field-label mb-1">{t('transfer.whatToWrite')}</p>
            <p className="text-sm">{t(section.help.key, section.help.params)}</p>
          </div>

          <div ref={bodyRef}>
            <SectionBody sheet={sheet} section={section} provider={provider} />
          </div>

          <div className="button-row no-print mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button type="button" disabled={position === 0} onClick={() => goTo(position - 1)}>
              {t('common.back')}
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                setDone(section.id, true)
                if (!isLast) goTo(position + 1)
              }}
            >
              {isLast ? t('transfer.finish') : t('transfer.doneAndNext')}
            </button>
            {isDone && (
              <button type="button" className="ghost" onClick={() => setDone(section.id, false)}>
                {t('transfer.markNotDone')}
              </button>
            )}
            <button type="button" disabled={isLast} onClick={() => goTo(position + 1)}>
              {t('common.next')}
            </button>
          </div>
        </Card>
      </div>
    </>
  )
}
