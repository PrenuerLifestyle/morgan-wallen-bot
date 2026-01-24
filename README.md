# 🎸 Morgan Wallen Official Celebrity Assistant Bot

> Production-ready Telegram bot for fan engagement, bookings, VIP experiences, and ticket sales.

[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13+-blue.svg)](https://www.postgresql.org/)
[![Telegram Bot API](https://img.shields.io/badge/Telegram-Bot%20API-blue.svg)](https://core.telegram.org/bots/api)

## 🌟 Features

### For Fans
- ✅ Book exclusive experiences (voice/video calls, meet & greets)
- ✅ VIP memberships (Silver, Gold, Platinum tiers)
- ✅ Concert ticket purchasing
- ✅ Still The Problem Tour 2026 dates
- ✅ Secure Stripe payments
- ✅ Real-time tour updates

### For Management
- ✅ Web admin dashboard
- ✅ Booking management
- ✅ Revenue analytics
- ✅ User management
- ✅ Tour management
- ✅ Broadcast messaging

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- PostgreSQL 13+
- Redis
- Telegram Bot Token

### Installation

1. **Clone repository**
```bash
git clone https://github.com/PrenuerLifestyle/morgan-wallen-bot.git
cd morgan-wallen-bot
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. **Initialize database**
```bash
node init-db.js
```

5. **Create admin user**
```bash
node create-admin.js
```

6. **Start the bot**
```bash
npm start
```

## 📦 Deployment

### Railway (Recommended)
1. Go to https://railway.app
2. Connect your GitHub repository
3. Add PostgreSQL and Redis plugins
4. Set environment variables
5. Deploy!

### Render
1. Go to https://render.com
2. Connect repository
3. Create PostgreSQL and Redis instances
4. Configure environment variables
5. Deploy!

## 🔧 Environment Variables

See `.env.example` for all required variables.

**Required:**
- `BOT_TOKEN` - Telegram bot token from @BotFather
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string

**Optional (for full features):**
- Stripe keys for payments
- SMTP credentials for emails
- Google Calendar API for scheduling
- Zoom API for video calls

## 📁 Project Structure

```
morgan-wallen-bot/
├── bot.js              # Main bot application
├── server.js           # Web server & API
├── init-db.js          # Database initialization
├── create-admin.js     # Admin user setup
├── package.json        # Dependencies
├── .env.example        # Environment template
├── public/
│   ├── index.html      # Tour website
│   └── admin.html      # Admin dashboard
└── scripts/            # Utility scripts
```

## 🎯 Bot Commands

### User Commands
- `/start` - Main menu
- `/tour` - View all tour dates
- `/nextshow` - Next upcoming show
- `/cityshows` - Find shows by city
- `/mybookings` - View bookings
- `/membership` - Membership info

### Admin Commands
- `/admin` - Admin dashboard
- `/stats` - View statistics
- `/broadcast` - Send announcement

## 🌐 Tour Dates

Still The Problem Tour 2026:
- 21 Stadium Shows
- 11 Cities
- April - August 2026
- Special guests: Brooks & Dunn, Thomas Rhett, HARDY, Ella Langley, and more!

## 📊 Tech Stack

- **Bot Framework:** Telegraf 4.x
- **Runtime:** Node.js 16+
- **Database:** PostgreSQL 13+
- **Cache/Queue:** Redis + Bull
- **Payments:** Stripe API
- **Email:** Nodemailer
- **Calendar:** Google Calendar API
- **Video Calls:** Zoom API

## 🔐 Security

- PCI-compliant payment processing
- Encrypted database connections
- JWT authentication
- SQL injection protection
- Rate limiting
- Webhook signature verification

## 📝 License

MIT License - See LICENSE file

## 🆘 Support

For issues or questions, please open an issue on GitHub.

---

**Built with ❤️ for Morgan Wallen fans worldwide** 🎸
