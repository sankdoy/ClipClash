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

Seed tiers:
```
npx wrangler d1 execute <db-name> --file db/seed/sponsor_tiers.sql
```
