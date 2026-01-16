# Security

## Auth & sessions
- Email code login issues an `cc_session` HttpOnly cookie (Pages Functions).
- WebSocket room identity is server-authoritative: the DO issues a session token + playerId.
- Clients cannot claim `playerId` or host status; the DO maps sockets to playerIds.

## Entitlements
- Paid entitlements (Audience Mode) are server-enforced and tied to account records.
- Client UI should only reflect server-provided entitlements.

## Moderation
- Text normalization + blocklist via `shared/moderation.ts`.
- Chat is rate-limited server-side.
- Reports are persisted (D1 for account-level, DO storage for room-level).

## Rate limits
- Chat, vote, and report endpoints have per-connection cooldowns in the DO.
- Additional limits should be enforced at the API layer for auth and payments.

## Webhooks
- All payment/donation webhooks must be verified using HMAC signatures.
- Store raw webhook payloads + verification result for auditing.
