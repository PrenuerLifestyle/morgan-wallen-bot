#!/data/data/com.termux/files/usr/bin/bash

# 🎸 Setup Real Tour Data Integration

echo "🎸 Setting up Still The Problem Tour 2026 integration..."

cd ~/morgan-wallen-bot

# 1. Update database schema
echo "📊 Updating database schema..."
node -e "
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function updateSchema() {
  try {
    // Add special_guests column if doesn't exist
    await pool.query(\`
      ALTER TABLE tours 
      ADD COLUMN IF NOT EXISTS special_guests TEXT
    \`);
    
    console.log('✅ Schema updated');
    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

updateSchema();
"

# 2. Create tour data seed script
cat > seed-tour-2026.js << 'EOF'
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const TOUR_DATES_2026 = [
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

async function seedTours() {
  console.log('🌱 Seeding Still The Problem Tour 2026 dates...');
  
  try {
    // Clear existing tours
    await pool.query('DELETE FROM tours');
    
    // Insert new tours
    for (const tour of TOUR_DATES_2026) {
      await pool.query(`
        INSERT INTO tours 
        (city, state, venue, date, tickets_available, tickets_sold, ticket_price, vip_price, status, special_guests)
        VALUES ($1, $2, $3, $4, $5, 0, $6, $7, 'active', $8)
      `, [
        tour.city,
        tour.state,
        tour.venue,
        tour.date,
        tour.capacity,
        tour.price,
        tour.vipPrice,
        tour.guests
      ]);
    }
    
    console.log(`✅ Seeded ${TOUR_DATES_2026.length} tour dates!`);
    
    // Show summary
    const result = await pool.query('SELECT COUNT(*) as count FROM tours');
    console.log(`📊 Total tours in database: ${result.rows[0].count}`);
    
  } catch (err) {
    console.error('❌ Error seeding tours:', err.message);
  } finally {
    await pool.end();
  }
}

seedTours();
EOF

# 3. Run seed script
echo "🌱 Seeding tour data..."
node seed-tour-2026.js

# 4. Copy website to public folder
echo "📄 Setting up website..."
cp ~/morgan-wallen-bot/public/admin.html ~/morgan-wallen-bot/public/admin-backup.html 2>/dev/null || true

# Download the tour website (you'll need to save the HTML artifact content)
echo "⚠️  Please save the 'Still The Problem Tour 2026 - Website' artifact as:"
echo "   ~/morgan-wallen-bot/public/index.html"

# 5. Update bot.js with tour commands (backup first)
echo "🔄 Backing up bot.js..."
cp bot.js bot.js.tour-backup

echo ""
echo "✅ Tour integration setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Save the tour website HTML artifact to: public/index.html"
echo "2. Add tour commands code to your bot.js"
echo "3. Restart bot: node bot.js"
echo "4. Test commands: /tour, /nextshow, /cityshows"
echo ""
echo "🌐 Website will be at: http://localhost:3000"
echo "🤖 Bot commands:"
echo "   /tour - Show all tour dates"
echo "   /nextshow - Next upcoming show"
echo "   /cityshows - Find shows by city"
echo ""
