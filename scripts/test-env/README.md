# Local Multiplayer Test Env Helper

Generate local room codes and player URLs for quick multiplayer testing.

## Usage

From the repo root:

```bash
node scripts/test-env/generate-test-env.mjs --rooms 2 --players 3 --app-url http://localhost:5173
```

### Options

- `--rooms` number of rooms to create (default: 1)
- `--players` players per room:
  - single number applies to all rooms (e.g. `--players 4`)
  - comma list for per-room counts (e.g. `--players 2,3,5`)
- `--app-url` base URL for your frontend (default: `http://localhost:5173`)

## Notes

- Open each player URL in its own browser window or profile.
- The `player` query param is just a label and is ignored by the app.
