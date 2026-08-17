# Reporting a result

The paper sheet is the official record and stays with the referee. The score still
has to reach the federation, and no federation this app talks to accepts a
scoresheet over its API. That constraint shapes the last step of the app.

## Swiss Volley

`api.volleyball.ch` is read-only. Every documented resource is a `GET` over
fixtures, teams, squads, leagues, phases and groups; there is no endpoint that
takes a result, a set score or a scoresheet. Nothing in the adapter
(`src/federation/swiss/`) writes.

Results reach Swiss Volley two ways, neither of which is the public API:

- **NLA and NLB** use the Genius Sports **eScoresheet**. The eScorer uploads the
  finished sheet to the Genius server under the referee's supervision, and the
  PDF goes into Volley Manager afterwards. Access is granted per accredited
  eScorer, not per club token.
- **Every other league** enters the result by hand in **Volley Manager**, normally
  the home team's team manager, and the referee reconciles it against the paper
  sheet.

So an app holding a club API token has no route to file a result, and adding one
would mean either becoming an accredited eScoresheet product or automating a login
to Volley Manager. Both are out of scope for a static page with no backend.

## What the app does instead

`capabilities.submitResult` is `false` on every provider, and the transfer wizard
treats that as the normal case rather than an error. Its last step:

- says plainly that the federation takes no submission, naming the provider;
- renders the result in the shape a result form asks for (match number, date,
  competition, both team names, set scores with durations, sets won, total points,
  winner) with one button to copy it;
- links to `resultPortalUrl`, where a human files it;
- lists the checks worth doing before the sheet is handed over.

## Adding a federation that does accept submissions

If one ever appears, set `capabilities.submitResult: true` and add the submit call
to the provider. The wizard's last step is the only place that has to change; the
summary text is already derived by `resultSummary` in
`src/scoresheet/summary.ts` and can be posted instead of copied.
