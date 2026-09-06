# Volleyball Scoresheet Assistant

A small static web app that walks you through an international (FIVB-style) volleyball
scoresheet and then shows any box of it on screen, ready to copy onto the paper sheet.
Team, match and player data can be imported from a national federation's API; Swiss
Volley is the first one wired up.

The paper sheet stays the official record. This app just does the bookkeeping so the
service order, rotation, substitution counts and running score are right before you
write them down.

The published app lives at
<https://sensslen.github.io/Senss.VolleyballScoresheet/>.

## What it does

- **Browse fixtures** down a federation's hierarchy (region, competition, stage, pool)
  and pick the match you are scoring.
- **Prefill** the header, both team names, referees and venue from the fixture, and
  pull both squads with shirt numbers.
- **Guide the sheet** step by step: header and officials, rosters with captain and
  liberos, the toss, starting lineups per set, then rally-by-rally entry with time-outs,
  substitutions and sanctions.
- **Derive what the sheet needs**: running score, which team serves, the serving
  player's number for every service round, rotation after each side-out, substitution
  legality, set and match completion.
- **Walk the transfer** under *Transfer*: a wizard that steps through every box of the
  paper sheet in the order a scorer fills it, says what goes in that box, shows the
  derived values, and remembers which boxes you have already copied. The last step
  hands you the result summary to file with the federation.
- **Speak the reader's language**: eleven of them, picked in Settings or from the
  browser.

Works with or without an API token. Without one, nothing is prefilled and you type the
match details in yourself; the guidance and derivation are identical.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine rules, catalogue completeness and a UI walkthrough
npm run lint       # eslint, including the react-hooks and react-compiler rules
npm run build      # static output in dist/
```

## Hosting

Any static host works. The GitHub Actions workflow publishes to
<https://sensslen.github.io/Senss.VolleyballScoresheet/> when a `v*` tag is pushed:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

`vite.config.ts` defaults the base path to `/Senss.VolleyballScoresheet/`; the workflow
overrides it with the repository name via `BASE_PATH`.

## Federation data

Requests go straight from the browser to the federation API over HTTPS, so a token you
enter is stored in that browser's local storage and sent nowhere else. There is no
backend. A club administrator generates a Swiss Volley token in Volley Manager under
*Administration > Club > Webservice/API*.

Swiss Volley publishes fixtures, teams and squads but not a match log, so points,
substitutions and sanctions are always entered here. Its API is read-only, so the
finished result cannot be filed from the app either: see
[docs/reporting-a-result.md](docs/reporting-a-result.md) for what the transfer wizard
does about that.

Adding another country means writing one adapter: see
[docs/adding-a-federation.md](docs/adding-a-federation.md).

## Layout

```
locales/            one JSON catalogue per language, en.json is the source of truth
src/federation/     country-neutral provider interface, registry, Swiss Volley adapter
src/scoresheet/     sheet model, rule sets, scoring engine, sections (no UI imports)
src/ui/             wizard steps, fixture browser, transfer wizard
```

The engine is pure and covered by tests, so rotation and substitution rules can be
checked without a browser. It reports rule problems as translation keys rather than
sentences, which is what keeps it free of UI and language.

Styling is Tailwind; a small set of component classes in `src/styles.css` keeps the
markup readable. Translation is i18next, documented in
[docs/translating.md](docs/translating.md).

## Licence

MIT
