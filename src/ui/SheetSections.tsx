import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { providerName, type FederationProvider } from '../federation/types'
import { computeMatchState, computeSetState } from '../scoresheet/engine'
import {
  isEnteredPlayer,
  MATCH_OFFICIAL_ROLES,
  STAFF_ROLES,
  otherSide,
  TEAM_SIDES,
  type MatchOfficialRole,
  type Scoresheet,
  type SheetPlayer,
  type TeamSide,
} from '../scoresheet/model'
import { maxSets, ruleSetName } from '../scoresheet/rules'
import { localSetTime, paperLicence, paperSide } from '../scoresheet/paper'
import { resultSummary } from '../scoresheet/summary'
import { Banner, EmptyState } from './components'

function Row({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation()
  return (
    <div className="sheet-row">
      <span className="sheet-label">{label}</span>
      <span className="sheet-value mono">{value || t('common.blank')}</span>
    </div>
  )
}

export function HeaderSection({ sheet }: { sheet: Scoresheet }) {
  const { t } = useTranslation()
  const { header } = sheet
  return (
    <>
    <div className="grid-2">
      {TEAM_SIDES.map((side) => <Row key={side}
        label={`${t(side === 'A' ? 'transfer.homeTeam' : 'transfer.guestTeam')}${sheet.toss.leftSide ? ` (${paperSide(sheet, side)})` : ''}`}
        value={sheet.teams[side].name}
      />)}
    </div>
    <div className="grid-2">
      <div>
        <Row label={t('sheet.row.competition')} value={header.competition} />
        <Row label={t('sheet.row.stage')} value={header.stage} />
        <Row label={t('sheet.row.pool')} value={header.pool} />
        <Row label={t('sheet.row.matchNumber')} value={header.matchNumber} />
        <Row label={t('sheet.row.category')} value={header.category} />
        <Row label={t('sheet.row.date')} value={header.date} />
        <Row label={t('sheet.row.time')} value={header.time} />
      </div>
      <div>
        <Row label={t('sheet.row.hall')} value={header.hall} />
        <Row label={t('sheet.row.city')} value={header.city} />
        <Row label={t('sheet.row.rules')} value={ruleSetName(sheet.rules, t)} />
      </div>
    </div>
    </>
  )
}

export function OfficialsSection({ sheet, provider }: { sheet: Scoresheet; provider: FederationProvider }) {
  const { t } = useTranslation()
  const { officials } = sheet
  const labels: Record<MatchOfficialRole, string> = {
    firstReferee: t('match.officials.first'),
    secondReferee: t('match.officials.second'),
    scorer: t('match.officials.scorer'),
    assistantScorer: t('match.officials.assistantScorer'),
  }
  const isDate = provider.licence?.inputType === 'date'
  return <>
    <div className="table-scroll">
      <table className="table">
        <thead><tr><th>{t('common.position')}</th><th>{t('common.name')}</th><th>{t('settings.country')}</th><th>{t(provider.licence?.labelKey ?? 'teams.col.licence')}</th></tr></thead>
        <tbody>{MATCH_OFFICIAL_ROLES.map((role) => (
          <tr key={role}>
            <th scope="row">{labels[role]}</th>
            <td>{officials[role].name || t('common.blank')}</td>
            <td>{officials[role].country || t('common.blank')}</td>
            <td className="mono">{paperLicence(officials[role].licence, isDate) || t('common.blank')}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
    <h3>{t('match.officials.lineJudges')}</h3>
    <div className="table-scroll">
      <table className="table">
        <tbody>{officials.lineJudges.map((name, index) => (
          <tr key={index}><th scope="row">{index + 1}</th><td>{name || t('common.blank')}</td></tr>
        ))}</tbody>
      </table>
    </div>
  </>
}

export function TossSection({ sheet }: { sheet: Scoresheet }) {
  const { t } = useTranslation()
  const first = sheet.toss.firstServe
  const left = sheet.toss.leftSide
  const named = (side: TeamSide) => `${t('common.teamSide', { side })} - ${sheet.teams[side].name}`

  return (
    <div>
      <Row label={t('sheet.row.servesFirst')} value={first ? named(first) : ''} />
      <Row
        label={t('sheet.row.receivesFirst')}
        value={first ? t('common.teamSide', { side: first === 'A' ? 'B' : 'A' }) : ''}
      />
      <Row label={t('sheet.row.leftSide')} value={left ? named(left) : ''} />
      <Row
        label={t('sheet.row.rightSide')}
        value={left ? t('common.teamSide', { side: left === 'A' ? 'B' : 'A' }) : ''}
      />
    </div>
  )
}

export function RosterSection({ sheet, side, provider }: { sheet: Scoresheet; side: TeamSide; provider?: FederationProvider }) {
  const { t } = useTranslation()
  const team = sheet.teams[side]
  const players = team.players.filter(isEnteredPlayer)
    .sort((a, b) => Number(b.isCaptain) - Number(a.isCaptain) || Number(b.isLibero) - Number(a.isLibero) || (a.number ?? 999) - (b.number ?? 999))
  const liberos = players.filter((player) => player.isLibero)
  const staff = STAFF_ROLES.filter((role) => team.staff[role].trim() || team.staff.licences?.[role]?.trim())
  const staffCodes = { coach: 'C', assistantCoach: 'AC1', assistantCoach2: 'AC2', physiotherapist: 'P', doctor: 'M' }
  const isDate = provider?.licence?.inputType === 'date'
  const playerRow = (player: SheetPlayer) => (
    <tr key={player.id}>
      <td className="mono">{paperLicence(player.licence, isDate) || t('common.blank')}</td>
      <td className="mono big"><span className={player.isCaptain ? 'paper-captain' : undefined} aria-label={player.isCaptain ? `${t('sheet.row.captain', { side })}: ${player.number}` : undefined}>{player.number}</span></td>
      <td>{player.name}</td>
    </tr>
  )

  return (
    <>
      {team.name.trim() && <Row label={t('sheet.row.team')} value={team.name} />}
      {players.length === 0 && <EmptyState>{t('transfer.noPlayers', { side })}</EmptyState>}
      {(players.length > 0 || staff.length > 0) && <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{t(provider?.licence?.labelKey ?? 'teams.col.licence')}</th>
              <th>{t('common.number')}</th>
              <th>{t('common.name')}</th>
            </tr>
          </thead>
          <tbody>
            {players.map(playerRow)}
          </tbody>
          {liberos.length > 0 && <tbody aria-label={t('sheet.row.liberos')}>
            <tr><th colSpan={3}>{t('sheet.row.liberos')}</th></tr>
            {liberos.map(playerRow)}
          </tbody>}
          {staff.length > 0 && <tbody aria-label={t('teams.staff')}>
            <tr><th colSpan={3}>{t('teams.staff')}</th></tr>
            {staff.map((role) => <tr key={role}>
              <td className="mono">{paperLicence(team.staff.licences?.[role] ?? '', isDate) || t('common.blank')}</td>
              <th scope="row" title={t(`teams.field.${role}`)}>{staffCodes[role]}</th>
              <td>{team.staff[role] || t('common.blank')}</td>
            </tr>)}
          </tbody>}
        </table>
      </div>}
    </>
  )
}


export function ResultsSection({ sheet }: { sheet: Scoresheet }) {
  const { t } = useTranslation()
  const match = computeMatchState(sheet)
  const completed = sheet.sets.flatMap((record, index) => {
    const state = computeSetState(sheet, index)
    return state.isComplete ? [{ record, state }] : []
  })
  const start = sheet.sets[0]?.startTime ?? ''
  const end = match.isComplete ? sheet.sets.at(-1)?.endTime ?? '' : ''
  const elapsed = start && end ? Math.round((Date.parse(end) - Date.parse(start)) / 60_000) : null
  const duration = elapsed !== null && Number.isFinite(elapsed) && elapsed >= 0
    ? `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`
    : '--'
  const minutes = completed.length && completed.every(({ record }) => record.durationMinutes !== null)
    ? completed.reduce((sum, { record }) => sum + record.durationMinutes!, 0)
    : null
  const total = (side: TeamSide, field: 'score' | 'timeoutsUsed' | 'substitutionsUsed') =>
    completed.reduce((sum, { state }) => sum + state[field][side], 0)

  return <>
    <div className="table-scroll">
      <table className="table paper-results">
        <thead>
          <tr>
            <th colSpan={4}><span className="paper-team-letter">A</span> {sheet.teams.A.name || t('sheet.row.teamA')}</th>
            <th rowSpan={2}>{t('common.set')} ({t('sheet.col.duration')})</th>
            <th colSpan={4}><span className="paper-team-letter">B</span> {sheet.teams.B.name || t('sheet.row.teamB')}</th>
          </tr>
          <tr>
            <th scope="col" aria-label={t('sheet.col.timeoutsA')}>T</th>
            <th scope="col" aria-label={t('sheet.col.subsA')}>S</th>
            <th scope="col" aria-label={`${t('sheet.row.setsWon')} A`}>W</th>
            <th scope="col" aria-label={t('sheet.col.scoreA')}>P</th>
            <th scope="col" aria-label={t('sheet.col.scoreB')}>P</th>
            <th scope="col" aria-label={`${t('sheet.row.setsWon')} B`}>W</th>
            <th scope="col" aria-label={t('sheet.col.subsB')}>S</th>
            <th scope="col" aria-label={t('sheet.col.timeoutsB')}>T</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: maxSets(sheet.rules) }, (_, index) => {
            const result = completed.find(({ record }) => record.number === index + 1)
            const state = result?.state
            return <tr key={index}>
              <td>{state?.timeoutsUsed.A ?? ''}</td>
              <td>{state?.substitutionsUsed.A ?? ''}</td>
              <td>{state ? Number(state.winner === 'A') : ''}</td>
              <td>{state?.score.A ?? ''}</td>
              <th scope="row">{index + 1}.{result ? ` (${result.record.durationMinutes ?? '--'})` : ''}</th>
              <td>{state?.score.B ?? ''}</td>
              <td>{state ? Number(state.winner === 'B') : ''}</td>
              <td>{state?.substitutionsUsed.B ?? ''}</td>
              <td>{state?.timeoutsUsed.B ?? ''}</td>
            </tr>
          })}
          <tr>
            <td>{total('A', 'timeoutsUsed')}</td>
            <td>{total('A', 'substitutionsUsed')}</td>
            <td>{match.setsWon.A}</td>
            <td>{total('A', 'score')}</td>
            <th scope="row">{t('transfer.total')} ({minutes ?? '--'})</th>
            <td>{total('B', 'score')}</td>
            <td>{match.setsWon.B}</td>
            <td>{total('B', 'substitutionsUsed')}</td>
            <td>{total('B', 'timeoutsUsed')}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div className="paper-match-times">
      <div><span>{t('sheet.col.start')}</span><b>{localSetTime(start) || '--'}</b></div>
      <div><span>{t('sheet.col.end')}</span><b>{localSetTime(end) || '--'}</b></div>
      <div><span>{t('sheet.col.duration')}</span><b>{duration}</b></div>
    </div>
    <Row label={t('sheet.row.matchWinner')} value={match.winner
      ? `${sheet.teams[match.winner].name || t('common.teamSide', { side: match.winner })} ${match.setsWon[match.winner]}:${match.setsWon[otherSide(match.winner)]}`
      : t('common.notDecided')} />
  </>
}

export function SanctionsSection({ sheet }: { sheet: Scoresheet }) {
  const { t } = useTranslation()
  if (sheet.sanctions.length === 0) return <EmptyState>{t('transfer.noSanctions')}</EmptyState>

  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th>{t('play.sanctions.kind')}</th>
            <th>{t('common.team')}</th>
            <th>{t('sheet.col.member')}</th>
            <th>{t('common.set')}</th>
            <th>{t('common.score')}</th>
          </tr>
        </thead>
        <tbody>
          {sheet.sanctions.map((sanction, index) => (
            <tr key={index}>
              <td>{t(`sanction.${sanction.kind}`)}</td>
              <td className="mono">{sanction.team}</td>
              <td className="mono">{sanction.member || t('common.blank')}</td>
              <td className="mono">{sanction.set}</td>
              <td className="mono">
                {sanction.team === 'A' ? `${sanction.scoreA}:${sanction.scoreB}` : `${sanction.scoreB}:${sanction.scoreA}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function RemarksSection({ sheet }: { sheet: Scoresheet }) {
  const { t } = useTranslation()
  return <Row label={t('sheet.row.remarks')} value={sheet.remarks} />
}

export function SubmitSection({ sheet, provider }: { sheet: Scoresheet; provider: FederationProvider }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const name = providerName(provider, t)
  const summary = resultSummary(sheet, t)

  const copySummary = () => {
    void navigator.clipboard?.writeText(summary)
    setCopied(true)
  }

  return (
    <>
      <Banner kind="info">
        <div>
          <strong className="block">{t('submit.noApi.title')}</strong>
          {provider.id === 'manual' ? t('submit.manualBody') : t('submit.noApi.body', { name })}
        </div>
      </Banner>

      <h3>{t('submit.summary')}</h3>
      <pre className="mono overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm whitespace-pre-wrap dark:border-slate-800 dark:bg-slate-950/50">
        {summary}
      </pre>
      <div className="button-row no-print">
        <button type="button" className="primary" onClick={copySummary}>
          {copied ? t('common.copied') : t('submit.copySummary')}
        </button>
        {provider.resultPortalUrl && (
          <a
            className="text-sm text-indigo-600 underline underline-offset-2 dark:text-indigo-300"
            href={provider.resultPortalUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            {t('submit.openPortal', { name })}
          </a>
        )}
      </div>

      <h3>{t('submit.checklist')}</h3>
      <ul className="list">
        <li>{t('submit.check.totals')}</li>
        <li>{t('submit.check.durations')}</li>
        <li>{t('submit.check.sanctions')}</li>
      </ul>
    </>
  )
}
