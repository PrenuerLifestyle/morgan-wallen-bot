require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixSchema() {
  try {
    console.log('🔧 Fixing database schema...');
    
    // Add missing columns if they don't exist
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS id SERIAL;
      ALTER TABLE tours ADD COLUMN IF NOT EXISTS tickets_url TEXT;
      
      CREATE TABLE IF NOT EXISTS analytics (
        id SERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(telegram_id),
        event_type TEXT,
        event_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('✅ Schema fixed!');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

fixSchema();
