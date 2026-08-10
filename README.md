# Volleyball Scoresheet Assistant

A small static web app that walks you through an international (FIVB-style) volleyball
scoresheet and then shows any box of it on screen, ready to copy onto the paper sheet.
Team, match and player data can be imported from a national federation's API; Swiss
Volley is the first one wired up.

The paper sheet stays the official record. This app just does the bookkeeping so the
service order, rotation, substitution counts and running score are right before you
write them down.

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
- **Show one box at a time** under *Copy*, print-friendly, so you transcribe rather
  than calculate.

Works with or without an API token. Without one, nothing is prefilled and you type the
match details in yourself; the guidance and derivation are identical.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine rules and a UI walkthrough
npm run build      # static output in dist/
```

## Hosting

Any static host works. The GitHub Actions workflow publishes to GitHub Pages when a
`v*` tag is pushed:

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
substitutions and sanctions are always entered here.

Adding another country means writing one adapter: see
[docs/adding-a-federation.md](docs/adding-a-federation.md).

## Layout

```
src/federation/     country-neutral provider interface, registry, Swiss Volley adapter
src/scoresheet/     sheet model, rule sets, scoring engine (no UI imports)
src/ui/             wizard steps, fixture browser, section viewer
```

The engine is pure and covered by tests, so rotation and substitution rules can be
checked without a browser.

## Licence

MIT
