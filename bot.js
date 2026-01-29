const { Telegraf, Markup } = require('telegraf'); // Only once
const cheerio = require('cheerio');               // Only once
const axios = require('axios');                   // Only once
const express = require('express');
const { Pool } = require('pg');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const cron = require('node-cron');
const Queue = require('bull');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Initialize
const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();
app.use(express.json());
app.use(express.static('public'));

// Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDB() {
  try {
    await pool.query(`
      -- Users table with ALL required columns
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Tours table with ALL required columns
      CREATE TABLE IF NOT EXISTS tours (
        id SERIAL PRIMARY KEY,
        city TEXT,
        venue TEXT,
        date DATE,
        tickets_available INTEGER,
        special_guests TEXT,
        tickets_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Bookings table
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(telegram_id),
        booking_type TEXT,
        date DATE,
        status TEXT DEFAULT 'pending',
        amount DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Analytics table
      CREATE TABLE IF NOT EXISTS analytics (
        id SERIAL PRIMARY KEY,
        user_id BIGINT,
        event_type TEXT,
        event_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Add missing columns to existing tables
      DO $$
      BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS id SERIAL;
        ALTER TABLE tours ADD COLUMN IF NOT EXISTS tickets_url TEXT;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END $$;
    `);
       console.log('✅ Database initialized & schema verified');
  } catch (err) {
    console.error('❌ Error initializing DB:', err.message);
  }
}(async () => {
  try {
    // Add missing column
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS last_active TIMESTAMP DEFAULT NOW()
    `);
    console.log('✅ Database migration complete');
  } catch (err) {
    console.error('Migration error:', err);
  }
})();


// Email transporter
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Google Calendar API setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

// Job Queue for async tasks
const emailQueue = new Queue('email-notifications', process.env.REDIS_URL || 'redis://127.0.0.1:6379');
const notificationQueue = new Queue('telegram-notifications', process.env.REDIS_URL || 'redis://127.0.0.1:6379');

// Database Schema
async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE NOT NULL,
      username VARCHAR(255),
      first_name VARCHAR(255),
      last_name VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(50),
      membership_tier VARCHAR(50) DEFAULT 'free',
      membership_expires TIMESTAMP,
      stripe_customer_id VARCHAR(255),
      total_spent DECIMAL(10, 2) DEFAULT 0,
      loyalty_points INTEGER DEFAULT 0,
      preferences JSONB DEFAULT '{}',
      verified BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      last_active TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      booking_type VARCHAR(50) NOT NULL,
      booking_date TIMESTAMP,
      duration INTEGER DEFAULT 15,
      status VARCHAR(50) DEFAULT 'pending',
      payment_status VARCHAR(50) DEFAULT 'unpaid',
      amount DECIMAL(10, 2),
      stripe_payment_id VARCHAR(255),
      google_calendar_event_id VARCHAR(255),
      zoom_meeting_id VARCHAR(255),
      zoom_meeting_url TEXT,
      notes TEXT,
      reminder_sent BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tours (
      id SERIAL PRIMARY KEY,
      city VARCHAR(255) NOT NULL,
      state VARCHAR(100),
      country VARCHAR(100) DEFAULT 'USA',
      venue VARCHAR(255) NOT NULL,
      venue_address TEXT,
      date TIMESTAMP NOT NULL,
      doors_open TIME,
      show_start TIME,
      tickets_available INTEGER DEFAULT 0,
      tickets_sold INTEGER DEFAULT 0,
      ticket_price DECIMAL(10, 2),
      vip_price DECIMAL(10, 2),
      status VARCHAR(50) DEFAULT 'active',
      image_url TEXT,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ticket_purchases (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      tour_id INTEGER REFERENCES tours(id),
      ticket_type VARCHAR(50) DEFAULT 'general',
      quantity INTEGER DEFAULT 1,
      total_amount DECIMAL(10, 2),
      stripe_payment_id VARCHAR(255),
      qr_code TEXT,
      seat_numbers TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      purchased_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE NOT NULL,
      email VARCHAR(255),
      password_hash VARCHAR(255),
      role VARCHAR(50) DEFAULT 'admin',
      permissions JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      image_url TEXT,
      target_audience VARCHAR(50) DEFAULT 'all',
      scheduled_for TIMESTAMP,
      sent BOOLEAN DEFAULT false,
      created_by INTEGER REFERENCES admins(id),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS analytics (
      id SERIAL PRIMARY KEY,
      event_type VARCHAR(100) NOT NULL,
      user_id INTEGER REFERENCES users(id),
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      subject VARCHAR(255),
      message TEXT,
      status VARCHAR(50) DEFAULT 'open',
      priority VARCHAR(50) DEFAULT 'normal',
      assigned_to INTEGER REFERENCES admins(id),
      resolved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS merchandise (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10, 2) NOT NULL,
      image_url TEXT,
      stock_quantity INTEGER DEFAULT 0,
      category VARCHAR(100),
      sizes JSONB DEFAULT '[]',
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS merch_orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      items JSONB NOT NULL,
      total_amount DECIMAL(10, 2),
      shipping_address JSONB,
      tracking_number VARCHAR(255),
      status VARCHAR(50) DEFAULT 'pending',
      stripe_payment_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255),
      message TEXT,
      read BOOLEAN DEFAULT false,
      sent BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
    CREATE INDEX IF NOT EXISTS idx_tours_date ON tours(date);
    CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics(event_type);
  `);
// Add missing columns to existing tables
  try {
    await pool.query(`
      ALTER TABLE analytics 
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
    `);
    console.log('✅ Database schema updated');
  } catch (err) {
    console.log('ℹ️ Schema already up to date');
  }  console.log('✅ Database initialized');
}
// Auto-import tour dates if none exist
async function importToursIfNeeded() {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM tours');
    const count = parseInt(result.rows[0].count);
    
    if (count === 0) {
      console.log('📅 Importing tour dates...');
      
      const tours = [
        { city: 'Tampa', venue: 'Raymond James Stadium', date: '2026-04-25', tickets_url: 'https://morganwallen.com', special_guest: 'Luke Grimes' },
        { city: 'Philadelphia', venue: 'Lincoln Financial Field', date: '2026-05-02', tickets_url: 'https://morganwallen.com', special_guest: 'Luke Grimes' },
        { city: 'Chicago', venue: 'Soldier Field', date: '2026-05-09', tickets_url: 'https://morganwallen.com', special_guest: 'Luke Grimes' },
        { city: 'Detroit', venue: 'Ford Field', date: '2026-05-16', tickets_url: 'https://morganwallen.com', special_guest: 'Luke Grimes' },
        { city: 'Denver', venue: 'Empower Field', date: '2026-05-23', tickets_url: 'https://morganwallen.com', special_guest: 'Luke Grimes' },
        { city: 'Seattle', venue: 'Lumen Field', date: '2026-05-30', tickets_url: 'https://morganwallen.com', special_guest: 'Luke Grimes' },
        { city: 'San Francisco', venue: 'Oracle Park', date: '2026-06-06', tickets_url: 'https://morganwallen.com', special_guest: 'Luke Grimes' },
        { city: 'Los Angeles', venue: 'SoFi Stadium', date: '2026-06-13', tickets_url: 'https://morganwallen.com', special_guest: 'Luke Grimes' },
        { city: 'Phoenix', venue: 'State Farm Stadium', date: '2026-06-20', tickets_url: 'https://morganwallen.com', special_guest: 'Luke Grimes' },
        { city: 'Dallas', venue: 'AT&T Stadium', date: '2026-06-27', tickets_url: 'https://morganwallen.com', special_guest: 'Luke Grimes' },
        { city: 'Houston', venue: 'NRG Stadium', date: '2026-07-11', tickets_url: 'https://morganwallen.com', special_guest: 'Luke Grimes' }
      ];
      
      for (const tour of tours) {
        await pool.query(
          'INSERT INTO tours (city, venue, date, tickets_url, special_guest) VALUES ($1, $2, $3, $4, $5)',
          [tour.city, tour.venue, tour.date, tour.tickets_url, tour.special_guest]
        );
      }
      
      console.log('✅ All tour dates imported!');
    } else {
      console.log(`ℹ️ Tour dates already exist (${count} tours)`);
    }
  } catch (err) {
    console.error('❌ Error importing tours:', err);
  }
}
// Helper Functions
async function getOrCreateUser(ctx) {
  const user = ctx.from;
async function getOrCreateUser(ctx) {
  const user = ctx.from;
  console.log("getOrCreateUser called for user:", user?.id);

  try {
    const result = await pool.query(
      `INSERT INTO users (telegram_id, username, first_name, last_active)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (telegram_id)
       DO UPDATE SET
         last_active = NOW(),
         username = $2,
         first_name = $3
       RETURNING *`,
      [user.id, user.username, user.first_name]
    );

    console.log("Query result rows:", result?.rows);

    if (result?.rows?.[0]) {
      await trackEvent("user_registered", result.rows[0].telegram_id).catch(err => 
        console.error("trackEvent failed:", err)
      );
    }

    return result?.rows?.[0];
  } catch (error) {
    console.error("getOrCreateUser error:", error);
    throw error;
  }
}
    [eventType, userId, JSON.stringify(metadata)]
  );
}

async function sendEmail(to, subject, html) {
  try {
    await emailTransporter.sendMail({
      from: `"Morgan Wallen Official" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html
    });
    console.log('✅ Email sent to:', to);
  } catch (error) {
    console.error('❌ Email error:', error);
  }
}

async function createGoogleCalendarEvent(booking, user) {
  try {
    const event = {
      summary: `${BOOKING_TYPES[booking.booking_type].name} - ${user.first_name}`,
      description: `Booking ID: ${booking.id}\nUser: ${user.first_name} ${user.last_name || ''}\nPhone: ${user.phone || 'N/A'}`,
      start: {
        dateTime: booking.booking_date,
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: new Date(new Date(booking.booking_date).getTime() + booking.duration * 60000).toISOString(),
        timeZone: 'America/New_York',
      },
      attendees: user.email ? [{ email: user.email }] : [],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      sendUpdates: 'all'
    });

    return response.data.id;
  } catch (error) {
    console.error('❌ Calendar error:', error);
    return null;
  }
}

async function createZoomMeeting(booking, user) {
  try {
    const response = await axios.post('https://api.zoom.us/v2/users/me/meetings', {
      topic: `${BOOKING_TYPES[booking.booking_type].name} - ${user.first_name}`,
      type: 2,
      start_time: booking.booking_date,
      duration: booking.duration,
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        waiting_room: true
      }
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.ZOOM_JWT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      id: response.data.id,
      join_url: response.data.join_url,
      password: response.data.password
    };
  } catch (error) {
    console.error('❌ Zoom error:', error);
    return null;
  }
}

// Membership tiers
const MEMBERSHIP_TIERS = {
  free: { 
    name: 'Free Fan', 
    price: 0, 
    benefits: ['Updates', 'Tour announcements'],
    discount: 0
  },
  silver: { 
    name: 'Silver Member', 
    price: 9.99, 
    benefits: ['Early ticket access', 'Exclusive content', 'Priority support', '5% merchandise discount'],
    discount: 0.05
  },
  gold: { 
    name: 'Gold Member', 
    price: 29.99, 
    benefits: ['All Silver benefits', 'Meet & greet discounts', 'VIP lounge access', '10% discount', 'Monthly exclusive content'],
    discount: 0.10
  },
  platinum: { 
    name: 'Platinum VIP', 
    price: 99.99, 
    benefits: ['All Gold benefits', 'Backstage passes', 'Video call opportunities', '20% discount', 'Personal concierge'],
    discount: 0.20
  }
};

const BOOKING_TYPES = {
  voice_call: { name: '📞 Voice Call', price: 199.99, duration: 15 },
  video_call: { name: '📹 Video Call', price: 499.99, duration: 10 },
  meet_greet: { name: '🤝 Meet & Greet', price: 299.99, duration: 30 },
  appointment: { name: '📅 General Appointment', price: 149.99, duration: 20 }
};

// Bot Command Handlers
bot.command('start', async (ctx) => {
  const user = await getOrCreateUser(ctx);
  await trackEvent('bot_start', user.id);
  
  const isNew = user.created_at > new Date(Date.now() - 60000);
  
  const welcomeMessage = isNew ? `
🎸 *Welcome to Morgan Wallen's Official Assistant Bot!*

Hey ${user.first_name}! Great to have you here! 

This is the ONLY verified and secure way to connect with Morgan Wallen's team.

⚠️ *IMPORTANT:* Beware of imposters! This bot has a verified checkmark ✓

🎯 *What you can do here:*
✓ Book exclusive experiences
✓ Get concert tickets first
✓ VIP memberships with perks
✓ Latest tour updates
✓ Official merchandise
✓ Direct support access

Let's get started! 👇
` : `
🎸 *Welcome back, ${user.first_name}!*

What would you like to do today?
`;

  await ctx.reply(welcomeMessage, {
    parse_mode: 'Markdown',
    ...Markup.keyboard([
      ['📅 Book Experience', '🎫 Tickets'],
      ['💎 Membership', '🛍️ Merch Store'],
      ['📍 Tour Dates', '📢 Updates'],
      ['👤 My Profile', 'ℹ️ Help']
    ]).resize()
  });
});

// Profile Management
bot.hears('👤 My Profile', async (ctx) => {
  const user = await getOrCreateUser(ctx);
  
  const bookingsCount = await pool.query(
    'SELECT COUNT(*) FROM bookings WHERE user_id = $1',
    [user.id]
  );
  
  const ticketsCount = await pool.query(
    'SELECT COUNT(*) FROM ticket_purchases WHERE user_id = $1',
    [user.id]
  );

  const tierInfo = MEMBERSHIP_TIERS[user.membership_tier];
  const expiryText = user.membership_expires 
    ? `Expires: ${new Date(user.membership_expires).toLocaleDateString()}`
    : 'No active subscription';

  const message = `
👤 *YOUR PROFILE*

*Personal Info:*
Name: ${user.first_name} ${user.last_name || ''}
Username: @${user.username || 'Not set'}
Email: ${user.email || 'Not provided'}
Phone: ${user.phone || 'Not provided'}

*Membership:*
Tier: ${tierInfo.name}
${user.membership_tier !== 'free' ? expiryText : ''}

*Stats:*
📅 Bookings: ${bookingsCount.rows[0].count}
🎫 Tickets: ${ticketsCount.rows[0].count}
💰 Total Spent: $${user.total_spent || 0}
⭐ Loyalty Points: ${user.loyalty_points}

*Member Since:* ${new Date(user.created_at).toLocaleDateString()}
`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('✏️ Update Email', 'update_email')],
      [Markup.button.callback('📱 Update Phone', 'update_phone')],
      [Markup.button.callback('⚙️ Preferences', 'preferences')],
      [Markup.button.callback('📊 View Analytics', 'my_analytics')]
    ])
  });
});

// Enhanced Booking System
bot.hears('📅 Book Experience', async (ctx) => {
  const user = await getOrCreateUser(ctx);
  await trackEvent('view_bookings', user.id);
  
  const buttons = Object.entries(BOOKING_TYPES).map(([key, value]) => {
    const discount = MEMBERSHIP_TIERS[user.membership_tier].discount;
    const finalPrice = value.price * (1 - discount);
    const priceText = discount > 0 
      ? `$${finalPrice.toFixed(2)} (${(discount*100)}% off!)`
      : `$${value.price}`;
    
    return [Markup.button.callback(`${value.name} - ${priceText}`, `book_${key}`)];
  });
  
  await ctx.reply(
    '🎯 *BOOK YOUR EXPERIENCE*\n\nSelect the type of experience you\'d like:\n\n' +
    (user.membership_tier !== 'free' ? '✨ *VIP discount applied!*' : '💡 Upgrade membership for discounts!'),
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    }
  );
});

// Booking flow with calendar integration
Object.keys(BOOKING_TYPES).forEach(bookingType => {
  bot.action(`book_${bookingType}`, async (ctx) => {
    const user = await getOrCreateUser(ctx);
    const booking = BOOKING_TYPES[bookingType];
    const discount = MEMBERSHIP_TIERS[user.membership_tier].discount;
    const finalPrice = booking.price * (1 - discount);
    
    await ctx.answerCbQuery();
    
    ctx.session = ctx.session || {};
    ctx.session.bookingType = bookingType;
    ctx.session.bookingPrice = finalPrice;
    
    await ctx.reply(
      `✨ *${booking.name}*\n\n` +
      `⏱️ Duration: ${booking.duration} minutes\n` +
      `💰 Price: $${finalPrice.toFixed(2)}${discount > 0 ? ` (${(discount*100)}% member discount!)` : ''}\n\n` +
      `📅 *Choose a date and time:*\n\n` +
      `Please send your preferred date in this format:\n` +
      `YYYY-MM-DD HH:MM\n\n` +
      `Example: 2026-02-15 14:30`,
      { parse_mode: 'Markdown' }
    );
    
    await trackEvent('booking_started', user.id, { type: bookingType });
  });
});

// Enhanced Membership System
bot.hears('💎 Membership', async (ctx) => {
  const user = await getOrCreateUser(ctx);
  await trackEvent('view_membership', user.id);
  
  let message = `💎 *MEMBERSHIP TIERS*\n\nCurrent: *${MEMBERSHIP_TIERS[user.membership_tier].name}*\n\n`;
  
  const buttons = [];
  
  Object.entries(MEMBERSHIP_TIERS).forEach(([key, tier]) => {
    if (key !== 'free') {
      message += `✨ *${tier.name}* - $${tier.price}/month\n`;
      tier.benefits.forEach(b => message += `   ✓ ${b}\n`);
      message += '\n';
      
      buttons.push([Markup.button.callback(
        user.membership_tier === key ? `✅ Current Plan` : `Upgrade to ${tier.name}`,
        user.membership_tier === key ? 'current_plan' : `subscribe_${key}`
      )]);
    }
  });
  
  if (user.membership_tier !== 'free') {
    buttons.push([Markup.button.callback('❌ Cancel Subscription', 'cancel_subscription')]);
  }
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
});

// Subscription with Stripe
['silver', 'gold', 'platinum'].forEach(tier => {
  bot.action(`subscribe_${tier}`, async (ctx) => {
    const user = await getOrCreateUser(ctx);
    const tierInfo = MEMBERSHIP_TIERS[tier];
    
    await ctx.answerCbQuery();
    
    try {
      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        customer_email: user.email,
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${tierInfo.name} Membership`,
              description: tierInfo.benefits.join(', ')
            },
            unit_amount: Math.round(tierInfo.price * 100),
            recurring: { interval: 'month' }
          },
          quantity: 1
        }],
        mode: 'subscription',
        success_url: `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL}/cancel`,
        metadata: {
          user_id: user.id,
          tier: tier
        }
      });
      
      await ctx.reply(
        `🌟 *${tierInfo.name} Subscription*\n\n` +
        `💰 Price: $${tierInfo.price}/month\n\n` +
        `Click below to complete payment:\n${session.url}`,
        { parse_mode: 'Markdown' }
      );
      
      await trackEvent('subscription_initiated', user.id, { tier });
      
    } catch (error) {
      console.error('Stripe error:', error);
      await ctx.reply('❌ Payment error. Please try again or contact support.');
    }
  });
});

// Merch Store
bot.hears('🛍️ Merch Store', async (ctx) => {
  const user = await getOrCreateUser(ctx);
  await trackEvent('view_merch', user.id);
  
  const merch = await pool.query(
    'SELECT * FROM merchandise WHERE active = true ORDER BY category, name LIMIT 20'
  );
  
  if (merch.rows.length === 0) {
    await ctx.reply('🛍️ Merch store coming soon! Stay tuned for exclusive items!');
    return;
  }
  
  let message = '🛍️ *OFFICIAL MERCHANDISE*\n\n';
  const buttons = [];
  
  merch.rows.forEach(item => {
    const discount = MEMBERSHIP_TIERS[user.membership_tier].discount;
    const finalPrice = item.price * (1 - discount);
    
    message += `${item.name}\n💰 $${finalPrice.toFixed(2)}${discount > 0 ? ` (${(discount*100)}% off!)` : ''}\n📦 In stock: ${item.stock_quantity}\n\n`;
    
    buttons.push([Markup.button.callback(`Buy ${item.name}`, `buy_merch_${item.id}`)]);
  });
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons.slice(0, 10))
  });
});

// Enhanced Tour Dates
bot.hears('📍 Tour Dates', async (ctx) => {
  const user = await getOrCreateUser(ctx);
  await trackEvent('view_tours', user.id);
  
  const tours = await pool.query(
    `SELECT * FROM tours 
     WHERE status = 'active' AND date > NOW() 
     ORDER BY date ASC LIMIT 15`
  );
  
  if (tours.rows.length === 0) {
    await ctx.reply('🎸 No upcoming tour dates yet. Enable notifications to be first to know!');
    return;
  }
  
  let message = '🎸 *UPCOMING TOUR DATES*\n\n';
  const buttons = [];
  
  tours.rows.forEach(tour => {
    const date = new Date(tour.date);
    const dateStr = date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    const available = tour.tickets_available - tour.tickets_sold;
    
    message += `📅 *${dateStr}*\n`;
    message += `📍 ${tour.venue}, ${tour.city}, ${tour.state}\n`;
    message += `🎫 ${available} tickets left | $${tour.ticket_price}\n\n`;
    
    if (available > 0) {
      buttons.push([Markup.button.callback(
        `🎫 ${tour.city} - ${dateStr}`, 
        `tour_detail_${tour.id}`
      )]);
    }
  });
  
  buttons.push([Markup.button.callback('🔔 Get Notified', 'tour_notifications')]);
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
});

// Tour detail view
bot.action(/tour_detail_(\d+)/, async (ctx) => {
// Add this to your bot.js file - Real Tour Data Integration

// Real "Still The Problem Tour 2026" dates
const TOUR_DATES_2026 = [
  {
    date: '2026-04-10',
    city: 'Minneapolis',
    state: 'MN',
    venue: 'U.S. Bank Stadium',
    price: 89.99,
    vipPrice: 299.99,
    ticketsAvailable: 65000,
    specialGuests: 'Thomas Rhett, Gavin Adcock, Vincent Mason'
  },
  {
    date: '2026-04-11',
    city: 'Minneapolis',
    state: 'MN',
    venue: 'U.S. Bank Stadium',
    price: 89.99,
    vipPrice: 299.99,
    ticketsAvailable: 65000,
    specialGuests: 'HARDY, Gavin Adcock, Vincent Mason'
  },
  {
    date: '2026-04-18',
    city: 'Tuscaloosa',
    state: 'AL',
    venue: 'Saban Field at Bryant-Denny Stadium',
    price: 79.99,
    vipPrice: 279.99,
    ticketsAvailable: 100000,
    specialGuests: 'Ella Langley, Vincent Mason, Zach John King'
  },
  {
    date: '2026-05-01',
    city: 'Las Vegas',
    state: 'NV',
    venue: 'Allegiant Stadium',
    price: 99.99,
    vipPrice: 349.99,
    ticketsAvailable: 65000,
    specialGuests: 'Brooks & Dunn, Gavin Adcock, Vincent Mason'
  },
  {
    date: '2026-05-02',
    city: 'Las Vegas',
    state: 'NV',
    venue: 'Allegiant Stadium',
    price: 99.99,
    vipPrice: 349.99,
    ticketsAvailable: 65000,
    specialGuests: 'Brooks & Dunn, Gavin Adcock, Vincent Mason'
  },
  {
    date: '2026-05-08',
    city: 'Indianapolis',
    state: 'IN',
    venue: 'Lucas Oil Stadium',
    price: 85.99,
    vipPrice: 289.99,
    ticketsAvailable: 70000,
    specialGuests: 'Thomas Rhett, Hudson Westbrook'
  },
  {
    date: '2026-05-09',
    city: 'Indianapolis',
    state: 'IN',
    venue: 'Lucas Oil Stadium',
    price: 85.99,
    vipPrice: 289.99,
    ticketsAvailable: 70000,
    specialGuests: 'HARDY, Hudson Westbrook'
  },
  {
    date: '2026-05-15',
    city: 'Gainesville',
    state: 'FL',
    venue: 'Ben Hill Griffin Stadium',
    price: 79.99,
    vipPrice: 269.99,
    ticketsAvailable: 88000,
    specialGuests: 'Ella Langley, Blake Whiten'
  },
  {
    date: '2026-05-16',
    city: 'Gainesville',
    state: 'FL',
    venue: 'Ben Hill Griffin Stadium',
    price: 79.99,
    vipPrice: 269.99,
    ticketsAvailable: 88000,
    specialGuests: 'Brooks & Dunn, Blake Whiten'
  },
  {
    date: '2026-05-29',
    city: 'Denver',
    state: 'CO',
    venue: 'Empower Field At Mile High',
    price: 89.99,
    vipPrice: 299.99,
    ticketsAvailable: 76000,
    specialGuests: 'Thomas Rhett, Gavin Adcock'
  },
  {
    date: '2026-05-30',
    city: 'Denver',
    state: 'CO',
    venue: 'Empower Field At Mile High',
    price: 89.99,
    vipPrice: 299.99,
    ticketsAvailable: 76000,
    specialGuests: 'HARDY, Hudson Westbrook'
  },
  {
    date: '2026-06-05',
    city: 'Pittsburgh',
    state: 'PA',
    venue: 'Acrisure Stadium',
    price: 85.99,
    vipPrice: 289.99,
    ticketsAvailable: 68000,
    specialGuests: 'Brooks & Dunn, Ella Langley'
  },
  {
    date: '2026-06-06',
    city: 'Pittsburgh',
    state: 'PA',
    venue: 'Acrisure Stadium',
    price: 85.99,
    vipPrice: 289.99,
    ticketsAvailable: 68000,
    specialGuests: 'Thomas Rhett, Vincent Mason'
  },
  {
    date: '2026-06-19',
    city: 'Chicago',
    state: 'IL',
    venue: 'Soldier Field',
    price: 89.99,
    vipPrice: 299.99,
    ticketsAvailable: 61500,
    specialGuests: 'Brooks & Dunn'
  },
  {
    date: '2026-06-20',
    city: 'Chicago',
    state: 'IL',
    venue: 'Soldier Field',
    price: 89.99,
    vipPrice: 299.99,
    ticketsAvailable: 61500,
    specialGuests: 'HARDY, Ella Langley'
  },
  {
    date: '2026-07-17',
    city: 'Baltimore',
    state: 'MD',
    venue: 'M&T Bank Stadium',
    price: 89.99,
    vipPrice: 299.99,
    ticketsAvailable: 71000,
    specialGuests: 'Brooks & Dunn, Ella Langley, Gavin Adcock, Jason Scott & The High Heat'
  },
  {
    date: '2026-07-18',
    city: 'Baltimore',
    state: 'MD',
    venue: 'M&T Bank Stadium',
    price: 89.99,
    vipPrice: 299.99,
    ticketsAvailable: 71000,
    specialGuests: 'Brooks & Dunn, Ella Langley, Gavin Adcock, Jason Scott & The High Heat'
  },
  {
    date: '2026-07-24',
    city: 'Ann Arbor',
    state: 'MI',
    venue: 'Michigan Stadium',
    price: 85.99,
    vipPrice: 289.99,
    ticketsAvailable: 107000,
    specialGuests: 'Thomas Rhett, HARDY, Hudson Westbrook, Blake Whiten'
  },
  {
    date: '2026-07-25',
    city: 'Ann Arbor',
    state: 'MI',
    venue: 'Michigan Stadium',
    price: 85.99,
    vipPrice: 289.99,
    ticketsAvailable: 107000,
    specialGuests: 'Thomas Rhett, HARDY, Hudson Westbrook, Blake Whiten'
  },
  {
    date: '2026-08-01',
    city: 'Philadelphia',
    state: 'PA',
    venue: 'Lincoln Financial Field',
    price: 89.99,
    vipPrice: 299.99,
    ticketsAvailable: 69000,
    specialGuests: 'Brooks & Dunn, Ella Langley'
  },
  {
    date: '2026-08-02',
    city: 'Philadelphia',
    state: 'PA',
    venue: 'Lincoln Financial Field',
    price: 89.99,
    vipPrice: 299.99,
    ticketsAvailable: 69000,
    specialGuests: 'HARDY, Gavin Adcock'
  }
];

// Add these bot commands (add after existing commands in your bot.js)

// Command: /tour - Show all tour dates
bot.command('tour', async (ctx) => {
  const now = new Date();
  const upcomingTours = TOUR_DATES_2026.filter(t => new Date(t.date) >= now);
  
  if (upcomingTours.length === 0) {
    return ctx.reply('No upcoming tour dates at this time. Check back soon!');
  }
  
  let message = '🎸 *Still The Problem Tour 2026*\n\n';
  message += '21 Stadium Shows Across America!\n\n';
  
  upcomingTours.slice(0, 10).forEach((show, index) => {
    const date = new Date(show.date);
    const formatted = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    message += `📍 *${show.city}, ${show.state}*\n`;
    message += `📅 ${formatted}\n`;
    message += `🏟️ ${show.venue}\n`;
    message += `🎤 ${show.specialGuests}\n`;
    message += `💵 Tickets from $${show.price}\n`;
    message += `\n`;
  });
  
  message += '\n🎫 Use /buyticket to purchase tickets!';
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
});

// Command: /nextshow - Show next upcoming show
bot.command('nextshow', async (ctx) => {
  const now = new Date();
  const nextShow = TOUR_DATES_2026.find(t => new Date(t.date) >= now);
  
  if (!nextShow) {
    return ctx.reply('No upcoming shows at this time.');
  }
  
  const date = new Date(nextShow.date);
  const formatted = date.toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
  
  const message = `
🎸 *NEXT SHOW*

📍 *${nextShow.city}, ${nextShow.state}*
📅 ${formatted}
🏟️ ${nextShow.venue}
👥 Capacity: ${nextShow.ticketsAvailable.toLocaleString()}

🎤 *Special Guests:*
${nextShow.specialGuests}

💰 *Tickets:*
General Admission: $${nextShow.price}
VIP Experience: $${nextShow.vipPrice}

🎫 Ready to go? Use /buyticket to purchase!
  `;
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
});

// Command: /cityshows - Find shows by city
bot.command('cityshows', async (ctx) => {
  const cities = [...new Set(TOUR_DATES_2026.map(t => `${t.city}, ${t.state}`))];
  
  const keyboard = cities.map(city => [{
    text: city,
    callback_data: `city_${city.replace(', ', '_')}`
  }]);
  
  await ctx.reply(
    '🏙️ Select a city to see all shows:',
    {
      reply_markup: {
        inline_keyboard: keyboard
      }
    }
  );
});

// Handle city selection
bot.action(/^city_(.+)/, async (ctx) => {
  const cityState = ctx.match[1].replace('_', ', ');
  const cityShows = TOUR_DATES_2026.filter(t => `${t.city}, ${t.state}` === cityState);
  
  let message = `🎸 *Shows in ${cityState}*\n\n`;
  
  cityShows.forEach(show => {
    const date = new Date(show.date);
    const formatted = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
    
    message += `📅 ${formatted} - ${show.venue}\n`;
    message += `🎤 ${show.specialGuests}\n`;
    message += `💵 From $${show.price}\n\n`;
  });
  
  await ctx.editMessageText(message, { parse_mode: 'Markdown' });
});

// Function to seed database with tour data (run once)
async function seedTourData() {
  console.log('🌱 Seeding tour data...');
  
  for (const tour of TOUR_DATES_2026) {
    await pool.query(`
      INSERT INTO tours (city, state, venue, date, tickets_available, ticket_price, vip_price, status, special_guests)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)
      ON CONFLICT (city, date) DO NOTHING
    `, [
      tour.city,
      tour.state,
      tour.venue,
      tour.date,
      tour.ticketsAvailable,
      tour.price,
      tour.vipPrice,
      tour.specialGuests
    ]);
  }
  
  console.log('✅ Tour data seeded!');
}

// Call this once to populate database
// seedTourData().catch(console.error);

// Export for use in web interface
module.exports = { TOUR_DATES_2026 };
  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🎫 Buy General', `buy_ticket_${tourId}_general`)],
      [Markup.button.callback('⭐ Buy VIP', `buy_ticket_${tourId}_vip`)],
      [Markup.button.callback('🔙 Back to Tours', 'back_to_tours')]
    ])
  });
});

// Ticket purchase
bot.action(/buy_ticket_(\d+)_(general|vip)/, async (ctx) => {
  const [, tourId, ticketType] = ctx.match;
  const user = await getOrCreateUser(ctx);
  
  const tour = await pool.query('SELECT * FROM tours WHERE telegram_id = $1', [tourId]);
  if (tour.rows.length === 0) {
    await ctx.answerCbQuery('Tour not found');
    return;
  }
  
  const t = tour.rows[0];
  const discount = MEMBERSHIP_TIERS[user.membership_tier].discount;
  const price = ticketType === 'vip' ? t.vip_price : t.ticket_price;
  const finalPrice = price * (1 - discount);
  
  await ctx.answerCbQuery();
  
  try {
    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${t.city} Concert - ${ticketType.toUpperCase()} Ticket`,
            description: `${t.venue} - ${new Date(t.date).toLocaleDateString()}`
          },
          unit_amount: Math.round(finalPrice * 100)
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: `${process.env.APP_URL}/ticket-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/cancel`,
      metadata: {
        user_id: user.id,
        tour_id: tourId,
        ticket_type: ticketType
      }
    });
    
    await ctx.reply(
      `🎫 *CHECKOUT*\n\n` +
      `${t.city} - ${ticketType.toUpperCase()} Ticket\n` +
      `💰 Total: $${finalPrice.toFixed(2)}\n\n` +
      `Complete your purchase:\n${session.url}`,
      { parse_mode: 'Markdown' }
    );
    
    await trackEvent('ticket_purchase_initiated', user.id, { tour_id: tourId, type: ticketType });
    
  } catch (error) {
    console.error('Ticket purchase error:', error);
    await ctx.reply('❌ Error processing ticket. Please contact support.');
  }
});

// Updates and Announcements
bot.hears('📢 Updates', async (ctx) => {
  const user = await getOrCreateUser(ctx);
  
  const announcements = await pool.query(
    `SELECT * FROM announcements 
     WHERE sent = true AND (target_audience = 'all' OR target_audience = $1)
     ORDER BY created_at DESC LIMIT 5`,
    [user.membership_tier]
  );
  
  if (announcements.rows.length === 0) {
    await ctx.reply('📢 No new updates. Enable notifications to stay informed!');
    return;
  }
  
  for (const announcement of announcements.rows) {
    await ctx.reply(
      `📢 *${announcement.title}*\n\n${announcement.message}`,
      { parse_mode: 'Markdown' }
    );
  }
  
  await trackEvent('view_updates', user.id);
});

// Support System
bot.command('support', async (ctx) => {
  const user = await getOrCreateUser(ctx);
  
  await ctx.reply(
    `📞 *CONTACT SUPPORT*\n\n` +
    `How can we help you today?`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🎫 Ticket Issue', 'support_ticket')],
        [Markup.button.callback('💰 Payment Issue', 'support_payment')],
        [Markup.button.callback('📅 Booking Issue', 'support_booking')],
        [Markup.button.callback('💬 General Question', 'support_general')],
        [Markup.button.callback('📋 My Tickets', 'view_support_tickets')]
      ])
    }
  );
});

// Support ticket creation
['ticket', 'payment', 'booking', 'general'].forEach(type => {
  bot.action(`support_${type}`, async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session = ctx.session || {};
    ctx.session.supportType = type;
    
    await ctx.reply(
      '📝 Please describe your issue in detail.\n\nSend your message now:',
      { parse_mode: 'Markdown' }
    );
  });
});

// View my bookings
bot.command('mybookings', async (ctx) => {
  const user = await getOrCreateUser(ctx);
  
  const bookings = await pool.query(
    `SELECT * FROM bookings 
     WHERE user_id = $1 
     ORDER BY booking_date DESC LIMIT 10`,
    [user.id]
  );
  
  if (bookings.rows.length === 0) {
    await ctx.reply('📋 No bookings yet. Book an experience to get started!');
    return;
  }
  
  let message = '📋 *YOUR BOOKINGS*\n\n';
  const buttons = [];
  
  bookings.rows.forEach((booking, index) => {
    const type = BOOKING_TYPES[booking.booking_type]?.name || booking.booking_type;
    const date = booking.booking_date ? new Date(booking.booking_date).toLocaleString() : 'Pending';
    const statusEmoji = booking.status === 'confirmed' ? '✅' : booking.status === 'pending' ? '⏳' : '❌';
    
    message += `${index + 1}. ${type}\n`;
    message += `   ${statusEmoji} Status: ${booking.status}\n`;
    message += `   📅 Date: ${date}\n`;
    message += `   💰 $${booking.amount}\n\n`;
    
    if (booking.status === 'confirmed' && booking.zoom_meeting_url) {
      buttons.push([Markup.button.callback(`Join ${type}`, `join_${booking.id}`)]);
    }
  });
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons.length > 0 ? buttons : [[Markup.button.callback('📅 Book New', 'book_new')]])
  });
});

// Join video/voice call
bot.action(/join_(\d+)/, async (ctx) => {
  const bookingId = ctx.match[1];
  const user = await getOrCreateUser(ctx);
  
  const booking = await pool.query(
    'SELECT * FROM bookings WHERE telegram_id = $1 AND user_id = $2',
    [bookingId, user.id]
  );
  
  if (booking.rows.length === 0) {
    await ctx.answerCbQuery('Booking not found');
    return;
  }
  
  const b = booking.rows[0];
  
  if (!b.zoom_meeting_url) {
    await ctx.answerCbQuery('Meeting link not available yet');
    return;
  }
  
  await ctx.answerCbQuery();
  await ctx.reply(
    `🎥 *Your Meeting is Ready!*\n\n` +
    `📅 Scheduled: ${new Date(b.booking_date).toLocaleString()}\n` +
    `⏱️ Duration: ${b.duration} minutes\n\n` +
    `🔗 Join here: ${b.zoom_meeting_url}\n\n` +
    `See you there! 🎸`,
    { parse_mode: 'Markdown' }
  );
});

// ADMIN COMMANDS

bot.command('admin', async (ctx) => {
  if (!await isAdmin(ctx.from.id)) {
    await ctx.reply('⛔ Access denied. Admin only.');
    return;
  }
  
  await ctx.reply(
    `🔐 *ADMIN PANEL*\n\nWelcome to the management dashboard.`,
    {
      parse_mode: 'Markdown',
      ...Markup.keyboard([
        ['📊 Dashboard', '📋 Bookings'],
        ['🎸 Manage Tours', '📢 Broadcast'],
        ['👥 Users', '🛍️ Merchandise'],
        ['💰 Revenue', '📈 Analytics'],
        ['🔙 Exit Admin']
      ]).resize()
    }
  );
});

// Admin Dashboard
bot.hears('📊 Dashboard', async (ctx) => {
  if (!await isAdmin(ctx.from.id)) return;
  
  const stats = await Promise.all([
    pool.query('SELECT COUNT(*) FROM users'),
    pool.query('SELECT COUNT(*) FROM bookings WHERE status = $1', ['pending']),
    pool.query('SELECT COUNT(*) FROM bookings WHERE created_at > NOW() - INTERVAL \'24 hours\''),
    pool.query('SELECT SUM(amount) FROM bookings WHERE payment_status = $1', ['paid']),
    pool.query('SELECT COUNT(*) FROM ticket_purchases WHERE created_at > NOW() - INTERVAL \'24 hours\''),
    pool.query('SELECT COUNT(DISTINCT user_id) FROM users WHERE last_active > NOW() - INTERVAL \'24 hours\'')
  ]);
  
  await ctx.reply(
    `📊 *DASHBOARD - ${new Date().toLocaleDateString()}*\n\n` +
    `👥 Total Users: ${stats[0].rows[0].count}\n` +
    `📱 Active (24h): ${stats[5].rows[0].count}\n\n` +
    `📅 Pending Bookings: ${stats[1].rows[0].count}\n` +
    `📅 New Bookings (24h): ${stats[2].rows[0].count}\n\n` +
    `🎫 Tickets Sold (24h): ${stats[4].rows[0].count}\n\n` +
    `💰 Total Revenue: $${stats[3].rows[0].sum || 0}\n`,
    { parse_mode: 'Markdown' }
  );
});

// Admin - View Bookings
bot.hears('📋 Bookings', async (ctx) => {
  if (!await isAdmin(ctx.from.id)) return;
  
  const bookings = await pool.query(
    `SELECT b.*, u.first_name, u.last_name, u.email 
     FROM bookings b 
     JOIN users u ON b.user_id = u.id 
     WHERE b.status = 'pending' 
     ORDER BY b.created_at DESC 
     LIMIT 10`
  );
  
  if (bookings.rows.length === 0) {
    await ctx.reply('✅ No pending bookings!');
    return;
  }
  
  let message = '📋 *PENDING BOOKINGS*\n\n';
  const buttons = [];
  
  bookings.rows.forEach((b, i) => {
    message += `${i+1}. ${b.first_name} ${b.last_name}\n`;
    message += `   Type: ${BOOKING_TYPES[b.booking_type]?.name}\n`;
    message += `   Amount: $${b.amount}\n`;
    message += `   ID: ${b.id}\n\n`;
    
    buttons.push([
      Markup.button.callback(`✅ Approve #${b.id}`, `approve_${b.id}`),
      Markup.button.callback(`❌ Reject #${b.id}`, `reject_${b.id}`)
    ]);
  });
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
});

// Approve booking
bot.action(/approve_(\d+)/, async (ctx) => {
  if (!await isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery('Admin only');
    return;
  }
  
  const bookingId = ctx.match[1];
  
  const booking = await pool.query(
    `SELECT b.*, u.* FROM bookings b 
     JOIN users u ON b.user_id = u.id 
     WHERE b.id = $1`,
    [bookingId]
  );
  
  if (booking.rows.length === 0) {
    await ctx.answerCbQuery('Booking not found');
    return;
  }
  
  const b = booking.rows[0];
  
  // Create calendar event
  const calendarEventId = await createGoogleCalendarEvent(b, b);
  
  // Create Zoom meeting for video/voice calls
  let zoomData = null;
  if (b.booking_type === 'video_call' || b.booking_type === 'voice_call') {
    zoomData = await createZoomMeeting(b, b);
  }
  
  // Update booking
  await pool.query(
    `UPDATE bookings 
     SET status = 'confirmed', 
         google_calendar_event_id = $1,
         zoom_meeting_id = $2,
         zoom_meeting_url = $3,
         updated_at = NOW()
     WHERE telegram_id = $4`,
    [calendarEventId, zoomData?.id, zoomData?.join_url, bookingId]
  );
  
  // Send confirmation to user
  await bot.telegram.sendMessage(
    b.telegram_id,
    `✅ *Booking Confirmed!*\n\n` +
    `Your ${BOOKING_TYPES[b.booking_type].name} has been approved!\n\n` +
    `📅 Date: ${new Date(b.booking_date).toLocaleString()}\n` +
    `⏱️ Duration: ${b.duration} minutes\n\n` +
    `${zoomData ? `🔗 Meeting Link: ${zoomData.join_url}\n\n` : ''}` +
    `We'll send you a reminder 24 hours before!`,
    { parse_mode: 'Markdown' }
  );
  
  // Send email confirmation
  if (b.email) {
    await sendEmail(
      b.email,
      'Booking Confirmed - Morgan Wallen',
      `<h1>Your booking is confirmed!</h1>
       <p>Date: ${new Date(b.booking_date).toLocaleString()}</p>
       ${zoomData ? `<p>Join: <a href="${zoomData.join_url}">${zoomData.join_url}</a></p>` : ''}`
    );
  }
  
  await ctx.answerCbQuery('✅ Booking approved!');
  await ctx.reply('✅ Booking approved and user notified!');
  
  await trackEvent('booking_approved', b.user_id, { booking_id: bookingId });
});

// Reject booking
bot.action(/reject_(\d+)/, async (ctx) => {
  if (!await isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery('Admin only');
    return;
  }
  
  const bookingId = ctx.match[1];
  
  await pool.query(
    'UPDATE bookings SET status = $1, updated_at = NOW() WHERE telegram_id = $2',
    ['rejected', bookingId]
  );
  
  await ctx.answerCbQuery('❌ Booking rejected');
  await ctx.reply('Booking rejected. User will be notified.');
});

// Admin - Add Tour
bot.hears('🎸 Manage Tours', async (ctx) => {
  if (!await isAdmin(ctx.from.id)) return;
  
  await ctx.reply(
    '🎸 *TOUR MANAGEMENT*\n\n' +
    'Use /addtour to add a new tour date\n' +
    'Format: /addtour City|Venue|YYYY-MM-DD|Price|Tickets',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('View All Tours', 'admin_view_tours')],
        [Markup.button.callback('Add Quick Tour', 'quick_add_tour')]
      ])
    }
  );
});

bot.command('addtour', async (ctx) => {
  if (!await isAdmin(ctx.from.id)) return;
  
  const params = ctx.message.text.split(' ').slice(1).join(' ').split('|');
  
  if (params.length < 5) {
    await ctx.reply('Format: /addtour City|Venue|YYYY-MM-DD|Price|Tickets');
    return;
  }
  
  const [city, venue, date, price, tickets] = params;
  
  await pool.query(
    `INSERT INTO tours (city, venue, date, ticket_price, tickets_available, status)
     VALUES ($1, $2, $3, $4, $5, 'active')`,
    [city.trim(), venue.trim(), date.trim(), parseFloat(price), parseInt(tickets)]
  );
  
  await ctx.reply(`✅ Tour added: ${city} - ${venue} on ${date}`);
});

// Admin - Broadcast Message
bot.hears('📢 Broadcast', async (ctx) => {
  if (!await isAdmin(ctx.from.id)) return;
  
  await ctx.reply(
    '📢 *BROADCAST MESSAGE*\n\n' +
    'Who should receive this announcement?',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🌍 All Users', 'broadcast_all')],
        [Markup.button.callback('💎 VIP Only', 'broadcast_vip')],
        [Markup.button.callback('⭐ Platinum', 'broadcast_platinum')],
        [Markup.button.callback('🎫 Ticket Holders', 'broadcast_ticket_holders')]
      ])
    }
  );
});

bot.action(/broadcast_(.+)/, async (ctx) => {
  if (!await isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery('Admin only');
    return;
  }
  
  const audience = ctx.match[1];
  ctx.session = ctx.session || {};
  ctx.session.broadcastAudience = audience;
  
  await ctx.answerCbQuery();
  await ctx.reply(
    '📝 *COMPOSE MESSAGE*\n\n' +
    'Send your announcement message now.\n\n' +
    'You can include:\n' +
    '- Text\n' +
    '- Images\n' +
    '- Links\n\n' +
    'Send your message:',
    { parse_mode: 'Markdown' }
  );
});

// Admin - Revenue Report
bot.hears('💰 Revenue', async (ctx) => {
  if (!await isAdmin(ctx.from.id)) return;
  
  const revenue = await pool.query(`
    SELECT 
      SUM(CASE WHEN payment_status = 'paid' THEN amount ELSE 0 END) as total_revenue,
      SUM(CASE WHEN created_at > NOW() - INTERVAL '7 days' AND payment_status = 'paid' THEN amount ELSE 0 END) as week_revenue,
      SUM(CASE WHEN created_at > NOW() - INTERVAL '30 days' AND payment_status = 'paid' THEN amount ELSE 0 END) as month_revenue
    FROM bookings
  `);
  
  const tickets = await pool.query(`
    SELECT SUM(total_amount) as ticket_revenue
    FROM ticket_purchases WHERE status = 'completed'
  `);
  
  const r = revenue.rows[0];
  const t = tickets.rows[0];
  
  await ctx.reply(
    `💰 *REVENUE REPORT*\n\n` +
    `*Bookings:*\n` +
    `Total: $${r.total_revenue || 0}\n` +
    `This Week: $${r.week_revenue || 0}\n` +
    `This Month: $${r.month_revenue || 0}\n\n` +
    `*Tickets:*\n` +
    `Total: $${t.ticket_revenue || 0}\n\n` +
    `*Combined Total: $${(parseFloat(r.total_revenue || 0) + parseFloat(t.ticket_revenue || 0)).toFixed(2)}*`,
    { parse_mode: 'Markdown' }
  );
});

// Analytics
bot.hears('📈 Analytics', async (ctx) => {
  if (!await isAdmin(ctx.from.id)) return;
  
  const analytics = await pool.query(`
    SELECT 
      event_type,
      COUNT(*) as count,
      DATE(created_at) as date
    FROM analytics
    WHERE created_at > NOW() - INTERVAL '7 days'
    GROUP BY event_type, DATE(created_at)
    ORDER BY date DESC, count DESC
  `);
  
  let message = '📈 *ANALYTICS (Last 7 Days)*\n\n';
  
  const eventCounts = {};
  analytics.rows.forEach(row => {
    eventCounts[row.event_type] = (eventCounts[row.event_type] || 0) + parseInt(row.count);
  });
  
  Object.entries(eventCounts).forEach(([event, count]) => {
    message += `${event}: ${count}\n`;
  });
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
});

// Scheduled Tasks with Cron
cron.schedule('0 9 * * *', async () => {
  // Send daily booking reminders
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const bookings = await pool.query(
    `SELECT b.*, u.telegram_id, u.first_name 
     FROM bookings b 
     JOIN users u ON b.user_id = u.id 
     WHERE b.booking_date::date = $1 AND b.status = 'confirmed' AND b.reminder_sent = false`,
    [tomorrow.toISOString().split('T')[0]]
  );
  
  for (const booking of bookings.rows) {
    await bot.telegram.sendMessage(
      booking.telegram_id,
      `⏰ *Reminder!*\n\n` +
      `Your ${BOOKING_TYPES[booking.booking_type].name} is tomorrow at ${new Date(booking.booking_date).toLocaleTimeString()}!\n\n` +
      `${booking.zoom_meeting_url ? `🔗 Join: ${booking.zoom_meeting_url}` : 'Details will be sent soon.'}`,
      { parse_mode: 'Markdown' }
    );
    
    await pool.query('UPDATE bookings SET reminder_sent = true WHERE telegram_id = $1', [booking.id]);
  }
  
  console.log(`✅ Sent ${bookings.rows.length} booking reminders`);
});

// Queue processors
emailQueue.process(async (job) => {
  const { to, subject, html } = job.data;
  await sendEmail(to, subject, html);
});

notificationQueue.process(async (job) => {
  const { userId, message } = job.data;
  const user = await pool.query('SELECT telegram_id FROM users WHERE telegram_id = $1', [userId]);
  if (user.rows.length > 0) {
    await bot.telegram.sendMessage(user.rows[0].telegram_id, message, { parse_mode: 'Markdown' });
  }
});

// Webhook handlers
app.post('/webhook/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    if (session.metadata.user_id) {
      const userId = session.metadata.user_id;
      
      // Handle subscription
      if (session.metadata.tier) {
        const expires = new Date();
        expires.setMonth(expires.getMonth() + 1);
        
        await pool.query(
          `UPDATE users 
           SET membership_tier = $1, membership_expires = $2, stripe_customer_id = $3 
           WHERE telegram_id = $4`,
          [session.metadata.tier, expires, session.customer, userId]
        );
        
        await notificationQueue.add({
          userId,
          message: `🎉 Welcome to ${MEMBERSHIP_TIERS[session.metadata.tier].name}! Your benefits are now active.`
        });
      }
      
      // Handle ticket purchase
      if (session.metadata.tour_id) {
        await pool.query(
          `INSERT INTO ticket_purchases (user_id, tour_id, ticket_type, total_amount, stripe_payment_id, status)
           VALUES ($1, $2, $3, $4, $5, 'completed')`,
          [userId, session.metadata.tour_id, session.metadata.ticket_type, session.amount_total / 100, session.payment_intent, 'completed']
        );
        
        await pool.query(
          'UPDATE tours SET tickets_sold = tickets_sold + 1 WHERE telegram_id = $1',
          [session.metadata.tour_id]
        );
        
        await notificationQueue.add({
          userId,
          message: `🎫 Ticket confirmed! Check your email for details.`
        });
      }
    }
  }

  res.json({ received: true });
});

// Web dashboard routes
app.get('/admin/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Admin Login</title>
      <style>
        body { font-family: Arial; max-width: 400px; margin: 100px auto; padding: 20px; }
        input { width: 100%; padding: 10px; margin: 10px 0; }
        button { width: 100%; padding: 10px; background: #0088cc; color: white; border: none; cursor: pointer; }
      </style>
    </head>
    <body>
      <h2>Admin Login</h2>
      <form action="/admin/auth" method="POST">
        <input type="text" name="username" placeholder="Username" required>
        <input type="password" name="password" placeholder="Password" required>
        <button type="submit">Login</button>
      </form>
    </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.send('Morgan Wallen Official Bot - Active ✅');
});

// Error handling
bot.catch((err, ctx) => {
  console.error("========================");
  console.error("Bot error occurred:");
  console.error("Error message:", err.message);
  console.error("Error stack:", err.stack);
  console.error("Update type:", ctx?.updateType);
  console.error("User:", ctx?.from?.id, ctx?.from?.username);
  console.error("========================");
  ctx.reply("❌ An error occurred. Our team has been notified.");
});

// Initialize and start
  try {
    await initDatabase();
    await bot.launch();
    console.log('✅ Bot started successfully');
    
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
    
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
  } catch (error) {
    console.error('❌ Failed to start:', error);
    process.exit(1);
  }
}

start()
// Start the bot and server
async function start() {
  try {
    await initDB();
    await importToursIfNeeded();
    
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
    
    // Use webhook in production
    if (process.env.NODE_ENV === 'production') {
      app.use(bot.webhookCallback('/webhook'));
      const domain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL;
      if (domain) {
        await bot.telegram.setWebhook(`https://${domain}/webhook`);
        console.log('✅ Bot started in webhook mode');
      }
    } else {
      await bot.launch();
      console.log('✅ Bot started in polling mode');
    }
  } catch (err) {
    console.error('❌ Failed to start:', err);
    process.exit(1);
  }
}





