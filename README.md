# ClipClash

ClipClash (clipclash.com) — a social voting game where players submit and vote on TikTok videos across fun categories.

Short summary: Players (3–10) join public or private rooms, vote on a time limit, paste TikTok links into category slots during a timed submission phase, then vote anonymously on winners. Rounds include intermissions, tie-breakers via rock-paper-scissors, and a persistent chat. One sponsor slot per game is available.

Tech stack (current)
- Vite + React + TypeScript
- Cloudflare Pages Functions for minimal API endpoints

Tech stack (realtime)
- Durable Objects + WebSockets for realtime rooms/state. Durable Objects are deployed as a separate Worker and then bound into Pages via dashboard or Wrangler.

Game flow
- Players: 3–10
- Lobby types: public + private rooms
- Flow:
  A) Players join a room and see a list of categories (examples: cutest, funniest, randomest, most satisfying, cringiest, most out of pocket, most boring, weirdest)
  B) Time selection vote: default 10 minutes; players vote higher/lower; every 5 seconds, if ≥80% agree higher/lower then +/- 1 minute, otherwise keep
  C) During timer, players paste TikTok links into the site under each category
  D) When time ends: 30s intermission + chat stays open
  E) Rounds: a category is chosen, submissions are anonymised (TikTok 1, 2, 3…)
  F) Players vote for best match; winner revealed
  G) Tie-break: rock-paper-scissors with a clean UI
  H) Missing link handling: show “no submission” and skip quickly

Chat is open throughout. Ads: one sponsor slot per game (not per round), no popups; if unfilled show “Buy a slot” link placeholder.

Safety note: TikTok links only; no scraping. Embedding/preview may be limited by TikTok policies.

Local dev
1. Install
```
npm install
```
2. Run dev server
```
npm run dev
```
3. Build
```
npm run build
```
4. Preview
```
npm run preview
```
5. Cloudflare Pages local dev (requires Wrangler)
```
npm run cf:dev
```

Cloudflare Pages setup
- Connect the repository in the Pages dashboard
- Build command: `npm run build`
- Output directory: `dist`
- Pages Functions are served from `/functions` and are file-based routed

Durable Objects worker (rooms)
- Worker config: `workers/rooms/wrangler.toml`
- Local dev:
```
npx wrangler dev --config workers/rooms/wrangler.toml
```
- Bind the worker to Pages as a separate deployment (Dashboard or Wrangler).

Roadmap (short checklist)
- [x] MVP + V1 features (rooms, realtime, chat, submissions, voting, results, tiebreak, sponsor slot, moderation basics, persistence)
- [ ] V2 Milestone 1: DB + accounts + leaderboard + baseline moderation
- [ ] V2 Milestone 2: Themes (dark mode + style packs)
- [ ] V2 Milestone 3: Host custom categories
- [ ] V2 Milestone 4: Payments & audience entitlements
- [ ] V2 Milestone 5: Audience experience
- [ ] V2 Milestone 6: Unique codes + lifecycle
- [ ] V2 Milestone 7: Donate page + webhook persistence

Docs
- Deployment: `docs/DEPLOYMENT.md`
- Security & moderation: `docs/SECURITY.md`

Feature flags (env)
- `SPONSORS_ENABLED=true`
- `PAYMENTS_ENABLED=false`

Contributing
- PRs welcome. Please follow code style (Prettier) and provide a short description of changes.
