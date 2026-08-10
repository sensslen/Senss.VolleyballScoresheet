import { useState } from 'react'

import { applySubstitution, computeMatchState, computeSetState, rallyEntryBlocker, validateSubstitution } from '../scoresheet/engine'
import { emptySet } from '../scoresheet/factory'
import {
  findPlayer,
  otherSide,
  playerLabel,
  POSITION_LABELS,
  TEAM_SIDES,
  type SanctionKind,
  type Scoresheet,
  type TeamSide,
} from '../scoresheet/model'
import { maxSets } from '../scoresheet/rules'
import { Banner, Card, EmptyState, SelectField } from './components'
import type { SheetUpdater } from './updater'

export function PlayStep({
  sheet,
  update,
  activeSetIndex,
  onActiveSetChange,
}: {
  sheet: Scoresheet
  update: SheetUpdater
  activeSetIndex: number
  onActiveSetChange: (index: number) => void
}) {
  const match = computeMatchState(sheet)
  const total = maxSets(sheet.rules)
  const index = Math.min(activeSetIndex, sheet.sets.length - 1)
  const setNumber = index + 1
  const canStartNextSet = !match.isComplete && sheet.sets.length < total && isSetFinished(sheet, sheet.sets.length - 1)

  return (
    <>
      <TossCard sheet={sheet} update={update} />

      <Card
        title="Sets"
        subtitle={`Match score ${match.setsWon.A} : ${match.setsWon.B}${
          match.isComplete ? ` - team ${match.winner} wins` : ''
        }`}
        actions={
          canStartNextSet ? (
            <button
              type="button"
              className="primary"
              onClick={() =>
                update((draft) => {
                  const next = emptySet(draft.sets.length + 1)
                  const previous = draft.sets[draft.sets.length - 1]
                  // Service alternates each set; the deciding set gets a fresh toss.
                  next.firstServe = previous?.firstServe ? otherSide(previous.firstServe) : null
                  draft.sets.push(next)
                })
              }
            >
              Start set {sheet.sets.length + 1}
            </button>
          ) : undefined
        }
      >
        <div className="tabs">
          {sheet.sets.map((record, position) => {
            const state = computeSetState(sheet, position)
            return (
              <button
                key={record.number}
                type="button"
                className={position === index ? 'tab tab-active' : 'tab'}
                onClick={() => onActiveSetChange(position)}
              >
                Set {record.number}
                <span className="tab-score">
                  {state.score.A}:{state.score.B}
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      <SetPanel key={setNumber} sheet={sheet} update={update} setIndex={index} />
    </>
  )
}

function isSetFinished(sheet: Scoresheet, index: number): boolean {
  if (index < 0) return false
  return computeSetState(sheet, index).isComplete
}

function TossCard({ sheet, update }: { sheet: Scoresheet; update: SheetUpdater }) {
  const sideOptions = TEAM_SIDES.map((side) => ({
    value: side,
    label: `Team ${side} - ${sheet.teams[side].name || '(unnamed)'}`,
  }))

  return (
    <Card title="Toss" subtitle="Recorded in the header band before set 1.">
      <div className="grid grid-2">
        <SelectField
          label="Serves first in set 1"
          value={sheet.toss.firstServe ?? ''}
          options={sideOptions}
          onChange={(value) =>
            update((draft) => {
              draft.toss.firstServe = (value || null) as TeamSide | null
              const first = draft.sets[0]
              if (first && first.rallies.length === 0) first.firstServe = draft.toss.firstServe
            })
          }
        />
        <SelectField
          label="Starts on the left side"
          value={sheet.toss.leftSide ?? ''}
          options={sideOptions}
          onChange={(value) => update((draft) => void (draft.toss.leftSide = (value || null) as TeamSide | null))}
        />
      </div>
    </Card>
  )
}

function SetPanel({ sheet, update, setIndex }: { sheet: Scoresheet; update: SheetUpdater; setIndex: number }) {
  const record = sheet.sets[setIndex]
  if (!record) return <EmptyState>That set has not been started.</EmptyState>

  const state = computeSetState(sheet, setIndex)
  const blocker = rallyEntryBlocker(sheet, setIndex)
  const sideOptions = TEAM_SIDES.map((side) => ({
    value: side,
    label: `Team ${side} - ${sheet.teams[side].name || '(unnamed)'}`,
  }))

  return (
    <>
      <Card
        title={`Set ${record.number} lineups`}
        subtitle="Positions I to VI double as the service order."
      >
        <div className="grid grid-2">
          <SelectField
            label="Serves first in this set"
            value={record.firstServe ?? ''}
            options={sideOptions}
            onChange={(value) =>
              update((draft) => {
                const target = draft.sets[setIndex]
                if (target) target.firstServe = (value || null) as TeamSide | null
              })
            }
            hint={state.isDeciding ? 'The deciding set starts with a new toss.' : undefined}
          />
        </div>
        <div className="grid grid-2">
          {TEAM_SIDES.map((side) => (
            <LineupEditor key={side} sheet={sheet} update={update} setIndex={setIndex} side={side} />
          ))}
        </div>
      </Card>

      <Card title={`Set ${record.number} scoring`}>
        <div className="scoreboard">
          {TEAM_SIDES.map((side) => (
            <div key={side} className={state.servingSide === side ? 'score-box serving' : 'score-box'}>
              <span className="score-team">
                Team {side} {state.servingSide === side ? '(serving)' : ''}
              </span>
              <span className="score-value">{state.score[side]}</span>
              <span className="muted">
                {sheet.teams[side].name || '(unnamed)'}
                {state.nextServer[side] ? ` - next server no. ${state.nextServer[side]!.number ?? '--'}` : ''}
              </span>
            </div>
          ))}
        </div>

        {blocker && <Banner kind="info">{blocker}</Banner>}
        {state.issues.map((issue) => (
          <Banner key={issue} kind="warn">
            {issue}
          </Banner>
        ))}

        <div className="button-row rally-row">
          {TEAM_SIDES.map((side) => (
            <button
              key={side}
              type="button"
              className="rally"
              disabled={Boolean(blocker)}
              onClick={() =>
                update((draft) => {
                  draft.sets[setIndex]?.rallies.push({ winner: side })
                })
              }
            >
              Point Team {side}
            </button>
          ))}
          <button
            type="button"
            disabled={record.rallies.length === 0}
            onClick={() => update((draft) => void draft.sets[setIndex]?.rallies.pop())}
          >
            Undo last rally
          </button>
        </div>

        <div className="button-row">
          {TEAM_SIDES.map((side) => (
            <button
              key={side}
              type="button"
              disabled={state.isComplete || state.timeoutsUsed[side] >= sheet.rules.timeoutsPerSet}
              onClick={() =>
                update((draft) => {
                  draft.sets[setIndex]?.timeouts.push({
                    team: side,
                    atRally: record.rallies.length - 1,
                    scoreA: state.score.A,
                    scoreB: state.score.B,
                  })
                })
              }
            >
              Time-out {side} ({state.timeoutsUsed[side]}/{sheet.rules.timeoutsPerSet})
            </button>
          ))}
          {record.timeouts.length > 0 && (
            <button type="button" className="ghost" onClick={() => update((draft) => void draft.sets[setIndex]?.timeouts.pop())}>
              Undo time-out
            </button>
          )}
        </div>

        {state.isComplete && (
          <Banner kind="ok">
            Set {record.number} finished {state.score.A}:{state.score.B} to team {state.winner}. Write the duration in
            the results box.
          </Banner>
        )}
      </Card>

      <Card title="Substitutions">
        <div className="grid grid-2">
          {TEAM_SIDES.map((side) => (
            <SubstitutionForm key={side} sheet={sheet} update={update} setIndex={setIndex} side={side} />
          ))}
        </div>
      </Card>

      <SanctionCard sheet={sheet} update={update} setNumber={record.number} scoreA={state.score.A} scoreB={state.score.B} />
    </>
  )
}

function LineupEditor({
  sheet,
  update,
  setIndex,
  side,
}: {
  sheet: Scoresheet
  update: SheetUpdater
  setIndex: number
  side: TeamSide
}) {
  const record = sheet.sets[setIndex]
  const team = sheet.teams[side]
  if (!record) return null

  const slots = record.lineups[side].slots
  const locked = record.rallies.length > 0
  const options = team.players
    .filter((player) => !player.isLibero)
    .map((player) => ({ value: player.id, label: playerLabel(player) }))

  return (
    <div className="lineup">
      <h3>
        Team {side} - {team.name || '(unnamed)'}
      </h3>
      {locked && <p className="muted">The set has started; change the lineup only to fix a transcription error.</p>}
      <div className="grid grid-3">
        {POSITION_LABELS.map((label, slot) => (
          <SelectField
            key={label}
            label={`Position ${label}`}
            value={slots[slot] ?? ''}
            options={options}
            onChange={(value) =>
              update((draft) => {
                const target = draft.sets[setIndex]
                if (target) target.lineups[side].slots[slot] = value || null
              })
            }
          />
        ))}
      </div>
      <SelectField
        label="Libero on the sheet"
        value=""
        placeholder="Add libero"
        options={team.players
          .filter((player) => player.isLibero && !record.lineups[side].liberoIds.includes(player.id))
          .map((player) => ({ value: player.id, label: playerLabel(player) }))}
        onChange={(value) =>
          update((draft) => {
            const target = draft.sets[setIndex]
            if (target && value) target.lineups[side].liberoIds.push(value)
          })
        }
      />
      {record.lineups[side].liberoIds.length > 0 && (
        <p className="chips">
          {record.lineups[side].liberoIds.map((liberoId) => {
            const player = findPlayer(team, liberoId)
            return (
              <button
                key={liberoId}
                type="button"
                className="chip"
                onClick={() =>
                  update((draft) => {
                    const target = draft.sets[setIndex]
                    if (!target) return
                    target.lineups[side].liberoIds = target.lineups[side].liberoIds.filter((id) => id !== liberoId)
                  })
                }
              >
                L {player ? playerLabel(player) : liberoId} x
              </button>
            )
          })}
        </p>
      )}
    </div>
  )
}

function SubstitutionForm({
  sheet,
  update,
  setIndex,
  side,
}: {
  sheet: Scoresheet
  update: SheetUpdater
  setIndex: number
  side: TeamSide
}) {
  const [slot, setSlot] = useState<string>('')
  const [incoming, setIncoming] = useState<string>('')
  const record = sheet.sets[setIndex]
  const state = computeSetState(sheet, setIndex)
  const team = sheet.teams[side]
  if (!record) return null

  const slotIndex = slot === '' ? -1 : Number(slot)
  const problem =
    slotIndex >= 0 && incoming ? validateSubstitution(sheet, setIndex, side, slotIndex, incoming) : null

  const record_ = () => {
    if (slotIndex < 0 || !incoming || problem) return
    const substitution = applySubstitution(sheet, setIndex, side, slotIndex, incoming)
    if (!substitution) return
    update((draft) => void draft.sets[setIndex]?.substitutions[side].push(substitution))
    setSlot('')
    setIncoming('')
  }

  const history = record.substitutions[side]

  return (
    <div className="lineup">
      <h3>
        Team {side} ({state.substitutionsUsed[side]}/{sheet.rules.substitutionsPerSet} used)
      </h3>
      <div className="grid grid-2">
        <SelectField
          label="Position leaving"
          value={slot}
          options={POSITION_LABELS.map((label, index) => {
            const playerId = state.courtSlots[side][index] ?? null
            const player = findPlayer(team, playerId)
            return { value: String(index), label: `${label} - ${player ? playerLabel(player) : 'empty'}` }
          })}
          onChange={(value) => setSlot(value)}
        />
        <SelectField
          label="Player entering"
          value={incoming}
          options={team.players
            .filter((player) => !player.isLibero && !state.courtSlots[side].includes(player.id))
            .map((player) => ({ value: player.id, label: playerLabel(player) }))}
          onChange={(value) => setIncoming(value)}
        />
      </div>
      {problem && <Banner kind="warn">{problem}</Banner>}
      <div className="button-row">
        <button type="button" className="primary" disabled={slotIndex < 0 || !incoming || Boolean(problem)} onClick={record_}>
          Record substitution
        </button>
        {history.length > 0 && (
          <button
            type="button"
            className="ghost"
            onClick={() => update((draft) => void draft.sets[setIndex]?.substitutions[side].pop())}
          >
            Undo last
          </button>
        )}
      </div>
      {history.length > 0 && (
        <ul className="list">
          {history.map((entry, position) => {
            const out = findPlayer(team, entry.outPlayerId)
            const inbound = findPlayer(team, entry.inPlayerId)
            return (
              <li key={position}>
                {POSITION_LABELS[entry.slot]}: no. {inbound?.number ?? '--'} for no. {out?.number ?? '--'} at{' '}
                {entry.scoreA}:{entry.scoreB}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

const SANCTION_KINDS: Array<{ value: SanctionKind; label: string }> = [
  { value: 'warning', label: 'Warning (yellow card)' },
  { value: 'penalty', label: 'Penalty (red card)' },
  { value: 'expulsion', label: 'Expulsion (both cards together)' },
  { value: 'disqualification', label: 'Disqualification (both cards apart)' },
]

function SanctionCard({
  sheet,
  update,
  setNumber,
  scoreA,
  scoreB,
}: {
  sheet: Scoresheet
  update: SheetUpdater
  setNumber: number
  scoreA: number
  scoreB: number
}) {
  const [kind, setKind] = useState<SanctionKind | ''>('')
  const [side, setSide] = useState<TeamSide | ''>('')
  const [member, setMember] = useState('')

  const add = () => {
    if (!kind || !side) return
    update((draft) =>
      draft.sanctions.push({
        kind,
        team: side,
        member,
        set: setNumber,
        scoreA,
        scoreB,
        remark: '',
      }),
    )
    setKind('')
    setSide('')
    setMember('')
  }

  return (
    <Card title="Sanctions" subtitle="Team, member, set and score go in the sanctions box.">
      <div className="grid grid-4">
        <SelectField label="Sanction" value={kind} options={SANCTION_KINDS} onChange={(value) => setKind(value)} />
        <SelectField
          label="Team"
          value={side}
          options={TEAM_SIDES.map((option) => ({ value: option, label: `Team ${option}` }))}
          onChange={(value) => setSide(value)}
        />
        <label className="field">
          <span className="field-label">Member</span>
          <input value={member} placeholder="Player no. or role" onChange={(event) => setMember(event.target.value)} />
        </label>
        <div className="field">
          <span className="field-label">At score</span>
          <p className="mono">
            {scoreA}:{scoreB} in set {setNumber}
          </p>
        </div>
      </div>
      <div className="button-row">
        <button type="button" className="primary" disabled={!kind || !side} onClick={add}>
          Add sanction
        </button>
      </div>
      {sheet.sanctions.length > 0 && (
        <ul className="list">
          {sheet.sanctions.map((sanction, index) => (
            <li key={index}>
              {sanction.kind} - team {sanction.team} {sanction.member} - set {sanction.set} at {sanction.scoreA}:
              {sanction.scoreB}
              <button
                type="button"
                className="ghost"
                onClick={() => update((draft) => void draft.sanctions.splice(index, 1))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
