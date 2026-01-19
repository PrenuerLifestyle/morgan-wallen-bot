#!/usr/bin/env bash
set -e

echo "🎸 Morgan Wallen Celebrity Bot – Automated Setup"

# Check Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js not found. Install Node.js 16+ first."
  exit 1
fi

# Init project if needed
if [ ! -f package.json ]; then
  echo "📦 Initializing Node project..."
  npm init -y
fi

echo "📦 Installing dependencies..."
npm install telegraf express pg stripe dotenv

# Create .env
if [ ! -f .env ]; then
  echo "🔐 Creating .env file..."
  read -p "Telegram BOT TOKEN: " BOT_TOKEN
  read -p "PostgreSQL DATABASE_URL: " DATABASE_URL
  read -p "Stripe SECRET KEY: " STRIPE_SECRET_KEY
  read -p "Stripe WEBHOOK SECRET: " STRIPE_WEBHOOK_SECRET

cat > .env <<EOF
BOT_TOKEN=$BOT_TOKEN
DATABASE_URL=$DATABASE_URL
STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET
PORT=3000
NODE_ENV=development
EOF
fi

echo "🗄️ Initializing database..."
node <<'EOF'
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE,
      username TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE,
      role TEXT DEFAULT 'admin'
    );

    CREATE TABLE IF NOT EXISTS tours (
      id SERIAL PRIMARY KEY,
      city TEXT,
      venue TEXT,
      date TIMESTAMP,
      tickets_available INT,
      ticket_price NUMERIC,
      status TEXT
    );
  `);
  console.log("✅ Database ready");
  await pool.end();
})();
EOF

echo "🚀 Starting bot..."
node bot.js
