require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query(
  "INSERT INTO admins (telegram_id, role) VALUES (7575788883, 'admin') ON CONFLICT (telegram_id) DO NOTHING",
  (err) => {
    console.log(err ? "❌ " + err.message : "✅ Admin added!");
    pool.end();
  }
);
