# Owner access

ClipClash uses a single **owner** flag in D1 for privileged access.

## Schema

- `users.is_owner` (INTEGER, 0/1)

Migration: `workers/rooms/migrations/0006_owner.sql`

## Apply migration

Local D1:

```sh
npx wrangler d1 migrations apply <db-name> --local --config workers/rooms/wrangler.toml
```

Remote D1:

```sh
npx wrangler d1 migrations apply <db-name> --config workers/rooms/wrangler.toml
```

## Mark your account as owner

After you've signed in at least once (so you have a row in `users`), run:

```sql
UPDATE users SET is_owner = 1 WHERE email = 'you@example.com';
```

(Or update by `id`.)

## Owner dashboard

- UI: `/owner`
- API: `GET /api/owner/overview`

Both are enforced server-side using `users.is_owner`.
