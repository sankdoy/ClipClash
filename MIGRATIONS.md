# Migrations

Location:
- SQL migrations live in `db/migrations/`
- Seed data lives in `db/seed/`

Local apply (D1):
```
npx wrangler d1 migrations apply <db-name> --local
```

Remote apply (D1):
```
npx wrangler d1 migrations apply <db-name>
```

No seed steps are required for sponsor credits.
