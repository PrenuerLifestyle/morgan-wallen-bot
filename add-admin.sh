#!/bin/bash
echo "🔐 Enter your Telegram ID (from @userinfobot):"
read TELEGRAM_ID
node -e "require('dotenv').config(); const {Pool} = require('pg'); const pool = new Pool({connectionString: process.env.DATABASE_URL}); pool.query('INSERT INTO admins (telegram_id, role) VALUES (\$1, \$2) ON CONFLICT DO NOTHING', [$TELEGRAM_ID, 'admin'], (err) => { console.log(err ? '❌ Error: ' + err.message : '✅ Admin added! ID: $TELEGRAM_ID'); pool.end(); });"
