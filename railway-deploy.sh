#!/data/data/com.termux/files/usr/bin/bash

# 🚂 Deploy Morgan Wallen Bot to Railway
# FREE hosting with PostgreSQL and Redis included!

echo "🚂 Deploying to Railway..."
echo ""

# Step 1: Install Railway CLI
echo "📦 Installing Railway CLI..."
npm install -g @railway/cli

# Step 2: Login to Railway
echo ""
echo "🔐 Please login to Railway..."
echo "   A browser will open - sign up with GitHub"
railway login

# Step 3: Initialize project
echo ""
echo "🎯 Initializing Railway project..."
cd ~/morgan-wallen-bot

# Create railway.json config
cat > railway.json << 'EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node bot.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
EOF

# Create Procfile (backup)
cat > Procfile << 'EOF'
web: node server.js
bot: node bot.js
EOF

# Step 4: Create new project
echo ""
echo "🆕 Creating Railway project..."
railway init

# Step 5: Add PostgreSQL
echo ""
echo "🐘 Adding PostgreSQL database..."
railway add --plugin postgresql

# Step 6: Add Redis
echo ""
echo "🔴 Adding Redis..."
railway add --plugin redis

# Step 7: Set environment variables
echo ""
echo "⚙️  Setting environment variables..."
echo "   NOTE: Railway will auto-set DATABASE_URL and REDIS_URL"
echo ""

# Get bot token from .env
BOT_TOKEN=$(grep "^BOT_TOKEN=" .env | cut -d'=' -f2)

if [ -n "$BOT_TOKEN" ]; then
    railway variables set BOT_TOKEN="$BOT_TOKEN"
    echo "✅ BOT_TOKEN set"
fi

# Set other variables
railway variables set NODE_ENV=production
railway variables set PORT=3000

echo ""
echo "⚠️  IMPORTANT: Set these in Railway dashboard:"
echo "   - STRIPE_SECRET_KEY"
echo "   - STRIPE_PUBLISHABLE_KEY"
echo "   - SMTP_USER"
echo "   - SMTP_PASS"
echo "   Visit: https://railway.app/project/[your-project]/settings"

# Step 8: Deploy!
echo ""
echo "🚀 Deploying to Railway..."
railway up

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Useful commands:"
echo "   railway logs       - View logs"
echo "   railway status     - Check status"
echo "   railway open       - Open dashboard"
echo "   railway variables  - View variables"
echo ""
echo "🌐 Your bot is now live at Railway!"
echo "   Domain: Check Railway dashboard for URL"
echo ""
