require('dotenv').config()
const { Telegraf, Markup } = require('telegraf')
const express = require('express')
const { Pool } = require('pg')

const bot = new Telegraf(process.env.BOT_TOKEN)
const app = express()
app.use(express.json())

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username VARCHAR(255),
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        email VARCHAR(255),
        membership_tier VARCHAR(50) DEFAULT 'free',
        total_spent DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        last_active TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        booking_type VARCHAR(50) NOT NULL,
        booking_date TIMESTAMP,
        duration INTEGER DEFAULT 15,
        amount DECIMAL(10, 2),
        status VARCHAR(50) DEFAULT 'pending',
        payment_status VARCHAR(50) DEFAULT 'unpaid',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS tours (
        id SERIAL PRIMARY KEY,
        city VARCHAR(255) NOT NULL,
        state VARCHAR(100),
        venue VARCHAR(255) NOT NULL,
        date TIMESTAMP NOT NULL,
        tickets_available INTEGER DEFAULT 0,
        tickets_sold INTEGER DEFAULT 0,
        ticket_price DECIMAL(10, 2),
        vip_price DECIMAL(10, 2),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Database initialized');
  } catch (error) {
    console.error('❌ Database error:', error.message);
  }
}

async function getOrCreateUser(ctx) {
  const { id, username, first_name, last_name } = ctx.from;
  let user = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [id]);
  if (user.rows.length === 0) {
    const result = await pool.query(
      'INSERT INTO users (telegram_id, username, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, username, first_name, last_name]
    );
    return result.rows[0];
  }
  await pool.query('UPDATE users SET last_active = NOW() WHERE id = $1', [user.rows[0].id]);
  return user.rows[0];
}

async function isAdmin(telegramId) {
  const result = await pool.query('SELECT * FROM admins WHERE telegram_id = $1', [telegramId]);
  return result.rows.length > 0;
}

const MEMBERSHIP_TIERS = {
  free: { name: 'Free Fan', price: 0, discount: 0 },
  silver: { name: 'Silver Member', price: 9.99, discount: 0.05 },
  gold: { name: 'Gold Member', price: 29.99, discount: 0.10 },
  platinum: { name: 'Platinum VIP', price: 99.99, discount: 0.20 }
};

const BOOKING_TYPES = {
  voice_call: { name: '📞 Voice Call', price: 199.99, duration: 15 },
  video_call: { name: '📹 Video Call', price: 499.99, duration: 10 },
  meet_greet: { name: '🤝 Meet & Greet', price: 299.99, duration: 30 }
};

bot.command('start', async (ctx) => {
  await getOrCreateUser(ctx);
  await ctx.reply(
    '🎸 *Welcome to Morgan Wallen\'s Official Assistant Bot!*\n\n' +
    'This is the VERIFIED and SECURE way to connect!\n\n' +
    '⚠️ *Beware of imposters! This is the ONLY official bot.*\n\n' +
    'What would you like to do today?',
    {
      parse_mode: 'Markdown',
      ...Markup.keyboard([
        ['📅 Book Experience', '🎫 Tickets'],
        ['💎 Membership', '📍 Tour Dates'],
        ['👤 My Profile', 'ℹ️ Help']
      ]).resize()
    }
  );
});

bot.hears('📅 Book Experience', async (ctx) => {
  const user = await getOrCreateUser(ctx);
  const discount = MEMBERSHIP_TIERS[user.membership_tier].discount;
  
  const buttons = Object.entries(BOOKING_TYPES).map(([key, value]) => {
    const finalPrice = value.price * (1 - discount);
    return [Markup.button.callback(`${value.name} - $${finalPrice.toFixed(2)}`, `book_${key}`)];
  });
  
  await ctx.reply(
    '🎯 *Choose Your Experience:*',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    }
  );
});

Object.keys(BOOKING_TYPES).forEach(bookingType => {
  bot.action(`book_${bookingType}`, async (ctx) => {
    const user = await getOrCreateUser(ctx);
    const booking = BOOKING_TYPES[bookingType];
    const discount = MEMBERSHIP_TIERS[user.membership_tier].discount;
    const finalPrice = booking.price * (1 - discount);
    
    await ctx.answerCbQuery();
    await ctx.reply(
      `✨ *${booking.name}*\n\n` +
      `⏱️ Duration: ${booking.duration} minutes\n` +
      `💰 Price: $${finalPrice.toFixed(2)}\n\n` +
      `To complete booking, contact support.`,
      { parse_mode: 'Markdown' }
    );
    
    await pool.query(
      'INSERT INTO bookings (user_id, booking_type, amount, duration) VALUES ($1, $2, $3, $4)',
      [user.id, bookingType, finalPrice, booking.duration]
    );
  });
});

bot.hears('💎 Membership', async (ctx) => {
  const user = await getOrCreateUser(ctx);
  
  let message = `💎 *MEMBERSHIP TIERS*\n\nCurrent: *${MEMBERSHIP_TIERS[user.membership_tier].name}*\n\n`;
  message += '✨ *Silver* - $9.99/month (5% discount)\n';
  message += '⭐ *Gold* - $29.99/month (10% discount)\n';
  message += '💎 *Platinum* - $99.99/month (20% discount)\n';
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
});

bot.hears('📍 Tour Dates', async (ctx) => {
  const tours = await pool.query(
    'SELECT * FROM tours WHERE status = $1 AND date > NOW() ORDER BY date ASC LIMIT 10',
    ['active']
  );
  
  if (tours.rows.length === 0) {
    await ctx.reply('🎸 No upcoming tour dates yet. Stay tuned!');
    return;
  }
  
  let message = '🎸 *UPCOMING TOUR DATES*\n\n';
  tours.rows.forEach(tour => {
    const date = new Date(tour.date).toLocaleDateString();
    const available = tour.tickets_available - tour.tickets_sold;
    message += `📅 ${date}\n📍 ${tour.venue}, ${tour.city}\n💰 $${tour.ticket_price} | ${available} left\n\n`;
  });
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
});

bot.hears('👤 My Profile', async (ctx) => {
  const user = await getOrCreateUser(ctx);
  const bookings = await pool.query('SELECT COUNT(*) FROM bookings WHERE user_id = $1', [user.id]);
  
  await ctx.reply(
    `👤 *YOUR PROFILE*\n\n` +
    `Name: ${user.first_name} ${user.last_name || ''}\n` +
    `Username: @${user.username || 'Not set'}\n` +
    `Membership: ${MEMBERSHIP_TIERS[user.membership_tier].name}\n` +
    `Bookings: ${bookings.rows[0].count}\n` +
    `Member Since: ${new Date(user.created_at).toLocaleDateString()}`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('mybookings', async (ctx) => {
  const user = await getOrCreateUser(ctx);
  const bookings = await pool.query(
    'SELECT * FROM bookings WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
    [user.id]
  );
  
  if (bookings.rows.length === 0) {
    await ctx.reply('📋 No bookings yet!');
    return;
  }
  
  let message = '📋 *YOUR BOOKINGS*\n\n';
  bookings.rows.forEach((b, i) => {
    const type = BOOKING_TYPES[b.booking_type]?.name || b.booking_type;
    message += `${i + 1}. ${type} - $${b.amount} (${b.status})\n`;
  });
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
});

bot.command('admin', async (ctx) => {
  if (!await isAdmin(ctx.from.id)) {
    await ctx.reply('⛔ Access denied. Admin only.');
    return;
  }
  
  const stats = await pool.query('SELECT COUNT(*) FROM users');
  
  await ctx.reply(
    `🔐 *ADMIN PANEL*\n\n` +
    `Users: ${stats.rows[0].count}\n\n` +
    `Commands:\n` +
    `/addtour City|Venue|Date|Price|Tickets\n` +
    `/stats - Statistics`,
    { parse_mode: 'Markdown' }
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
    'INSERT INTO tours (city, venue, date, ticket_price, tickets_available, status) VALUES ($1, $2, $3, $4, $5, $6)',
    [city.trim(), venue.trim(), date.trim(), parseFloat(price), parseInt(tickets), 'active']
  );
  
  await ctx.reply(`✅ Tour added: ${city} - ${venue}`);
});

bot.hears('ℹ️ Help', async (ctx) => {
  await ctx.reply(
    'ℹ️ *HELP*\n\n' +
    '📅 Book experiences\n' +
    '🎫 Concert tickets\n' +
    '💎 VIP memberships\n\n' +
    'Commands:\n' +
    '/start - Main menu\n' +
    '/mybookings - Your bookings\n' +
    '/admin - Admin panel',
    { parse_mode: 'Markdown' }
  );
});

async function start() {
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

start();
