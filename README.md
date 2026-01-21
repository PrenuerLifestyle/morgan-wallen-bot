# 🎸 Morgan Wallen Official Celebrity Assistant Bot

> A comprehensive, production-ready Telegram bot for celebrity fan engagement, booking management, ticket sales, and VIP experiences.

[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13+-blue.svg)](https://www.postgresql.org/)
[![Telegram Bot API](https://img.shields.io/badge/Telegram-Bot%20API-blue.svg)](https://core.telegram.org/bots/api)
[![Stripe](https://img.shields.io/badge/Stripe-Payments-blueviolet.svg)](https://stripe.com/)

---

## 🌟 Features

### For Fans
- ✅ **Book Exclusive Experiences** - Voice calls, video calls, meet & greets
- ✅ **VIP Memberships** - Silver, Gold, Platinum tiers with exclusive perks
- ✅ **Concert Tickets** - Easy ticket purchasing with member discounts
- ✅ **Tour Updates** - Real-time notifications for new tour dates
- ✅ **Official Merchandise** - Integrated merch store with member pricing
- ✅ **Secure Payments** - Stripe integration for safe transactions
- ✅ **Support System** - Direct access to management team

### For Management
- ✅ **Admin Dashboard** - Complete control panel
- ✅ **Booking Management** - Approve/reject bookings
- ✅ **Revenue Analytics** - Real-time financial reports
- ✅ **User Analytics** - Engagement metrics and insights
- ✅ **Broadcast System** - Send announcements to specific audiences
- ✅ **Tour Management** - Add/edit tour dates
- ✅ **Calendar Integration** - Auto-sync with Google Calendar
- ✅ **Email Notifications** - Automated confirmations
- ✅ **Video Call Integration** - Zoom meeting generation

### Technical Features
- ✅ **Secure Database** - PostgreSQL with encrypted data
- ✅ **Job Queue System** - Bull/Redis for background tasks
- ✅ **Email System** - Nodemailer SMTP integration
- ✅ **Payment Processing** - Stripe with webhook support
- ✅ **Calendar Sync** - Google Calendar API
- ✅ **Video Conferencing** - Zoom API integration
- ✅ **Scheduled Tasks** - Automated reminders and notifications
- ✅ **Anti-Fraud** - Verified bot prevents impersonation
- ✅ **Scalable Architecture** - Ready for thousands of users

---

## 🚀 Quick Start (3 Steps!)

### Step 1: Clone & Install
```bash
git clone https://github.com/yourorg/morgan-wallen-bot.git
cd morgan-wallen-bot
npm install
```

### Step 2: Configure Bot
1. **Create bot on Telegram**:
   - Message `@BotFather` on Telegram
   - Send `/newbot`
   - Follow prompts
   - Copy your bot token

2. **Set up environment**:
```bash
cp .env.example .env
# Edit .env with your credentials
```

3. **Set up database** (Railway recommended - FREE):
   - Visit https://railway.app
   - Create PostgreSQL database
   - Copy connection URL to `.env`

### Step 3: Deploy

**Option A: Automatic (Recommended)**
```bash
chmod +x deploy.sh
./deploy.sh
# Choose option 1 for local or 2 for Railway
```

**Option B: Manual**
```bash
npm start
```

✅ **Done!** Search for your bot in Telegram and send `/start`

---

## 📖 Complete Setup Guide

For detailed instructions, see:
- **[BotFather Setup Guide](docs/botfather-setup.md)** - Step-by-step bot creation
- **[Environment Configuration](docs/environment-setup.md)** - All integrations
- **[Deployment Guide](docs/deployment.md)** - Railway, Heroku, VPS options

---

## 🎯 Core User Journey

```
User Opens Bot → /start
    ↓
Main Menu
    ↓
    ├─→ 📅 Book Experience
    │       ↓
    │   Select Type (Voice/Video/Meet & Greet)
    │       ↓
    │   Choose Date & Time
    │       ↓
    │   Payment via Stripe
    │       ↓
    │   ✅ Confirmation + Calendar Invite + Zoom Link
    │
    ├─→ 💎 Membership
    │       ↓
    │   Choose Tier (Silver/Gold/Platinum)
    │       ↓
    │   Subscribe via Stripe
    │       ↓
    │   ✅ Instant VIP Access + Discounts
    │
    ├─→ 🎫 Tickets
    │       ↓
    │   Browse Tour Dates
    │       ↓
    │   Select Show
    │       ↓
    │   Purchase Tickets
    │       ↓
    │   ✅ QR Code + Email Confirmation
    │
    └─→ 👤 My Profile
            ↓
        View Bookings, Stats, Membership
```

---

## 🔧 Tech Stack

| Component | Technology |
|-----------|-----------|
| **Bot Framework** | Telegraf 4.x |
| **Runtime** | Node.js 16+ |
| **Database** | PostgreSQL 13+ |
| **Cache/Queue** | Redis + Bull |
| **Payments** | Stripe API |
| **Email** | Nodemailer (SMTP) |
| **Calendar** | Google Calendar API |
| **Video Calls** | Zoom API |
| **Hosting** | Railway / Heroku / VPS |
| **Process Manager** | PM2 |

---

## 📁 Project Structure

```
morgan-wallen-bot/
├── bot.js                 # Main bot application
├── package.json           # Dependencies
├── .env                   # Environment configuration
├── .gitignore            # Git ignore rules
├── deploy.sh             # Deployment script
├── README.md             # This file
│
├── scripts/
│   ├── init-db.js        # Database initialization
│   ├── seed-db.js        # Sample data seeder
│   └── backup-db.js      # Database backup
│
├── public/
│   ├── index.html        # Landing page
│   └── admin/            # Web admin dashboard
│
├── docs/
│   ├── botfather-setup.md
│   ├── environment-setup.md
│   └── deployment.md
│
├── backups/              # Database backups
└── logs/                 # Application logs
```

---

## 🎮 Bot Commands

### User Commands
- `/start` - Main menu
- `/mybookings` - View all bookings
- `/membership` - Membership info
- `/support` - Contact support

### Admin Commands (Restricted)
- `/admin` - Admin dashboard
- `/stats` - View statistics
- `/addtour City|Venue|Date|Price|Tickets` - Add tour
- `/broadcast` - Send announcement

---

## 💰 Pricing Configuration

Edit in `bot.js`:

```javascript
const MEMBERSHIP_TIERS = {
  silver: { name: 'Silver', price: 9.99, discount: 0.05 },
  gold: { name: 'Gold', price: 29.99, discount: 0.10 },
  platinum: { name: 'Platinum', price: 99.99, discount: 0.20 }
};

const BOOKING_TYPES = {
  voice_call: { name: '📞 Voice Call', price: 199.99, duration: 15 },
  video_call: { name: '📹 Video Call', price: 499.99, duration: 10 },
  meet_greet: { name: '🤝 Meet & Greet', price: 299.99, duration: 30 }
};
```

---

## 🔐 Security Features

- ✅ **Verified Bot** - Official Telegram verification prevents impersonation
- ✅ **Secure Payments** - PCI-compliant Stripe integration
- ✅ **Encrypted Database** - SSL connections enforced
- ✅ **Admin Authentication** - Role-based access control
- ✅ **Webhook Verification** - Stripe signature validation
- ✅ **Rate Limiting** - Prevents abuse
- ✅ **Input Validation** - SQL injection protection
- ✅ **HTTPS Only** - Secure communication

---

## 📊 Admin Dashboard Features

### Real-Time Analytics
- Total users & active users
- Booking statistics
- Revenue tracking
- Conversion rates
- User engagement metrics

### Booking Management
- View pending bookings
- Approve/reject requests
- Auto-generate meeting links
- Send confirmations

### Tour Management
- Add/edit tour dates
- Track ticket sales
- Inventory management
- Revenue per show

### User Management
- View user profiles
- Membership status
- Purchase history
- Support tickets

---

## 🌐 Deployment Options

### Option 1: Railway (Easiest - FREE tier available)
```bash
railway login
railway init
railway up
```
**Pros:** Auto-scaling, free PostgreSQL, Redis included, easy setup  
**Best for:** Quick deployment, testing, small-medium scale

### Option 2: Heroku
```bash
heroku create
heroku addons:create heroku-postgresql
git push heroku main
```
**Pros:** Well-documented, easy add-ons, reliable  
**Best for:** Established production apps

### Option 3: VPS (DigitalOcean, AWS, etc.)
```bash
# Full control, custom configuration
ssh root@your-server
# Follow deployment guide
```
**Pros:** Full control, cost-effective at scale  
**Best for:** Large scale, custom requirements

---

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Manual Testing Checklist
- [ ] Bot responds to `/start`
- [ ] Booking flow completes
- [ ] Payment processes successfully
- [ ] Confirmation emails sent
- [ ] Calendar events created
- [ ] Admin commands work
- [ ] Stripe webhooks trigger correctly

### Test Cards (Stripe Test Mode)
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

---

## 📈 Scaling Considerations

### For 1,000+ Users
- ✅ Current setup handles well
- ✅ Redis caching enabled
- ✅ Connection pooling configured

### For 10,000+ Users
- Consider: Multiple bot instances
- Add: Load balancer
- Upgrade: Database tier
- Implement: CDN for media

### For 100,000+ Users
- Switch to: Kubernetes cluster
- Add: Message queue clustering
- Implement: Database read replicas
- Consider: Microservices architecture

---

## 🐛 Troubleshooting

### Bot Not Responding
```bash
# Check logs
railway logs
# or
pm2 logs morgan-wallen-bot

# Verify token
curl https://api.telegram.org/bot<TOKEN>/getMe
```

### Database Connection Failed
```bash
# Test connection
psql $DATABASE_URL

# Check SSL requirement
# Add ?sslmode=require to DATABASE_URL
```

### Payment Webhook Not Working
```bash
# Test locally
stripe listen --forward-to localhost:3000/webhook/stripe

# Verify endpoint in Stripe dashboard
```

### Email Not Sending
```bash
# Test SMTP
node -e "
const nodemailer = require('nodemailer');
const transport = nodemailer.createTransport({...});
transport.verify((err) => console.log(err ? 'Failed' : 'OK'));
"
```

---

## 🔄 Maintenance

### Daily Backups (Automated)
```bash
# Runs automatically via cron
0 2 * * * /path/to/backup-script.sh
```

### Update Dependencies
```bash
npm update
npm audit fix
```

### Monitor Health
```bash
# Check bot status
railway logs | grep "Bot started"

# Check database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

---

## 📞 Support & Community

- **Documentation**: [Full Docs](docs/)
- **Issues**: [GitHub Issues](https://github.com/yourorg/morgan-wallen-bot/issues)
- **Telegram API**: https://core.telegram.org/bots/api
- **Stripe Docs**: https://stripe.com/docs

---

## 📝 License

MIT License - See [LICENSE](LICENSE) file

---

## 🙏 Credits

Built with:
- [Telegraf](https://telegraf.js.org/) - Telegram Bot Framework
- [Stripe](https://stripe.com/) - Payment Processing
- [PostgreSQL](https://www.postgresql.org/) - Database
- [Bull](https://github.com/OptimalBits/bull) - Job Queue

---

## 🎯 Roadmap

- [ ] Mobile app (React Native)
- [ ] Voice messages support
- [ ] AI chatbot integration
- [ ] Multi-language support
- [ ] NFT ticketing
- [ ] Live streaming integration
- [ ] Fan voting/polls
- [ ] Loyalty rewards program

---

**🎸 Ready to rock? Let's get this bot live!**

For questions or support, contact: support@morganwallen-official.com