// Admin API Backend for Web Dashboard
// Add this to your bot.js or create as separate file: admin-api.js

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const adminRouter = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// ============================================
// AUTHENTICATION ENDPOINTS
// ============================================

// Admin Login
adminRouter.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find admin by telegram_id or email
    const result = await pool.query(
      'SELECT * FROM admins WHERE email = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const admin = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, admin.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: admin.id, telegram_id: admin.telegram_id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify Token
adminRouter.get('/api/admin/verify', authenticateToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

// ============================================
// DASHBOARD STATS
// ============================================

adminRouter.get('/api/admin/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM users'),
      pool.query('SELECT COUNT(*) as active FROM users WHERE last_active > NOW() - INTERVAL \'24 hours\''),
      pool.query('SELECT COUNT(*) as total FROM bookings'),
      pool.query('SELECT COUNT(*) as pending FROM bookings WHERE status = $1', ['pending']),
      pool.query('SELECT SUM(amount) as revenue FROM bookings WHERE payment_status = $1', ['paid']),
      pool.query('SELECT SUM(amount) as monthly_revenue FROM bookings WHERE payment_status = $1 AND created_at > NOW() - INTERVAL \'30 days\'', ['paid']),
      pool.query('SELECT COUNT(*) as total FROM ticket_purchases WHERE status = $1', ['completed']),
      pool.query('SELECT SUM(total_amount) as ticket_revenue FROM ticket_purchases WHERE status = $1', ['completed'])
    ]);

    res.json({
      totalUsers: parseInt(stats[0].rows[0].total),
      activeUsers: parseInt(stats[1].rows[0].active),
      totalBookings: parseInt(stats[2].rows[0].total),
      pendingBookings: parseInt(stats[3].rows[0].pending),
      totalRevenue: parseFloat(stats[4].rows[0].revenue || 0),
      monthlyRevenue: parseFloat(stats[5].rows[0].monthly_revenue || 0),
      ticketsSold: parseInt(stats[6].rows[0].total),
      ticketRevenue: parseFloat(stats[7].rows[0].ticket_revenue || 0)
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ============================================
// BOOKINGS MANAGEMENT
// ============================================

// Get all bookings
adminRouter.get('/api/admin/bookings', authenticateToken, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT b.*, u.first_name, u.last_name, u.email, u.phone, u.telegram_id
      FROM bookings b
      JOIN users u ON b.user_id = u.id
    `;

    const params = [];
    if (status) {
      query += ' WHERE b.status = $1';
      params.push(status);
    }

    query += ' ORDER BY b.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      bookings: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Bookings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Approve booking
adminRouter.post('/api/admin/bookings/:id/approve', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get booking details
    const booking = await pool.query(
      `SELECT b.*, u.* FROM bookings b 
       JOIN users u ON b.user_id = u.id 
       WHERE b.id = $1`,
      [id]
    );

    if (booking.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const bookingData = booking.rows[0];

    // Update status
    await pool.query(
      'UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2',
      ['confirmed', id]
    );

    // TODO: Send notification to user via Telegram bot
    // TODO: Create calendar event
    // TODO: Send email confirmation

    res.json({
      success: true,
      message: 'Booking approved successfully'
    });
  } catch (error) {
    console.error('Approve booking error:', error);
    res.status(500).json({ error: 'Failed to approve booking' });
  }
});

// Reject booking
adminRouter.post('/api/admin/bookings/:id/reject', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await pool.query(
      'UPDATE bookings SET status = $1, notes = $2, updated_at = NOW() WHERE id = $3',
      ['rejected', reason, id]
    );

    // TODO: Send notification to user

    res.json({
      success: true,
      message: 'Booking rejected'
    });
  } catch (error) {
    console.error('Reject booking error:', error);
    res.status(500).json({ error: 'Failed to reject booking' });
  }
});

// ============================================
// USER MANAGEMENT
// ============================================

// Get all users
adminRouter.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    const { search, membership, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM users WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (search) {
      query += ` AND (first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    if (membership) {
      query += ` AND membership_tier = $${paramCount}`;
      params.push(membership);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      users: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user details
adminRouter.get('/api/admin/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const bookings = await pool.query(
      'SELECT * FROM bookings WHERE user_id = $1 ORDER BY created_at DESC',
      [id]
    );

    const tickets = await pool.query(
      'SELECT tp.*, t.city, t.venue, t.date FROM ticket_purchases tp JOIN tours t ON tp.tour_id = t.id WHERE tp.user_id = $1',
      [id]
    );

    res.json({
      user: user.rows[0],
      bookings: bookings.rows,
      tickets: tickets.rows
    });
  } catch (error) {
    console.error('User details error:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// ============================================
// TOUR MANAGEMENT
// ============================================

// Get all tours
adminRouter.get('/api/admin/tours', authenticateToken, async (req, res) => {
  try {
    const { status = 'active' } = req.query;

    const result = await pool.query(
      'SELECT * FROM tours WHERE status = $1 ORDER BY date ASC',
      [status]
    );

    res.json({ tours: result.rows });
  } catch (error) {
    console.error('Tours fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch tours' });
  }
});

// Add new tour
adminRouter.post('/api/admin/tours', authenticateToken, async (req, res) => {
  try {
    const {
      city,
      state,
      country,
      venue,
      venue_address,
      date,
      doors_open,
      show_start,
      tickets_available,
      ticket_price,
      vip_price,
      description
    } = req.body;

    const result = await pool.query(
      `INSERT INTO tours (
        city, state, country, venue, venue_address, date, doors_open, 
        show_start, tickets_available, ticket_price, vip_price, description, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active') 
      RETURNING *`,
      [city, state, country, venue, venue_address, date, doors_open, 
       show_start, tickets_available, ticket_price, vip_price, description]
    );

    res.json({
      success: true,
      tour: result.rows[0]
    });
  } catch (error) {
    console.error('Add tour error:', error);
    res.status(500).json({ error: 'Failed to add tour' });
  }
});

// Update tour
adminRouter.put('/api/admin/tours/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 1}`)
      .join(', ');

    const values = [...Object.values(updates), id];

    await pool.query(
      `UPDATE tours SET ${setClause} WHERE id = $${values.length}`,
      values
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update tour error:', error);
    res.status(500).json({ error: 'Failed to update tour' });
  }
});

// Delete tour
adminRouter.delete('/api/admin/tours/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('UPDATE tours SET status = $1 WHERE id = $2', ['cancelled', id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete tour error:', error);
    res.status(500).json({ error: 'Failed to delete tour' });
  }
});

// ============================================
// ANALYTICS
// ============================================

// Get revenue analytics
adminRouter.get('/api/admin/analytics/revenue', authenticateToken, async (req, res) => {
  try {
    const { period = '30d' } = req.query;

    let interval;
    switch (period) {
      case '7d': interval = '7 days'; break;
      case '30d': interval = '30 days'; break;
      case '90d': interval = '90 days'; break;
      case '1y': interval = '1 year'; break;
      default: interval = '30 days';
    }

    const revenue = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        SUM(amount) as revenue,
        COUNT(*) as count
      FROM bookings
      WHERE payment_status = 'paid' 
      AND created_at > NOW() - INTERVAL '${interval}'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    res.json({ data: revenue.rows });
  } catch (error) {
    console.error('Revenue analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get user growth analytics
adminRouter.get('/api/admin/analytics/users', authenticateToken, async (req, res) => {
  try {
    const growth = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as new_users
      FROM users
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    res.json({ data: growth.rows });
  } catch (error) {
    console.error('User analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get event analytics
adminRouter.get('/api/admin/analytics/events', authenticateToken, async (req, res) => {
  try {
    const events = await pool.query(`
      SELECT 
        event_type,
        COUNT(*) as count,
        DATE(created_at) as date
      FROM analytics
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY event_type, DATE(created_at)
      ORDER BY date DESC, count DESC
    `);

    res.json({ data: events.rows });
  } catch (error) {
    console.error('Event analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ============================================
// BROADCAST
// ============================================

// Send broadcast message
adminRouter.post('/api/admin/broadcast', authenticateToken, async (req, res) => {
  try {
    const { title, message, audience, scheduled_for } = req.body;

    // Insert announcement
    const result = await pool.query(
      `INSERT INTO announcements (title, message, target_audience, scheduled_for, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title, message, audience, scheduled_for, req.user.id]
    );

    // If not scheduled, send immediately
    if (!scheduled_for) {
      let users;
      
      switch (audience) {
        case 'all':
          users = await pool.query('SELECT telegram_id FROM users');
          break;
        case 'vip':
          users = await pool.query('SELECT telegram_id FROM users WHERE membership_tier IN ($1, $2, $3)', ['silver', 'gold', 'platinum']);
          break;
        case 'platinum':
          users = await pool.query('SELECT telegram_id FROM users WHERE membership_tier = $1', ['platinum']);
          break;
        case 'ticket_holders':
          users = await pool.query('SELECT DISTINCT u.telegram_id FROM users u JOIN ticket_purchases tp ON u.id = tp.user_id WHERE tp.status = $1', ['completed']);
          break;
      }

      // TODO: Send via Telegram bot to all users
      // This would integrate with your bot instance

      await pool.query('UPDATE announcements SET sent = true WHERE id = $1', [result.rows[0].id]);
    }

    res.json({
      success: true,
      announcement: result.rows[0]
    });
  } catch (error) {
    console.error('Broadcast error:', error);
    res.status(500).json({ error: 'Failed to send broadcast' });
  }
});

// ============================================
// SETTINGS
// ============================================

// Get settings
adminRouter.get('/api/admin/settings', authenticateToken, async (req, res) => {
  try {
    // Return configuration settings
    res.json({
      pricing: {
        voice_call: 199.99,
        video_call: 499.99,
        meet_greet: 299.99
      },
      memberships: {
        silver: { price: 9.99, discount: 0.05 },
        gold: { price: 29.99, discount: 0.10 },
        platinum: { price: 99.99, discount: 0.20 }
      }
    });
  } catch (error) {
    console.error('Settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update settings
adminRouter.put('/api/admin/settings', authenticateToken, async (req, res) => {
  try {
    const { pricing, memberships } = req.body;

    // TODO: Store settings in database or config file
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ============================================
// EXPORT TO APP
// ============================================

module.exports = adminRouter;

// To use in your main bot.js:
// const adminRouter = require('./admin-api');
// app.use(adminRouter);
