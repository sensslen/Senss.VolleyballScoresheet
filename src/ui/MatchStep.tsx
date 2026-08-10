import type { Scoresheet } from '../scoresheet/model'
import { RULE_SETS, ruleSetById } from '../scoresheet/rules'
import { Card, SelectField, TextField } from './components'
import type { SheetUpdater } from './updater'

export function MatchStep({ sheet, update }: { sheet: Scoresheet; update: SheetUpdater }) {
  const header = sheet.header
  const officials = sheet.officials

  return (
    <>
      <Card title="Match header" subtitle="The top band of the scoresheet.">
        <div className="grid grid-3">
          <TextField
            label="Competition"
            value={header.competition}
            onChange={(value) => update((draft) => void (draft.header.competition = value))}
          />
          <TextField
            label="Stage / round"
            value={header.stage}
            onChange={(value) => update((draft) => void (draft.header.stage = value))}
          />
          <TextField
            label="Pool / group"
            value={header.pool}
            onChange={(value) => update((draft) => void (draft.header.pool = value))}
          />
          <TextField
            label="Match number"
            value={header.matchNumber}
            onChange={(value) => update((draft) => void (draft.header.matchNumber = value))}
          />
          <TextField
            label="Category"
            value={header.category}
            onChange={(value) => update((draft) => void (draft.header.category = value))}
            placeholder="Women / Men / U19"
          />
          <TextField
            label="Date"
            type="date"
            value={header.date}
            onChange={(value) => update((draft) => void (draft.header.date = value))}
          />
          <TextField
            label="Start time"
            type="time"
            value={header.time}
            onChange={(value) => update((draft) => void (draft.header.time = value))}
          />
          <TextField
            label="Hall"
            value={header.hall}
            onChange={(value) => update((draft) => void (draft.header.hall = value))}
          />
          <TextField
            label="City"
            value={header.city}
            onChange={(value) => update((draft) => void (draft.header.city = value))}
          />
        </div>
      </Card>

      <Card title="Rules" subtitle="Drives set targets, substitution and time-out limits.">
        <div className="grid grid-3">
          <SelectField
            label="Rule set"
            value={sheet.rules.id}
            options={
              RULE_SETS.some((rules) => rules.id === sheet.rules.id)
                ? RULE_SETS.map((rules) => ({ value: rules.id, label: rules.name }))
                : [
                    { value: sheet.rules.id, label: `${sheet.rules.name} (from federation)` },
                    ...RULE_SETS.map((rules) => ({ value: rules.id, label: rules.name })),
                  ]
            }
            onChange={(value) =>
              update((draft) => {
                if (value) draft.rules = ruleSetById(value)
              })
            }
            placeholder={sheet.rules.name}
          />
          <p className="muted">
            Best of {sheet.rules.setsToWin * 2 - 1}, sets to {sheet.rules.pointsPerSet}, deciding set to{' '}
            {sheet.rules.pointsDecidingSet}, {sheet.rules.substitutionsPerSet} substitutions and{' '}
            {sheet.rules.timeoutsPerSet} time-outs per set.
          </p>
        </div>
      </Card>

      <Card title="Officials">
        <div className="grid grid-3">
          <TextField
            label="1st referee"
            value={officials.firstReferee}
            onChange={(value) => update((draft) => void (draft.officials.firstReferee = value))}
          />
          <TextField
            label="2nd referee"
            value={officials.secondReferee}
            onChange={(value) => update((draft) => void (draft.officials.secondReferee = value))}
          />
          <TextField
            label="Scorer"
            value={officials.scorer}
            onChange={(value) => update((draft) => void (draft.officials.scorer = value))}
          />
          <TextField
            label="Assistant scorer"
            value={officials.assistantScorer}
            onChange={(value) => update((draft) => void (draft.officials.assistantScorer = value))}
          />
          <TextField
            label="Line judges"
            value={officials.lineJudges}
            onChange={(value) => update((draft) => void (draft.officials.lineJudges = value))}
          />
        </div>
      </Card>
    </>
  )
}
