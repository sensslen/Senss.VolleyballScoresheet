# Adding a federation

One country means one adapter. The app never branches on country: it talks to
`FederationProvider` and hides whatever a provider does not advertise.

## 1. Map the federation onto the neutral vocabulary

`src/federation/types.ts` defines the only hierarchy the UI knows:

| Neutral      | Swiss Volley | Typical alternatives              |
| ------------ | ------------ | --------------------------------- |
| Region       | region       | district, province, association   |
| Competition  | league       | division, series                  |
| Stage        | phase        | round, qualification, playoffs     |
| Pool         | group        | conference, bracket               |

Anything the federation does not have is simply left unimplemented.

## 2. Write the adapter

```
src/federation/<country>/
  api.ts        raw HTTP client plus the DTOs, no domain types
  provider.ts   FederationProvider implementation, DTO -> neutral mapping
```

Keep the split: `api.ts` mirrors the wire format, `provider.ts` owns the translation.
That way a wire change stays in one file.

```ts
export function createExampleProvider(): FederationProvider {
  const api = new ExampleApi(() => credentials.get(PROVIDER_ID))

  return {
    id: 'example-volley',
    name: 'Example Volley',
    country: { code: 'XX', name: 'Example', flag: '🏐' },
    capabilities: {
      browseCompetitions: true,
      browseGames: true,
      gameDetail: true,
      rosters: false,   // no squad endpoint: the UI stops offering roster import
      officials: true,
      regions: false,
      seasons: false,
    },
    auth: { label: 'API key', required: true, helpText: 'Where a club gets one.' },
    isReady: () => api.hasToken(),
    listCompetitions: async () => /* ... */,
    listGames: async (query) => /* ... */,
    getGame: async (id) => /* ... */,
  }
}
```

Rules that matter:

- **HTTPS only.** The app is served over HTTPS and browsers drop plain-HTTP requests
  from it, so every endpoint (and any URL handed to the UI) must be `https://`.
- **CORS decides feasibility.** The browser calls the API directly. The federation must
  send `Access-Control-Allow-Origin` and allow whichever auth header it needs. If it
  does not, a static page cannot reach it: either the federation adds the header or the
  adapter needs a proxy, which is outside this app.
- **Credentials go through `credentials`** (`src/federation/credentials.ts`), which
  keeps them in local storage. Never commit a token or bake one into a build.
- **Advertise honestly in `capabilities`.** A false flag hides a feature; a wrong true
  flag shows a control that then fails.
- **Do not throw for missing features.** Leave the method undefined instead.
- **Set `setsToWin` on `GameDetail`** when the federation publishes the match format.
  `ruleSetForSetsToWin` turns it into the right set targets, so best-of-3 competitions
  score correctly without user input.

## 3. Register it

```ts
// src/federation/registry.ts
const providers: FederationProvider[] = [manualProvider, createSwissVolleyProvider(), createExampleProvider()]
```

That is the whole wiring. The country appears in Settings, and the fixture browser
adapts to the capabilities it declared.

## 4. Check it

- `npm test` for the engine and the UI walkthrough, which are provider-independent.
- Add tests for the mapping if the DTOs need real interpretation (nested translations,
  enum-ish strings, referee slots keyed by number).
- Exercise the live API once with a real token: capability flags are easy to get wrong
  in a way types cannot catch.

## Scoresheet variants

Set targets, substitution counts and whether a libero may serve are data in
`src/scoresheet/rules.ts`, not code paths. If a country plays a different format, add a
`RuleSet` there and return it from the adapter rather than special-casing the engine.
