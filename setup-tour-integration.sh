#!/data/data/com.termux/files/usr/bin/bash

echo "🎸 Setting up Still The Problem Tour 2026..."
cd ~/morgan-wallen-bot

# Update database schema
echo "📊 Updating database schema..."
psql -d morgan_wallen_bot << 'SQL'
-- Add special_guests column if doesn't exist
ALTER TABLE tours 
ADD COLUMN IF NOT EXISTS special_guests TEXT;

-- Verify table structure
\d tours
SQL

# Create seed script
cat > seed-tour-2026.js << 'EOF'
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/morgan_wallen_bot'
});

const TOUR_DATES = [
  { date: '2026-04-10', city: 'Minneapolis', state: 'MN', venue: 'U.S. Bank Stadium', price: 89.99, vipPrice: 299.99, capacity: 65000, guests: 'Thomas Rhett, Gavin Adcock, Vincent Mason' },
  { date: '2026-04-11', city: 'Minneapolis', state: 'MN', venue: 'U.S. Bank Stadium', price: 89.99, vipPrice: 299.99, capacity: 65000, guests: 'HARDY, Gavin Adcock, Vincent Mason' },
  { date: '2026-04-18', city: 'Tuscaloosa', state: 'AL', venue: 'Saban Field at Bryant-Denny Stadium', price: 79.99, vipPrice: 279.99, capacity: 100000, guests: 'Ella Langley, Vincent Mason, Zach John King' },
  { date: '2026-05-01', city: 'Las Vegas', state: 'NV', venue: 'Allegiant Stadium', price: 99.99, vipPrice: 349.99, capacity: 65000, guests: 'Brooks & Dunn, Gavin Adcock, Vincent Mason' },
  { date: '2026-05-02', city: 'Las Vegas', state: 'NV', venue: 'Allegiant Stadium', price: 99.99, vipPrice: 349.99, capacity: 65000, guests: 'Brooks & Dunn, Gavin Adcock, Vincent Mason' },
  { date: '2026-05-08', city: 'Indianapolis', state: 'IN', venue: 'Lucas Oil Stadium', price: 85.99, vipPrice: 289.99, capacity: 70000, guests: 'Thomas Rhett, Hudson Westbrook' },
  { date: '2026-05-09', city: 'Indianapolis', state: 'IN', venue: 'Lucas Oil Stadium', price: 85.99, vipPrice: 289.99, capacity: 70000, guests: 'HARDY, Hudson Westbrook' },
  { date: '2026-05-15', city: 'Gainesville', state: 'FL', venue: 'Ben Hill Griffin Stadium', price: 79.99, vipPrice: 269.99, capacity: 88000, guests: 'Ella Langley, Blake Whiten' },
  { date: '2026-05-16', city: 'Gainesville', state: 'FL', venue: 'Ben Hill Griffin Stadium', price: 79.99, vipPrice: 269.99, capacity: 88000, guests: 'Brooks & Dunn, Blake Whiten' },
  { date: '2026-05-29', city: 'Denver', state: 'CO', venue: 'Empower Field At Mile High', price: 89.99, vipPrice: 299.99, capacity: 76000, guests: 'Thomas Rhett, Gavin Adcock' },
  { date: '2026-05-30', city: 'Denver', state: 'CO', venue: 'Empower Field At Mile High', price: 89.99, vipPrice: 299.99, capacity: 76000, guests: 'HARDY, Hudson Westbrook' },
  { date: '2026-06-05', city: 'Pittsburgh', state: 'PA', venue: 'Acrisure Stadium', price: 85.99, vipPrice: 289.99, capacity: 68000, guests: 'Brooks & Dunn, Ella Langley' },
  { date: '2026-06-06', city: 'Pittsburgh', state: 'PA', venue: 'Acrisure Stadium', price: 85.99, vipPrice: 289.99, capacity: 68000, guests: 'Thomas Rhett, Vincent Mason' },
  { date: '2026-06-19', city: 'Chicago', state: 'IL', venue: 'Soldier Field', price: 89.99, vipPrice: 299.99, capacity: 61500, guests: 'Brooks & Dunn' },
  { date: '2026-06-20', city: 'Chicago', state: 'IL', venue: 'Soldier Field', price: 89.99, vipPrice: 299.99, capacity: 61500, guests: 'HARDY, Ella Langley' },
  { date: '2026-07-17', city: 'Baltimore', state: 'MD', venue: 'M&T Bank Stadium', price: 89.99, vipPrice: 299.99, capacity: 71000, guests: 'Brooks & Dunn, Ella Langley, Gavin Adcock, Jason Scott & The High Heat' },
  { date: '2026-07-18', city: 'Baltimore', state: 'MD', venue: 'M&T Bank Stadium', price: 89.99, vipPrice: 299.99, capacity: 71000, guests: 'Brooks & Dunn, Ella Langley, Gavin Adcock, Jason Scott & The High Heat' },
  { date: '2026-07-24', city: 'Ann Arbor', state: 'MI', venue: 'Michigan Stadium', price: 85.99, vipPrice: 289.99, capacity: 107000, guests: 'Thomas Rhett, HARDY, Hudson Westbrook, Blake Whiten' },
  { date: '2026-07-25', city: 'Ann Arbor', state: 'MI', venue: 'Michigan Stadium', price: 85.99, vipPrice: 289.99, capacity: 107000, guests: 'Thomas Rhett, HARDY, Hudson Westbrook, Blake Whiten' },
  { date: '2026-08-01', city: 'Philadelphia', state: 'PA', venue: 'Lincoln Financial Field', price: 89.99, vipPrice: 299.99, capacity: 69000, guests: 'Brooks & Dunn, Ella Langley' },
  { date: '2026-08-02', city: 'Philadelphia', state: 'PA', venue: 'Lincoln Financial Field', price: 89.99, vipPrice: 299.99, capacity: 69000, guests: 'HARDY, Gavin Adcock' }
];

async function seed() {
  console.log('🌱 Seeding tours...');
  try {
    await pool.query("DELETE FROM tours WHERE date >= '2026-01-01'");
    
    for (const t of TOUR_DATES) {
      await pool.query(`
        INSERT INTO tours (city, state, venue, date, tickets_available, tickets_sold, ticket_price, vip_price, status, special_guests)
        VALUES ($1, $2, $3, $4, $5, 0, $6, $7, 'active', $8)
      `, [t.city, t.state, t.venue, t.date, t.capacity, t.price, t.vipPrice, t.guests]);
    }
    
    const result = await pool.query('SELECT COUNT(*) FROM tours');
    console.log(`✅ Seeded ${TOUR_DATES.length} tours! Total: ${result.rows[0].count}`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

seed();
EOF

# Run seed
echo "🌱 Seeding data..."
node seed-tour-2026.js

echo ""
echo "✅ Setup complete!"
echo "📋 Next: Add tour commands to bot.js and restart"
