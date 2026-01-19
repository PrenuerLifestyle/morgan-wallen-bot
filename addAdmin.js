require('dotenv').config();
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const telegramId = 7575788883;
  const query = 'INSERT INTO admins (telegram_id) VALUES ($1) ON CONFLICT (telegram_id) DO NOTHING';

  try {
    console.log('Running query:', query);
    console.log('With parameter:', telegramId);

    await pool.query(query, [telegramId]);

    console.log('✅ Admin added');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
