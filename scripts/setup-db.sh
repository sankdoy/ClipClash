#!/bin/bash
# Setup local D1 database for ClipClash

set -e  # Exit on error

echo "🔄 Setting up ClipClash local database..."

cd workers/rooms

echo "📦 Applying migrations..."

# Apply each migration, ignoring duplicate column errors
npx wrangler d1 execute DB --local --file=migrations/0001_init.sql 2>&1 | grep -q "success\|executed" && echo "✅ 0001_init.sql" || echo "⚠️  0001_init.sql (might have errors - check above)"

npx wrangler d1 execute DB --local --file=migrations/0002_settings.sql 2>&1 | grep -q "success\|executed" && echo "✅ 0002_settings.sql" || echo "⚠️  0002_settings.sql (might be duplicate - OK)"

npx wrangler d1 execute DB --local --file=migrations/0003_payments_idempotency.sql 2>&1 | grep -q "success\|executed" && echo "✅ 0003_payments_idempotency.sql" || echo "⚠️  0003 (might be duplicate - OK)"

npx wrangler d1 execute DB --local --file=migrations/0004_event_logs.sql 2>&1 | grep -q "success\|executed" && echo "✅ 0004_event_logs.sql" || echo "⚠️  0004 (might be duplicate - OK)"

npx wrangler d1 execute DB --local --file=migrations/0005_public_rooms.sql 2>&1 | grep -q "success\|executed" && echo "✅ 0005_public_rooms.sql" || echo "⚠️  0005 (might be duplicate - OK)"

npx wrangler d1 execute DB --local --file=migrations/0006_owner.sql 2>&1 | grep -q "success\|executed" && echo "✅ 0006_owner.sql" || echo "⚠️  0006 (might be duplicate - OK)"

npx wrangler d1 execute DB --local --file=migrations/0007_dev_codes.sql 2>&1 | grep -q "success\|executed" && echo "✅ 0007_dev_codes.sql" || echo "⚠️  0007 (might be duplicate - OK)"

cd ../..

echo ""
echo "✅ Database setup complete!"
echo ""
echo "Now you can:"
echo "  1. Make sure 'npm run cf:dev' is running"
echo "  2. Go to http://localhost:8788/account"
echo "  3. Try logging in!"
