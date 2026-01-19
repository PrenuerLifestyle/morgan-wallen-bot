// create-admin.js - Script to create admin user for web dashboard
// Run: node create-admin.js

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const readline = require('readline');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createAdmin() {
  console.log('\n🔐 Morgan Wallen Bot - Admin User Setup\n');
  console.log('This will create an admin user for the web dashboard.\n');

  try {
    // Get admin details
    const telegramId = await question('Enter your Telegram ID (get from @userinfobot): ');
    const email = await question('Enter admin email: ');
    const password = await question('Enter password (min 8 characters): ');
    
    if (password.length < 8) {
      console.log('\n❌ Password must be at least 8 characters!');
      rl.close();
      process.exit(1);
    }

    // Hash password
    console.log('\n🔄 Creating admin user...');
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Check if admin already exists
    const existing = await pool.query(
      'SELECT * FROM admins WHERE telegram_id = $1 OR email = $2',
      [telegramId, email]
    );

    if (existing.rows.length > 0) {
      console.log('\n⚠️  Admin user already exists! Updating...');
      
      await pool.query(
        'UPDATE admins SET email = $1, password_hash = $2 WHERE telegram_id = $3',
        [email, passwordHash, telegramId]
      );
      
      console.log('✅ Admin user updated successfully!\n');
    } else {
      // Insert new admin
      await pool.query(
        `INSERT INTO admins (telegram_id, email, password_hash, role, permissions)
         VALUES ($1, $2, $3, 'admin', '{"all": true}')`,
        [telegramId, email, passwordHash]
      );
      
      console.log('✅ Admin user created successfully!\n');
    }

    // Display login info
    console.log('📋 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🌐 Access the dashboard at: http://localhost:3000/admin\n');
    console.log('⚠️  Keep these credentials secure!\n');

  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
  } finally {
    await pool.end();
    rl.close();
  }
}

createAdmin();
