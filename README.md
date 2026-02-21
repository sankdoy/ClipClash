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

I'm not telling you how to install
