-- Complete Database Schema
-- Run this if you need to manually set up the database

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  birthday DATE,
  membership_tier VARCHAR(50) DEFAULT 'free',
  membership_expires TIMESTAMP,
  stripe_customer_id VARCHAR(255),
  total_spent DECIMAL(10, 2) DEFAULT 0,
  loyalty_points INTEGER DEFAULT 0,
  referral_code VARCHAR(50) UNIQUE,
  referred_by INTEGER REFERENCES users(id),
  notifications_enabled BOOLEAN DEFAULT true,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP DEFAULT NOW()
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  booking_type VARCHAR(50) NOT NULL,
  booking_date TIMESTAMP,
  duration INTEGER DEFAULT 15,
  status VARCHAR(50) DEFAULT 'pending',
  payment_status VARCHAR(50) DEFAULT 'unpaid',
  amount DECIMAL(10, 2),
  stripe_payment_id VARCHAR(255),
  google_calendar_event_id VARCHAR(255),
  zoom_meeting_id VARCHAR(255),
  zoom_meeting_url TEXT,
  notes TEXT,
  reminder_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tours table
CREATE TABLE IF NOT EXISTS tours (
  id SERIAL PRIMARY KEY,
  city VARCHAR(255) NOT NULL,
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'USA',
  venue VARCHAR(255) NOT NULL,
  venue_address TEXT,
  date TIMESTAMP NOT NULL,
  doors_open TIME,
  show_start TIME,
  tickets_available INTEGER DEFAULT 0,
  tickets_sold INTEGER DEFAULT 0,
  ticket_price DECIMAL(10, 2),
  vip_price DECIMAL(10, 2),
  status VARCHAR(50) DEFAULT 'active',
  image_url TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Ticket purchases
CREATE TABLE IF NOT EXISTS ticket_purchases (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  tour_id INTEGER REFERENCES tours(id),
  ticket_type VARCHAR(50) DEFAULT 'general',
  quantity INTEGER DEFAULT 1,
  total_amount DECIMAL(10, 2),
  stripe_payment_id VARCHAR(255),
  qr_code TEXT,
  seat_numbers TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  scanned_at TIMESTAMP,
  purchased_at TIMESTAMP DEFAULT NOW()
);

-- Admins table
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  role VARCHAR(50) DEFAULT 'admin',
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Loyalty transactions
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  points INTEGER NOT NULL,
  reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Exclusive content
CREATE TABLE IF NOT EXISTS exclusive_content (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  required_tier VARCHAR(50) DEFAULT 'free',
  content_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Analytics
CREATE TABLE IF NOT EXISTS analytics (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  user_id INTEGER REFERENCES users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255),
  message TEXT,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_membership ON users(membership_tier);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_tours_date ON tours(date);
CREATE INDEX IF NOT EXISTS idx_tours_status ON tours(status);
CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics(created_at);

-- Insert sample admin (password: admin123)
INSERT INTO admins (telegram_id, email, password_hash, role)
VALUES (123456789, 'admin@example.com', '$2b$10$rQHzE8LU7vqjQZ0Y4qZ0YuN5nqZ0Y4qZ0YuN5nqZ0Y4qZ0YuN5nq', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Insert sample tour
INSERT INTO tours (city, state, venue, date, tickets_available, ticket_price, vip_price)
VALUES ('Nashville', 'TN', 'Bridgestone Arena', '2026-06-15 20:00:00', 5000, 89.99, 149.99)
ON CONFLICT DO NOTHING;

COMMIT;
