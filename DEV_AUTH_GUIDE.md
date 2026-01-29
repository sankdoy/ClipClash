# Development Mode Authentication Guide

## Overview

Authentication is **fully functional** in development mode without needing to buy a domain or set up email delivery. Auth codes are stored in the database and can be retrieved via a special dev-only endpoint.

## How It Works

1. User requests login → code is generated and stored in DB
2. Code is logged to console and available via `/api/auth/dev-code`
3. User enters code → authentication completes normally
4. When you buy a domain and set `MAIL_FROM_EMAIL`, emails automatically send via MailChannels

## Testing Authentication Flow

### Step 1: Request Login Code

```bash
curl -X POST http://localhost:8788/api/auth/request \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Response:
```json
{"ok":true}
```

Check your terminal/console for output like:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 DEV MODE: Auth code for test@example.com
   Code: 123456
   Retrieve via: GET /api/auth/dev-code?email=test@example.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 2: Retrieve Code (Dev Only)

```bash
curl "http://localhost:8788/api/auth/dev-code?email=test@example.com"
```

Response:
```json
{
  "ok": true,
  "email": "test@example.com",
  "code": "123456",
  "expires_at": "2026-01-29T12:30:00.000Z",
  "note": "DEV MODE: Use this code to complete login. This endpoint will not work in production."
}
```

### Step 3: Verify Login

```bash
curl -X POST http://localhost:8788/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","code":"123456"}'
```

Response:
```json
{
  "ok": true,
  "user": {
    "id": "...",
    "email": "test@example.com",
    "username": "User123",
    "avatar_url": null,
    "is_owner": 0
  }
}
```

The response will include a `Set-Cookie` header with the session token.

### Step 4: Check Session

```bash
curl http://localhost:8788/api/auth/me \
  -H "Cookie: cc_session=YOUR_SESSION_TOKEN"
```

## Making a User an Owner

To test owner functionality, manually update the database:

```bash
# Using wrangler CLI
wrangler d1 execute DB --command="UPDATE users SET is_owner = 1 WHERE email = 'your@email.com'"

# Or via SQL migration
echo "UPDATE users SET is_owner = 1 WHERE email = 'your@email.com';" > temp_owner.sql
wrangler d1 execute DB --file=temp_owner.sql
rm temp_owner.sql
```

After setting `is_owner = 1`:
- User can access `/api/owner/overview`
- "Owner" link appears in navigation header
- Full admin dashboard functionality

## Environment Variables

### Development Mode (Current Setup)
```bash
# No env vars needed - runs in dev mode automatically
# DEV_MODE is implicitly true when MAIL_FROM_EMAIL is not set
```

### Production Mode (When Ready)
```bash
# Set these to enable real email delivery:
MAIL_FROM_EMAIL=noreply@yourdomain.com
MAIL_FROM_NAME=ClipClash

# Optional: Explicitly disable dev mode
DEV_MODE=false
```

## Security Features

✅ Owner endpoints secured with server-side `is_owner` check
✅ Owner nav link hidden for non-owners
✅ Dev code endpoint returns 403 in production
✅ Auth codes expire after 10 minutes
✅ Codes are hashed in database
✅ Plaintext codes only stored when `DEV_MODE=true`

## Migration to Production

When you're ready to launch:

1. **Buy a domain** (~$10-15/year)
2. **Set up MailChannels** (free tier available)
   - Add SPF/DKIM DNS records
   - Verify domain ownership
3. **Set environment variables**
   ```bash
   wrangler pages deployment create \
     --env production \
     --var MAIL_FROM_EMAIL=noreply@yourdomain.com \
     --var MAIL_FROM_NAME=ClipClash
   ```
4. **Deploy** - Email delivery will automatically activate!

No code changes needed - the email service auto-detects production mode.

## Testing the Full Flow in Browser

1. Start dev server: `npm run cf:dev`
2. Navigate to: `http://localhost:8788/account`
3. Enter your email
4. Check terminal for auth code or visit:
   `http://localhost:8788/api/auth/dev-code?email=YOUR_EMAIL`
5. Enter the code in the UI
6. You're logged in!

## Database Schema

Auth codes are stored in two places:

```sql
-- Code hash (always stored)
CREATE TABLE auth_codes (
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  code_plaintext TEXT  -- Only populated in dev mode
);
```

## Troubleshooting

**Problem:** Can't retrieve code via `/api/auth/dev-code`
- **Solution:** Check that code was requested in last 10 minutes (codes expire)

**Problem:** 403 error from `/api/auth/dev-code`
- **Solution:** You're in production mode. Check console logs for code or use real email.

**Problem:** Owner link not showing up
- **Solution:** Run `UPDATE users SET is_owner = 1 WHERE email = 'your@email.com'` and refresh page

**Problem:** Session expires immediately
- **Solution:** Check `sessions.expires_at` in database. Default is 30 days from login.

## Next Steps

- [ ] Run migrations: `wrangler d1 migrations apply DB`
- [ ] Test login flow in browser
- [ ] Mark your account as owner
- [ ] Test owner dashboard access
- [ ] Write E2E tests for auth flow
