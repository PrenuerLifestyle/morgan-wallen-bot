#!/data/data/com.termux/files/usr/bin/bash

echo "🚀 Starting Morgan Wallen Bot..."

# Check PostgreSQL
if ! pg_ctl status -D $PREFIX/var/lib/postgresql | grep -q "server is running"; then
    echo "🔄 Starting PostgreSQL..."
    pg_ctl -D $PREFIX/var/lib/postgresql start
    sleep 2
fi

echo "✅ PostgreSQL running"

# Start bot
echo "🤖 Starting bot..."
node bot.js
