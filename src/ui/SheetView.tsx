import { useMemo, useState, type ReactElement } from 'react'

import { computeMatchState, computeSetState, type SetState } from '../scoresheet/engine'
import {
  findPlayer,
  playerLabel,
  POSITION_LABELS,
  TEAM_SIDES,
  type Scoresheet,
  type TeamSide,
} from '../scoresheet/model'
import { Card, EmptyState, SelectField } from './components'

interface Section {
  id: string
  label: string
  render: () => ReactElement
}

/**
 * Read-only rendering of one box of the sheet at a time, sized for copying onto
 * paper: no inputs, monospaced numbers, and a print button that prints the
 * selected section alone.
 */
export function SheetView({ sheet }: { sheet: Scoresheet }) {
  const [sectionId, setSectionId] = useState('header')

  const sections = useMemo<Section[]>(() => {
    const list: Section[] = [
      { id: 'header', label: 'Header and officials', render: () => <HeaderSection sheet={sheet} /> },
      { id: 'toss', label: 'Toss and sides', render: () => <TossSection sheet={sheet} /> },
      ...TEAM_SIDES.map((side) => ({
        id: `roster-${side}`,
        label: `Team ${side} roster`,
        render: () => <RosterSection sheet={sheet} side={side} />,
      })),
    ]

    sheet.sets.forEach((record, index) => {
      list.push({
        id: `lineup-${record.number}`,
        label: `Set ${record.number}: starting lineups`,
        render: () => <LineupSection sheet={sheet} setIndex={index} />,
      })
      list.push({
        id: `score-${record.number}`,
        label: `Set ${record.number}: running score`,
        render: () => <RunningScoreSection sheet={sheet} setIndex={index} />,
      })
      list.push({
        id: `changes-${record.number}`,
        label: `Set ${record.number}: substitutions and time-outs`,
        render: () => <ChangesSection sheet={sheet} setIndex={index} />,
      })
    })

    list.push({ id: 'results', label: 'Results table', render: () => <ResultsSection sheet={sheet} /> })
    list.push({ id: 'sanctions', label: 'Sanctions', render: () => <SanctionsSection sheet={sheet} /> })
    list.push({ id: 'remarks', label: 'Remarks and signatures', render: () => <RemarksSection sheet={sheet} /> })
    return list
  }, [sheet])

  const active = sections.find((section) => section.id === sectionId) ?? sections[0]

  return (
    <>
      <Card
        title="Copy to paper"
        subtitle="Pick the box you are filling in. Everything here is derived from what you entered."
        actions={
          <button type="button" onClick={() => window.print()}>
            Print this section
          </button>
        }
      >
        <div className="grid grid-2">
          <SelectField
            label="Section"
            value={active?.id ?? ''}
            placeholder="Select a section"
            options={sections.map((section) => ({ value: section.id, label: section.label }))}
            onChange={(value) => value && setSectionId(value)}
          />
        </div>
      </Card>

      <div className="printable">
        <Card title={active?.label}>{active?.render()}</Card>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="sheet-row">
      <span className="sheet-label">{label}</span>
      <span className="sheet-value mono">{value || '--'}</span>
    </div>
  )
}

function HeaderSection({ sheet }: { sheet: Scoresheet }) {
  const { header, officials } = sheet
  return (
    <div className="grid grid-2">
      <div>
        <Row label="Competition" value={header.competition} />
        <Row label="Stage / round" value={header.stage} />
        <Row label="Pool / group" value={header.pool} />
        <Row label="Match number" value={header.matchNumber} />
        <Row label="Category" value={header.category} />
        <Row label="Date" value={header.date} />
        <Row label="Start time" value={header.time} />
        <Row label="Hall" value={header.hall} />
        <Row label="City" value={header.city} />
      </div>
      <div>
        <Row label="Team A" value={sheet.teams.A.name} />
        <Row label="Team B" value={sheet.teams.B.name} />
        <Row label="1st referee" value={officials.firstReferee} />
        <Row label="2nd referee" value={officials.secondReferee} />
        <Row label="Scorer" value={officials.scorer} />
        <Row label="Assistant scorer" value={officials.assistantScorer} />
        <Row label="Line judges" value={officials.lineJudges} />
        <Row label="Rules" value={sheet.rules.name} />
      </div>
    </div>
  )
}

function TossSection({ sheet }: { sheet: Scoresheet }) {
  const first = sheet.toss.firstServe
  const left = sheet.toss.leftSide
  return (
    <div>
      <Row label="Serves first (set 1)" value={first ? `Team ${first} - ${sheet.teams[first].name}` : ''} />
      <Row label="Receives first (set 1)" value={first ? `Team ${first === 'A' ? 'B' : 'A'}` : ''} />
      <Row label="Left side (set 1)" value={left ? `Team ${left} - ${sheet.teams[left].name}` : ''} />
      <Row label="Right side (set 1)" value={left ? `Team ${left === 'A' ? 'B' : 'A'}` : ''} />
      <p className="muted">Teams change ends every set; the deciding set has its own toss and a change of ends at 8.</p>
    </div>
  )
}

function RosterSection({ sheet, side }: { sheet: Scoresheet; side: TeamSide }) {
  const team = sheet.teams[side]
  if (team.players.length === 0) return <EmptyState>No players entered for team {side} yet.</EmptyState>

  return (
    <>
      <Row label="Team" value={team.name} />
      <Row label="Coach" value={team.staff.coach} />
      <Row label="Assistant coach" value={team.staff.assistantCoach} />
      <table className="table sheet-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>Name</th>
            <th>Licence</th>
            <th>C</th>
            <th>L</th>
          </tr>
        </thead>
        <tbody>
          {[...team.players]
            .sort((a, b) => (a.number ?? 999) - (b.number ?? 999))
            .map((player) => (
              <tr key={player.id}>
                <td className="mono">{player.number ?? '--'}</td>
                <td>
                  {player.lastName} {player.firstName}
                </td>
                <td className="mono">{player.licence || '--'}</td>
                <td>{player.isCaptain ? 'C' : ''}</td>
                <td>{player.isLibero ? 'L' : ''}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </>
  )
}

function LineupSection({ sheet, setIndex }: { sheet: Scoresheet; setIndex: number }) {
  const record = sheet.sets[setIndex]
  if (!record) return <EmptyState>Set not started.</EmptyState>

  return (
    <div className="grid grid-2">
      {TEAM_SIDES.map((side) => (
        <div key={side}>
          <h3>
            Team {side} - {sheet.teams[side].name}
          </h3>
          <table className="table sheet-table">
            <thead>
              <tr>
                <th>Position</th>
                <th>Player no.</th>
                <th>Name</th>
              </tr>
            </thead>
            <tbody>
              {POSITION_LABELS.map((label, slot) => {
                const player = findPlayer(sheet.teams[side], record.lineups[side].slots[slot] ?? null)
                return (
                  <tr key={label}>
                    <td className="mono">{label}</td>
                    <td className="mono big">{player?.number ?? '--'}</td>
                    <td>{player ? `${player.lastName} ${player.firstName}` : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <Row
            label="Liberos"
            value={record.lineups[side].liberoIds
              .map((id) => findPlayer(sheet.teams[side], id))
              .map((player) => (player ? String(player.number ?? '--') : ''))
              .join(', ')}
          />
        </div>
      ))}
      <Row label="Serves first" value={record.firstServe ? `Team ${record.firstServe}` : ''} />
    </div>
  )
}

function RunningScoreSection({ sheet, setIndex }: { sheet: Scoresheet; setIndex: number }) {
  const record = sheet.sets[setIndex]
  if (!record) return <EmptyState>Set not started.</EmptyState>
  const state = computeSetState(sheet, setIndex)

  return (
    <>
      <div className="grid grid-2">
        {TEAM_SIDES.map((side) => (
          <ServiceRoundTable key={side} side={side} state={state} sheet={sheet} />
        ))}
      </div>

      <h3>Rally by rally</h3>
      <table className="table sheet-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Point to</th>
            <th>Score A</th>
            <th>Score B</th>
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
      {state.progression.length === 0 && <EmptyState>No rallies recorded in this set yet.</EmptyState>}
    </>
  )
}

function ServiceRoundTable({ side, state, sheet }: { side: TeamSide; state: SetState; sheet: Scoresheet }) {
  const rounds = state.serviceRounds[side]
  return (
    <div>
      <h3>
        Team {side} service rounds - {sheet.teams[side].name}
      </h3>
      <table className="table sheet-table">
        <thead>
          <tr>
            <th>Round</th>
            <th>Server no.</th>
            <th>Position</th>
            <th>Points scored on this service</th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((round, index) => (
            <tr key={index}>
              <td className="mono">{index + 1}</td>
              <td className="mono big">{round.server.number ?? '--'}</td>
              <td className="mono">{POSITION_LABELS[round.server.slot]}</td>
              <td className="mono">
                {round.pointsScored.length > 0 ? round.pointsScored.join(' ') : '-'}
                <span className="muted">
                  {' '}
                  (from {round.scoreAtStart.own}:{round.scoreAtStart.opponent})
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rounds.length === 0 && <EmptyState>No service rounds yet.</EmptyState>}
    </div>
  )
}

function ChangesSection({ sheet, setIndex }: { sheet: Scoresheet; setIndex: number }) {
  const record = sheet.sets[setIndex]
  if (!record) return <EmptyState>Set not started.</EmptyState>

  return (
    <div className="grid grid-2">
      {TEAM_SIDES.map((side) => (
        <div key={side}>
          <h3>Team {side}</h3>
          <table className="table sheet-table">
            <thead>
              <tr>
                <th>Position</th>
                <th>In</th>
                <th>Out</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {record.substitutions[side].map((entry, index) => {
                const inbound = findPlayer(sheet.teams[side], entry.inPlayerId)
                const out = findPlayer(sheet.teams[side], entry.outPlayerId)
                return (
                  <tr key={index}>
                    <td className="mono">{POSITION_LABELS[entry.slot]}</td>
                    <td className="mono big">{inbound?.number ?? '--'}</td>
                    <td className="mono">{out?.number ?? '--'}</td>
                    <td className="mono">
                      {entry.scoreA}:{entry.scoreB}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {record.substitutions[side].length === 0 && <EmptyState>No substitutions.</EmptyState>}

          <h3>Time-outs</h3>
          <p className="mono">
            {record.timeouts
              .filter((timeout) => timeout.team === side)
              .map((timeout) => `${timeout.scoreA}:${timeout.scoreB}`)
              .join('   ') || '--'}
          </p>
        </div>
      ))}
    </div>
  )
}

function ResultsSection({ sheet }: { sheet: Scoresheet }) {
  const match = computeMatchState(sheet)

  return (
    <>
      <table className="table sheet-table">
        <thead>
          <tr>
            <th>Set</th>
            <th>Duration</th>
            <th>Team A</th>
            <th>Team B</th>
            <th>Subs A</th>
            <th>Subs B</th>
            <th>T-O A</th>
            <th>T-O B</th>
            <th>Winner</th>
          </tr>
        </thead>
        <tbody>
          {sheet.sets.map((record, index) => {
            const state = computeSetState(sheet, index)
            return (
              <tr key={record.number}>
                <td className="mono">{record.number}</td>
                <td className="mono">{record.durationMinutes ?? '--'}</td>
                <td className="mono big">{state.score.A}</td>
                <td className="mono big">{state.score.B}</td>
                <td className="mono">{state.substitutionsUsed.A}</td>
                <td className="mono">{state.substitutionsUsed.B}</td>
                <td className="mono">{state.timeoutsUsed.A}</td>
                <td className="mono">{state.timeoutsUsed.B}</td>
                <td className="mono">{state.winner ?? '--'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <Row label="Sets won" value={`${match.setsWon.A} : ${match.setsWon.B}`} />
      <Row
        label="Total points"
        value={`${match.setResults.reduce((sum, set) => sum + set.A, 0)} : ${match.setResults.reduce(
          (sum, set) => sum + set.B,
          0,
        )}`}
      />
      <Row
        label="Match winner"
        value={match.winner ? `Team ${match.winner} - ${sheet.teams[match.winner].name}` : 'not decided'}
      />
    </>
  )
}

function SanctionsSection({ sheet }: { sheet: Scoresheet }) {
  if (sheet.sanctions.length === 0) return <EmptyState>No sanctions recorded.</EmptyState>

  return (
    <table className="table sheet-table">
      <thead>
        <tr>
          <th>Sanction</th>
          <th>Team</th>
          <th>Member</th>
          <th>Set</th>
          <th>Score</th>
        </tr>
      </thead>
      <tbody>
        {sheet.sanctions.map((sanction, index) => (
          <tr key={index}>
            <td>{sanction.kind}</td>
            <td className="mono">{sanction.team}</td>
            <td className="mono">{sanction.member || '--'}</td>
            <td className="mono">{sanction.set}</td>
            <td className="mono">
              {sanction.scoreA}:{sanction.scoreB}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RemarksSection({ sheet }: { sheet: Scoresheet }) {
  return (
    <>
      <Row label="Remarks" value={sheet.remarks} />
      <Row label="Scorer" value={sheet.officials.scorer} />
      <Row label="Captain A" value={captainName(sheet, 'A')} />
      <Row label="Captain B" value={captainName(sheet, 'B')} />
      <Row label="Coach A" value={sheet.teams.A.staff.coach} />
      <Row label="Coach B" value={sheet.teams.B.staff.coach} />
      <Row label="1st referee" value={sheet.officials.firstReferee} />
      <p className="muted">Signatures go on paper: captains sign after the match, then the coaches and referees.</p>
    </>
  )
}

function captainName(sheet: Scoresheet, side: TeamSide): string {
  const captain = sheet.teams[side].players.find((player) => player.isCaptain)
  return captain ? playerLabel(captain) : ''
}
