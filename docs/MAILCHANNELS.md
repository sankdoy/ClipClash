# MailChannels setup (Cloudflare Workers/Pages)

ClipClash uses MailChannels to send email login codes.

## 1) Pick a sender domain

Recommended: use a domain you control (e.g. `clipclash.com`) and send from:

- `noreply@clipclash.com`

Avoid `@gmail.com` as the From: domain. Gmail is not a sending domain for MailChannels.

## 2) Configure DNS for deliverability

In Cloudflare DNS for your sender domain:

### SPF
Add/merge an SPF TXT record that includes MailChannels:

```
v=spf1 include:relay.mailchannels.net ~all
```

If you already have SPF, add `include:relay.mailchannels.net` to the existing record (keep only one SPF record).

### DKIM (recommended)
Set up DKIM for MailChannels (see Cloudflare + MailChannels docs) so mail is less likely to go to spam.

## 3) Configure environment variables

In Cloudflare Pages project → Settings → Variables and Secrets:

- `MAIL_FROM_EMAIL` = `noreply@clipclash.com`
- `MAIL_FROM_NAME` = `ClipClash`

These are used by `/api/auth/request`.

## 4) Deploy

Once the code is deployed, the login flow works:

- POST `/api/auth/request` (sends code)
- POST `/api/auth/verify` (verifies code + creates user)

## Notes

- Codes are valid for 10 minutes.
- If MailChannels fails, the API returns 500 and logs `auth_email_failed` to `event_logs`.
