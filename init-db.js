// init-db.js
require('dotenv').config();
const { Pool } = require('pg');

// === REPLACE THIS WITH YOUR TELEGRAM ID ===
const YOUR_TELEGRAM_ID = 994286913; // <-- put your Telegram number here

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDB() {
  try {
    const client = await pool.connect();

    console.log('Connected to DB! Initializing tables...');

    // USERS table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // ADMINS table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        role TEXT DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // BOOKINGS table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        event_name TEXT NOT NULL,
        date DATE,
        amount NUMERIC(10,2),
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Insert your Telegram ID as admin if not exists
    await client.query(
      `
      INSERT INTO admins (telegram_id, role)
      VALUES ($1, 'admin')
      ON CONFLICT (telegram_id) DO NOTHING;
      `,
      [YOUR_TELEGRAM_ID]
    );

    console.log(`✅ Tables initialized and Telegram ID ${YOUR_TELEGRAM_ID} added as admin!`);
    client.release();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error initializing DB:', err);
    process.exit(1);
  }
}

initDB();
