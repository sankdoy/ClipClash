# ClipClash Architecture

This repo has three runtimes that must stay isolated:

- Frontend (React + Vite): `src/`
- Pages Functions (HTTP APIs): `functions/`
- Durable Object worker (real-time rooms): `workers/rooms/`

Shared code:

- Cross-runtime helpers: `shared/`
- Shared types: `src/types/` (allowed to be imported by `functions/` and `workers/rooms/`)

## Runtime boundaries

- `functions/**` must not import UI code from `src/` (except `src/types`).
- `workers/**` must not import UI code from `src/` (except `src/types`).
- Browser-only modules stay in `src/`.

To guard this, run:

```
node scripts/check-boundaries.mjs
```

## Deploy units (high level)

- Frontend build output: `dist/` (static assets).
- Pages Functions: `functions/` (HTTP handlers).
- Durable Object: `workers/rooms/` (WebSocket room state + D1 access).

## Source of truth

- Room state: in-memory in the Durable Object (`workers/rooms/src/index.ts`) with periodic persistence.
- User identity/session: cookie auth resolved in Pages Functions and passed to the DO on connect.
- Entitlements/donations: stored in D1 via Functions/Worker queries.
