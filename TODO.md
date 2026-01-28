# ClipClash TODO

## Parked / later

### Domain + email (MailChannels)
- [ ] Buy a domain for ClipClash (choose best value + deliverability)
- [ ] Set up MailChannels (SPF/DKIM)
- [ ] Add Pages env vars: `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`
- [ ] Implement actual email delivery in `/api/auth/request` (currently issues a code but does not send it)

### Accounts + owner hardening
- [ ] Finish login flow + create first user
- [ ] Mark `users.is_owner=1` for Edward
- [ ] Lock `/api/owner/*` behind `users.is_owner` (server-side)
- [ ] Hide the "Owner" nav link unless owner

## Next dev work
- [ ] Add `npm run typecheck` (tsc --noEmit) and run in CI
- [ ] Add `.gitignore` for dist/, node_modules/, .DS_Store
- [ ] Break `src/features/room/Room.tsx` into smaller modules/components
- [ ] Fix: game start should not depend on sponsor tables being present (fallback sponsor slot if sponsor tables missing)
