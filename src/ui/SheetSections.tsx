import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { providerName, type FederationProvider } from '../federation/types'
import { computeMatchState, computeSetState, type SetState } from '../scoresheet/engine'
import {
  findPlayer,
  playerLabel,
  POSITION_LABELS,
  TEAM_SIDES,
  type Scoresheet,
  type TeamSide,
} from '../scoresheet/model'
import { ruleSetName } from '../scoresheet/rules'
import type { SheetSection } from '../scoresheet/sections'
import { resultSummary } from '../scoresheet/summary'
import { Banner, EmptyState } from './components'

export function SectionBody({
  sheet,
  section,
  provider,
}: {
  sheet: Scoresheet
  section: SheetSection
  provider: FederationProvider
}) {
  switch (section.kind) {
    case 'header':
      return <HeaderSection sheet={sheet} />
    case 'toss':
      return <TossSection sheet={sheet} />
    case 'roster':
      return <RosterSection sheet={sheet} side={section.side ?? 'A'} />
    case 'lineup':
      return <LineupSection sheet={sheet} setIndex={section.setIndex ?? 0} />
    case 'score':
      return <RunningScoreSection sheet={sheet} setIndex={section.setIndex ?? 0} />
    case 'changes':
      return <ChangesSection sheet={sheet} setIndex={section.setIndex ?? 0} />
    case 'results':
      return <ResultsSection sheet={sheet} />
    case 'sanctions':
      return <SanctionsSection sheet={sheet} />
    case 'remarks':
      return <RemarksSection sheet={sheet} />
    case 'submit':
      return <SubmitSection sheet={sheet} provider={provider} />
  }
}

function Row({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation()
  return (
    <div className="sheet-row">
      <span className="sheet-label">{label}</span>
      <span className="sheet-value mono">{value || t('common.blank')}</span>
    </div>
  )
}

function HeaderSection({ sheet }: { sheet: Scoresheet }) {
  const { t } = useTranslation()
  const { header, officials } = sheet
  return (
    <div className="grid-2">
      <div>
        <Row label={t('sheet.row.competition')} value={header.competition} />
        <Row label={t('sheet.row.stage')} value={header.stage} />
        <Row label={t('sheet.row.pool')} value={header.pool} />
        <Row label={t('sheet.row.matchNumber')} value={header.matchNumber} />
        <Row label={t('sheet.row.category')} value={header.category} />
        <Row label={t('sheet.row.date')} value={header.date} />
        <Row label={t('sheet.row.time')} value={header.time} />
        <Row label={t('sheet.row.hall')} value={header.hall} />
        <Row label={t('sheet.row.city')} value={header.city} />
      </div>
      <div>
        <Row label={t('sheet.row.teamA')} value={sheet.teams.A.name} />
        <Row label={t('sheet.row.teamB')} value={sheet.teams.B.name} />
        <Row label={t('match.officials.first')} value={officials.firstReferee} />
        <Row label={t('match.officials.second')} value={officials.secondReferee} />
        <Row label={t('match.officials.scorer')} value={officials.scorer} />
        <Row label={t('match.officials.assistantScorer')} value={officials.assistantScorer} />
        <Row label={t('match.officials.lineJudges')} value={officials.lineJudges} />
        <Row label={t('sheet.row.rules')} value={ruleSetName(sheet.rules, t)} />
      </div>
    </div>
  )
}

function TossSection({ sheet }: { sheet: Scoresheet }) {
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

function RosterSection({ sheet, side }: { sheet: Scoresheet; side: TeamSide }) {
  const { t } = useTranslation()
  const team = sheet.teams[side]
  if (team.players.length === 0) return <EmptyState>{t('transfer.noPlayers', { side })}</EmptyState>

  return (
    <>
      <Row label={t('sheet.row.team')} value={team.name} />
      <Row label={t('sheet.row.coach')} value={team.staff.coach} />
      <Row label={t('sheet.row.assistantCoach')} value={team.staff.assistantCoach} />
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{t('common.number')}</th>
              <th>{t('common.name')}</th>
              <th>{t('teams.col.licence')}</th>
              <th>{t('teams.col.captainShort')}</th>
              <th>{t('teams.col.liberoShort')}</th>
            </tr>
          </thead>
          <tbody>
            {[...team.players]
              .sort((a, b) => (a.number ?? 999) - (b.number ?? 999))
              .map((player) => (
                <tr key={player.id}>
                  <td className="mono big">{player.number ?? t('common.blank')}</td>
                  <td>
                    {player.lastName} {player.firstName}
                  </td>
                  <td className="mono">{player.licence || t('common.blank')}</td>
                  <td>{player.isCaptain ? t('teams.col.captainShort') : ''}</td>
                  <td>{player.isLibero ? t('teams.col.liberoShort') : ''}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function LineupSection({ sheet, setIndex }: { sheet: Scoresheet; setIndex: number }) {
  const { t } = useTranslation()
  const record = sheet.sets[setIndex]
  if (!record) return <EmptyState>{t('transfer.notStarted')}</EmptyState>

  return (
    <div className="grid-2">
      {TEAM_SIDES.map((side) => (
        <div key={side}>
          <h3>
            {t('common.teamSide', { side })} - {sheet.teams[side].name}
          </h3>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.position')}</th>
                  <th>{t('sheet.col.playerNumber')}</th>
                  <th>{t('common.name')}</th>
                </tr>
              </thead>
              <tbody>
                {POSITION_LABELS.map((label, slot) => {
                  const player = findPlayer(sheet.teams[side], record.lineups[side].slots[slot] ?? null)
                  return (
                    <tr key={label}>
                      <td className="mono">{label}</td>
                      <td className="mono big">{player?.number ?? t('common.blank')}</td>
                      <td>{player ? `${player.lastName} ${player.firstName}` : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Row
            label={t('sheet.row.liberos')}
            value={record.lineups[side].liberoIds
              .map((id) => findPlayer(sheet.teams[side], id))
              .map((player) => (player ? String(player.number ?? t('common.blank')) : ''))
              .join(', ')}
          />
        </div>
      ))}
      <Row
        label={t('sheet.row.servesFirstSet')}
        value={record.firstServe ? t('common.teamSide', { side: record.firstServe }) : ''}
      />
    </div>
  )
}

function RunningScoreSection({ sheet, setIndex }: { sheet: Scoresheet; setIndex: number }) {
  const { t } = useTranslation()
  const record = sheet.sets[setIndex]
  if (!record) return <EmptyState>{t('transfer.notStarted')}</EmptyState>
  const state = computeSetState(sheet, setIndex)

  return (
    <>
      <div className="grid-2">
        {TEAM_SIDES.map((side) => (
          <ServiceRoundTable key={side} side={side} state={state} sheet={sheet} />
        ))}
      </div>

      <h3>{t('sheet.rallyByRally')}</h3>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('sheet.col.pointTo')}</th>
              <th>{t('sheet.col.scoreA')}</th>
              <th>{t('sheet.col.scoreB')}</th>
            </tr>
          </thead>
          <tbody>
            {state.progression.map((entry, index) => (
              <tr key={index}>
                <td className="mono">{index + 1}</td>
                <td className="mono">{entry.winner}</td>
                <td className="mono">{entry.A}</td>
                <td className="mono">{entry.B}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {state.progression.length === 0 && <EmptyState>{t('transfer.noRallies')}</EmptyState>}
    </>
  )
}

function ServiceRoundTable({ side, state, sheet }: { side: TeamSide; state: SetState; sheet: Scoresheet }) {
  const { t } = useTranslation()
  const rounds = state.serviceRounds[side]

  return (
    <div>
      <h3>{t('sheet.serviceRounds', { side, name: sheet.teams[side].name })}</h3>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{t('sheet.col.round')}</th>
              <th>{t('sheet.col.serverNumber')}</th>
              <th>{t('common.position')}</th>
              <th>{t('sheet.col.pointsOnService')}</th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((round, index) => (
              <tr key={index}>
                <td className="mono">{index + 1}</td>
                <td className="mono big">{round.server.number ?? t('common.blank')}</td>
                <td className="mono">{POSITION_LABELS[round.server.slot]}</td>
                <td className="mono">
                  {round.pointsScored.length > 0 ? round.pointsScored.join(' ') : '-'}{' '}
                  <span className="muted">
                    {t('sheet.col.fromScore', {
                      own: round.scoreAtStart.own,
                      opponent: round.scoreAtStart.opponent,
                    })}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rounds.length === 0 && <EmptyState>{t('transfer.noRounds')}</EmptyState>}
    </div>
  )
}

function ChangesSection({ sheet, setIndex }: { sheet: Scoresheet; setIndex: number }) {
  const { t } = useTranslation()
  const record = sheet.sets[setIndex]
  if (!record) return <EmptyState>{t('transfer.notStarted')}</EmptyState>

  return (
    <div className="grid-2">
      {TEAM_SIDES.map((side) => (
        <div key={side}>
          <h3>{t('common.teamSide', { side })}</h3>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.position')}</th>
                  <th>{t('sheet.col.in')}</th>
                  <th>{t('sheet.col.out')}</th>
                  <th>{t('common.score')}</th>
                </tr>
              </thead>
              <tbody>
                {record.substitutions[side].map((entry, index) => {
                  const inbound = findPlayer(sheet.teams[side], entry.inPlayerId)
                  const out = findPlayer(sheet.teams[side], entry.outPlayerId)
                  return (
                    <tr key={index}>
                      <td className="mono">{POSITION_LABELS[entry.slot]}</td>
                      <td className="mono big">{inbound?.number ?? t('common.blank')}</td>
                      <td className="mono">{out?.number ?? t('common.blank')}</td>
                      <td className="mono">
                        {entry.scoreA}:{entry.scoreB}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {record.substitutions[side].length === 0 && <EmptyState>{t('transfer.noSubstitutions')}</EmptyState>}

          <h3>{t('sheet.timeouts')}</h3>
          <p className="mono">
            {record.timeouts
              .filter((timeout) => timeout.team === side)
              .map((timeout) => `${timeout.scoreA}:${timeout.scoreB}`)
              .join('   ') || t('common.blank')}
          </p>
        </div>
      ))}
    </div>
  )
}

function ResultsSection({ sheet }: { sheet: Scoresheet }) {
  const { t } = useTranslation()
  const match = computeMatchState(sheet)

  return (
    <>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{t('common.set')}</th>
              <th>{t('sheet.col.duration')}</th>
              <th>{t('sheet.row.teamA')}</th>
              <th>{t('sheet.row.teamB')}</th>
              <th>{t('sheet.col.subsA')}</th>
              <th>{t('sheet.col.subsB')}</th>
              <th>{t('sheet.col.timeoutsA')}</th>
              <th>{t('sheet.col.timeoutsB')}</th>
              <th>{t('sheet.col.winner')}</th>
            </tr>
          </thead>
          <tbody>
            {sheet.sets.map((record, index) => {
              const state = computeSetState(sheet, index)
              return (
                <tr key={record.number}>
                  <td className="mono">{record.number}</td>
                  <td className="mono">{record.durationMinutes ?? t('common.blank')}</td>
                  <td className="mono big">{state.score.A}</td>
                  <td className="mono big">{state.score.B}</td>
                  <td className="mono">{state.substitutionsUsed.A}</td>
                  <td className="mono">{state.substitutionsUsed.B}</td>
                  <td className="mono">{state.timeoutsUsed.A}</td>
                  <td className="mono">{state.timeoutsUsed.B}</td>
                  <td className="mono">{state.winner ?? t('common.blank')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Row label={t('sheet.row.setsWon')} value={`${match.setsWon.A} : ${match.setsWon.B}`} />
      <Row
        label={t('sheet.row.totalPoints')}
        value={`${match.setResults.reduce((sum, set) => sum + set.A, 0)} : ${match.setResults.reduce(
          (sum, set) => sum + set.B,
          0,
        )}`}
      />
      <Row
        label={t('sheet.row.matchWinner')}
        value={
          match.winner
            ? `${t('common.teamSide', { side: match.winner })} - ${sheet.teams[match.winner].name}`
            : t('common.notDecided')
        }
      />
    </>
  )
}

function SanctionsSection({ sheet }: { sheet: Scoresheet }) {
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
                {sanction.scoreA}:{sanction.scoreB}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RemarksSection({ sheet }: { sheet: Scoresheet }) {
  const { t } = useTranslation()
  return (
    <>
      <Row label={t('sheet.row.remarks')} value={sheet.remarks} />
      <Row label={t('sheet.row.scorer')} value={sheet.officials.scorer} />
      {TEAM_SIDES.map((side) => (
        <Row key={side} label={t('sheet.row.captain', { side })} value={captainName(sheet, side)} />
      ))}
      {TEAM_SIDES.map((side) => (
        <Row key={side} label={t('sheet.row.coachSide', { side })} value={sheet.teams[side].staff.coach} />
      ))}
      <Row label={t('sheet.row.firstReferee')} value={sheet.officials.firstReferee} />
      <p className="muted mt-3">{t('sheet.signatureNote')}</p>
    </>
  )
}

function captainName(sheet: Scoresheet, side: TeamSide): string {
  const captain = sheet.teams[side].players.find((player) => player.isCaptain)
  return captain ? playerLabel(captain) : ''
}

function SubmitSection({ sheet, provider }: { sheet: Scoresheet; provider: FederationProvider }) {
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
        <li>{t('submit.check.signatures')}</li>
        <li>{t('submit.check.durations')}</li>
        <li>{t('submit.check.sanctions')}</li>
      </ul>
    </>
  )
}
