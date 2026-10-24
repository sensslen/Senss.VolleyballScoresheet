import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { FederationProvider } from '../federation/types'
import { computeSetState, type SetState } from '../scoresheet/engine'
import { emptySet } from '../scoresheet/factory'
import { findPlayer, otherSide, POSITION_LABELS, TEAM_SIDES, type Scoresheet, type SetRecord, type TeamSide } from '../scoresheet/model'
import { localSetTime, paperScoresheet, serviceEntries } from '../scoresheet/paper'
import { maxSets } from '../scoresheet/rules'
import { Card } from './components'
import { HeaderSection, OfficialsSection, RemarksSection, ResultsSection, RosterSection, SanctionsSection, SubmitSection, TossSection } from './SheetSections'
import { useSheetViewport } from './useSheetViewport'

export function FilledScoresheet({ sheet: source, provider }: { sheet: Scoresheet; provider: FederationProvider }) {
  const { t } = useTranslation()
  const sheet = paperScoresheet(source)
  const [selected, setSelected] = useState('header')
  const { viewport, scale, changeZoom, fitWidth, showSection, pointerHandlers } = useSheetViewport(setSelected)
  const sections = [
    { id: 'header', label: t('match.header.title') },
    { id: 'officials', label: t('match.officials.title') },
    ...Array.from({ length: maxSets(sheet.rules) }, (_, index) => ({ id: `set-${index + 1}`, label: t('play.sets.tab', { number: index + 1 }) })),
    { id: 'sanctions', label: t('section.sanctions.title') },
    { id: 'remarks', label: t('sheet.row.remarks') },
    { id: 'results', label: t('section.results.title') },
    ...TEAM_SIDES.map((side) => ({ id: `roster-${side}`, label: t('section.roster.title', { side }) })),
  ]

  const box = (id: string, label: string, content: ReactNode, className = '') => (
    <section data-box={id} aria-label={label} className={`paper-box ${selected === id ? 'paper-selected' : ''} ${className}`}>
      <h2>{label}</h2>
      {content}
    </section>
  )

  return (
    <>
      <div className="transfer-area no-print">
      <Card title={t('transfer.title')} subtitle={t('transfer.filledHint')}>
        <div className="sheet-tools no-print">
          <label>{t('transfer.viewport')}
            <select value={selected} onChange={(event) => showSection(event.target.value)}>
              {sections.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <label>{t('transfer.zoom')} <output>{Math.round(scale * 100)}%</output>
            <input aria-label={t('transfer.zoom')} type="range" min="10" max="400" step="5" value={Math.round(scale * 100)} onChange={(event) => changeZoom(Number(event.target.value) / 100)} />
          </label>
          <button type="button" aria-label={t('transfer.zoomOut')} onClick={() => changeZoom(scale / 1.2)}>-</button>
          <button type="button" aria-label={t('transfer.zoomIn')} onClick={() => changeZoom(scale * 1.2)}>+</button>
          <button type="button" onClick={fitWidth}>{t('transfer.fit')}</button>
          <button type="button" onClick={() => window.print()}>{t('common.print')}</button>
          <a href="https://www.sv-ri.ch/wissen/fuer-vereine" target="_blank" rel="noreferrer">{t('transfer.reference')}</a>
        </div>
      </Card>
      </div>

      <div ref={viewport} className="transfer-area sheet-viewport printable" role="region" aria-label={t('transfer.filledTitle')} tabIndex={0} {...pointerHandlers} onDragStart={(event) => event.preventDefault()}>
        <article className="paper-sheet" style={{ zoom: scale }}>
          {box('header', t('match.header.title'), <><HeaderSection sheet={source} /><TossSection sheet={sheet} /></>, 'paper-wide')}
          {Array.from({ length: maxSets(sheet.rules) }, (_, index) => {
            const label = t('play.sets.tab', { number: index + 1 })
            const state = computeSetState(sheet, index)
            return <div key={index} className={state.isDeciding ? 'paper-wide' : ''}>
              {box(`set-${index + 1}`, label, <SetBox sheet={sheet} setIndex={index} state={state} />)}
            </div>
          })}
          <div className="paper-footer paper-wide">
            <div>
              {box('sanctions', t('section.sanctions.title'), <SanctionsSection sheet={sheet} />)}
              {box('remarks', t('sheet.row.remarks'), <RemarksSection sheet={sheet} />)}
              {box('officials', t('match.officials.title'), <OfficialsSection sheet={sheet} provider={provider} />)}
            </div>
            {box('results', t('section.results.title'), <ResultsSection sheet={sheet} />)}
            <div className="paper-rosters">
              {TEAM_SIDES.map((side) => <div key={side}>
                {box(`roster-${side}`, t('section.roster.title', { side }), <RosterSection sheet={sheet} side={side} provider={provider} />)}
              </div>)}
            </div>
          </div>
        </article>
      </div>
      <div className="transfer-area no-print mt-4"><Card title={t('section.submit.title')}><SubmitSection sheet={sheet} provider={provider} /></Card></div>
    </>
  )
}

function SetBox({ sheet, setIndex, state }: { sheet: Scoresheet; setIndex: number; state: SetState }) {
  const { t } = useTranslation()
  const record = sheet.sets[setIndex] ?? emptySet(setIndex + 1)
  const left = state.isDeciding ? record.leftSide : setIndex % 2 === 0 ? sheet.toss.leftSide : sheet.toss.leftSide && otherSide(sheet.toss.leftSide)
  const sides = left ? [left, otherSide(left)] : TEAM_SIDES
  const switchIndex = state.progression.findIndex((score) => Math.max(score.A, score.B) >= 8)
  const through = switchIndex < 0 ? state.progression.length : switchIndex + 1
  return <>
    <div className="paper-set-times">
      <span>{t('sheet.col.start')} <b>{localSetTime(record.startTime) || '--'}</b></span>
      <span>{t('sheet.col.end')} <b>{localSetTime(record.endTime) || '--'}</b></span>
      <span>{t('sheet.col.duration')} <b>{record.durationMinutes ?? '--'}</b></span>
    </div>
    <div className={state.isDeciding ? 'paper-teams paper-deciding' : 'paper-teams'}>
      {sides.map((side, index) => <TeamSetBox key={side} sheet={sheet} record={record} state={state} side={side} through={state.isDeciding && index === 0 ? through : undefined} />)}
      {state.isDeciding && <TeamSetBox sheet={sheet} record={record} state={state} side={sides[0]!} />}
    </div>
    {state.isDeciding && <p className="paper-switch">{t('transfer.sideSwitch')} <b>{switchIndex >= 0 ? `${state.progression[switchIndex]![sides[0]!]}:${state.progression[switchIndex]![sides[1]!]}` : '--'}</b></p>}
  </>
}

function TeamSetBox({ sheet, record, state, side, through = state.progression.length }: {
  sheet: Scoresheet; record: SetRecord; state: SetState; side: TeamSide; through?: number
}) {
  const { t } = useTranslation()
  const team = sheet.teams[side]
  const entries = serviceEntries(state, side, through)
  const score = state.progression[through - 1]?.[side] ?? 0
  const finished = state.isComplete && through === state.progression.length
  const rows = Math.max(4, ...entries.map((entry) => entry.row + 1))
  const subs = record.substitutions[side].filter((entry) => entry.atRally < through)
  const timeoutScores = record.timeouts.filter((entry) => entry.team === side && entry.atRally < through)
  const ownScore = (entry: { scoreA: number; scoreB: number }) => side === 'A' ? `${entry.scoreA}:${entry.scoreB}` : `${entry.scoreB}:${entry.scoreA}`
  const number = (id: string | null) => findPlayer(team, id)?.number ?? '--'
  return <section className="paper-team" aria-label={`${t('common.set')} ${record.number}, ${t('common.teamSide', { side })}, ${through} ${t('sheet.rallyByRally')}`}>
    <h3><span>{side} · {team.name || t('common.unnamed')}</span><b>{record.firstServe ? record.firstServe === side ? 'S' : 'R' : '--'}</b></h3>
    <div className="paper-team-body">
      <table className="paper-rotation">
        <thead><tr><th>{t('common.position')}</th>{POSITION_LABELS.map((label) => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>
          <tr><th>{t('sheet.col.playerNumber')}</th>{record.lineups[side].slots.map((id, slot) => <td key={slot}>{number(id)}</td>)}</tr>
          <tr><th>{t('play.subs.title')}</th>{POSITION_LABELS.map((_, slot) => {
            const starter = record.lineups[side].slots[slot]
            const changes = subs.filter((entry) => entry.slot === slot)
            return <td key={slot}>{changes.filter((entry) => entry.inPlayerId !== starter).map((entry, index) => {
              const returned = changes.some((change) => change.outPlayerId === entry.inPlayerId && change.inPlayerId === starter)
              const label = returned ? t('play.subs.returned', { number: number(entry.inPlayerId) }) : undefined
              return <div key={index}><span className={returned ? 'paper-returned' : undefined} aria-label={label} title={label}>{number(entry.inPlayerId)}</span></div>
            })}</td>
          })}</tr>
          <tr className="paper-sub-scores" aria-label={`${t('play.subs.title')} ${t('common.score')}`}><th>{t('common.score')}</th>{POSITION_LABELS.map((_, slot) => <td key={slot}>{subs.filter((entry) => entry.slot === slot).map((entry, index) => <div key={index}>{ownScore(entry)}</div>)}</td>)}</tr>
          {Array.from({ length: rows }, (_, row) => <tr key={row}>
            <th>{row + 1}</th>
            {POSITION_LABELS.map((_, slot) => {
              const entry = entries.find((candidate) => candidate.row === row && candidate.slot === slot)
              const final = finished && entry === entries.at(-1) && Boolean(entry)
              return <td key={slot}>
                {record.firstServe && record.firstServe !== side && row === 0 && slot === 0 ? 'X' : entry ? <span className={final ? 'paper-final' : ''}>{entry.closed ? entry.score : '✓'}</span> : ''}
              </td>
            })}
          </tr>)}
        </tbody>
      </table>
      <div className="paper-score-column" style={{ width: Math.max(4, Math.ceil(score / 12)) * 14 }}>
        <div className="paper-points" aria-label={t('common.score')}>
          {Array.from({ length: Math.max(48, Math.ceil(score / 12) * 12) }, (_, index) => <span key={index} aria-hidden={index >= score || undefined} className={index < score ? 'paper-point-scored' : 'paper-point-unused'}>{index + 1}</span>)}
        </div>
        <div className="paper-timeouts" aria-label={t('sheet.timeouts')}>
          <strong title={t('sheet.timeouts')}>T</strong>
          {Array.from({ length: Math.max(sheet.rules.timeoutsPerSet, timeoutScores.length) }, (_, index) => <div key={index}>{timeoutScores[index] ? ownScore(timeoutScores[index]) : '--'}</div>)}
        </div>
      </div>
    </div>
  </section>
}
