#!/bin/bash
# Setup local D1 database for ClipClash

set -e  # Exit on error

echo "🔄 Setting up ClipClash local database..."
echo "📦 Applying migrations from root directory..."

# Run from root directory - this is KEY for wrangler pages dev to see the DB!
npx wrangler d1 execute DB --local --file=workers/rooms/migrations/0001_init.sql 2>&1 | grep -q "success\|executed" && echo "✅ 0001_init.sql" || echo "⚠️  0001_init.sql"

npx wrangler d1 execute DB --local --file=workers/rooms/migrations/0002_settings.sql 2>&1 | grep -q "success\|executed" && echo "✅ 0002_settings.sql" || echo "⚠️  0002_settings.sql"

npx wrangler d1 execute DB --local --file=workers/rooms/migrations/0003_payments_idempotency.sql 2>&1 | grep -q "success\|executed" && echo "✅ 0003_payments_idempotency.sql" || echo "⚠️  0003"

npx wrangler d1 execute DB --local --file=workers/rooms/migrations/0004_event_logs.sql 2>&1 | grep -q "success\|executed" && echo "✅ 0004_event_logs.sql" || echo "⚠️  0004"

npx wrangler d1 execute DB --local --file=workers/rooms/migrations/0005_public_rooms.sql 2>&1 | grep -q "success\|executed" && echo "✅ 0005_public_rooms.sql" || echo "⚠️  0005"

npx wrangler d1 execute DB --local --file=workers/rooms/migrations/0006_owner.sql 2>&1 | grep -q "success\|executed" && echo "✅ 0006_owner.sql" || echo "⚠️  0006"

npx wrangler d1 execute DB --local --file=workers/rooms/migrations/0007_dev_codes.sql 2>&1 | grep -q "success\|executed" && echo "✅ 0007_dev_codes.sql" || echo "⚠️  0007"

echo ""
echo "✅ Database setup complete!"
echo ""
echo "Now you can:"
echo "  1. Make sure 'npm run cf:dev' is running"
echo "  2. Go to http://localhost:8788/account"
echo "  3. Try logging in!"
echo ""
echo "💡 Tip: Check the terminal where cf:dev is running for your auth code!"
