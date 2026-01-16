# Deployment

This repo contains a Cloudflare Pages app plus a separate Durable Objects worker.

## Pages app
- Build command: `npm run build`
- Output directory: `dist`
- Functions directory: `functions/`

### D1 bindings (Pages)
Create a D1 database and bind it to the Pages project as `DB`.

Example (local):
```
wrangler d1 create clipclash
wrangler d1 execute clipclash --file workers/rooms/migrations/0001_init.sql
```

In Pages dashboard:
- Settings → Functions → D1 Database Bindings
- Binding name: `DB`
- Database: `clipclash`

## Durable Objects worker
The realtime worker lives in `workers/rooms/`.

Deploy:
```
wrangler deploy --config workers/rooms/wrangler.toml
```

Bind the worker to Pages:
- Binding name: `ROOMS_DO`
- Class: `RoomsDO`

### D1 bindings (DO worker)
The DO worker can also use D1 for stats. Update `workers/rooms/wrangler.toml`:
- `database_name = "clipclash"`
- `database_id = "<your D1 id>"`

## Local dev
- Pages dev: `npm run dev`
- DO worker dev: `npx wrangler dev --config workers/rooms/wrangler.toml`

## Webhooks
Payment and donation webhooks should be verified server-side. Add a secret via environment variables when implemented.
