require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const tours = [
  { city: 'Tampa', venue: 'Raymond James Stadium', date: '2026-05-08', tickets_available: 65000, special_guests: 'Bailey Zimmerman, Ella Langley' },
  { city: 'Philadelphia', venue: 'Lincoln Financial Field', date: '2026-05-15', tickets_available: 69000, special_guests: 'Bailey Zimmerman, Ella Langley' },
  { city: 'Chicago', venue: 'Soldier Field', date: '2026-05-22', tickets_available: 61500, special_guests: 'Bailey Zimmerman, Ella Langley' },
  { city: 'Detroit', venue: 'Ford Field', date: '2026-05-29', tickets_available: 65000, special_guests: 'Bailey Zimmerman, Ella Langley' },
  { city: 'Denver', venue: 'Empower Field', date: '2026-06-05', tickets_available: 76125, special_guests: 'Bailey Zimmerman, Ella Langley' },
  { city: 'Seattle', venue: 'Lumen Field', date: '2026-06-12', tickets_available: 69000, special_guests: 'Bailey Zimmerman, Ella Langley' },
  { city: 'San Francisco', venue: 'Oracle Park', date: '2026-06-19', tickets_available: 41915, special_guests: 'Bailey Zimmerman, Ella Langley' },
  { city: 'Los Angeles', venue: 'SoFi Stadium', date: '2026-06-26', tickets_available: 70000, special_guests: 'Bailey Zimmerman, Ella Langley' },
  { city: 'Phoenix', venue: 'State Farm Stadium', date: '2026-07-10', tickets_available: 63400, special_guests: 'Bailey Zimmerman, Ella Langley' },
  { city: 'Dallas', venue: 'AT&T Stadium', date: '2026-07-17', tickets_available: 80000, special_guests: 'Bailey Zimmerman, Ella Langley' },
  { city: 'Houston', venue: 'NRG Stadium', date: '2026-07-24', tickets_available: 72220, special_guests: 'Bailey Zimmerman, Ella Langley' }
];

async function addTours() {
  try {
    for (const t of tours) {
      await pool.query(
        `INSERT INTO tours (city, venue, date, tickets_available, special_guests) 
         VALUES ($1, $2, $3, $4, $5)`,
        [t.city, t.venue, t.date, t.tickets_available, t.special_guests]
      );
      console.log(`✅ Added: ${t.city} - ${t.venue}`);
    }
    console.log('\n🎸 All 11 tour dates added successfully!');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

addTours();
