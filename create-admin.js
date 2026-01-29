// create-admin.js
require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

(async () => {
  try {
    const telegramId = await prompt('Enter admin Telegram ID (numeric): ');
    const email = await prompt('Admin email: ');
    const password = await prompt('Password (plaintext): ');

    const hash = await bcrypt.hash(password, 10);

    const res = await pool.query(
      `INSERT INTO admins (telegram_id, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin') RETURNING id`,
      [parseInt(telegramId, 10), email, hash]
    );

    console.log('Admin created with id:', res.rows[0].id);
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('Error creating admin:', err);
    process.exit(1);
  }
})();
