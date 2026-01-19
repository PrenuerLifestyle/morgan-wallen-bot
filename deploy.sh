#!/bin/bash

# Morgan Wallen Celebrity Bot - One-Click Deployment Script
# This script sets up everything automatically

set -e  # Exit on error

echo "🎸 Morgan Wallen Celebrity Bot - Deployment Script"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ] && [ "$1" != "local" ]; then 
  echo -e "${YELLOW}Warning: Some operations may require sudo${NC}"
fi

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Check Node.js installation
check_nodejs() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        print_success "Node.js installed: $NODE_VERSION"
    else
        print_error "Node.js not found!"
        print_info "Installing Node.js..."
        
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            brew install node
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Linux
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
        fi
        
        print_success "Node.js installed!"
    fi
}

# Check PostgreSQL installation
check_postgresql() {
    if command -v psql &> /dev/null; then
        print_success "PostgreSQL installed"
    else
        print_info "PostgreSQL not found. Install it manually or use cloud database."
        print_info "Cloud options: Railway, Supabase, Heroku Postgres"
    fi
}

# Check Redis installation
check_redis() {
    if command -v redis-cli &> /dev/null; then
        print_success "Redis installed"
    else
        print_info "Redis not found. Installing..."
        
        if [[ "$OSTYPE" == "darwin"* ]]; then
            brew install redis
            brew services start redis
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            sudo apt-get install -y redis-server
            sudo systemctl start redis
        fi
        
        print_success "Redis installed!"
    fi
}

# Create project structure
create_structure() {
    print_info "Creating project structure..."
    
    mkdir -p backups
    mkdir -p logs
    mkdir -p public
    mkdir -p scripts
    
    print_success "Project structure created"
}

# Install dependencies
install_dependencies() {
    print_info "Installing dependencies..."
    
    npm install
    
    print_success "Dependencies installed!"
}

# Create .env from template
create_env() {
    if [ ! -f .env ]; then
        print_info "Creating .env file..."
        
        cat > .env << 'EOF'
# Telegram Bot Configuration
BOT_TOKEN=YOUR_BOT_TOKEN_HERE

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/morganwallen_bot

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_YOUR_KEY
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Google Calendar
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback
GOOGLE_REFRESH_TOKEN=your-refresh-token

# Zoom Configuration
ZOOM_ACCOUNT_ID=your-account-id
ZOOM_CLIENT_ID=your-client-id
ZOOM_CLIENT_SECRET=your-client-secret

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Server Configuration
PORT=3000
NODE_ENV=development
APP_URL=http://localhost:3000

# JWT Secret
JWT_SECRET=change-this-to-random-secret-in-production
EOF
        
        print_success ".env file created"
        print_info "⚠️  IMPORTANT: Edit .env with your actual credentials!"
    else
        print_info ".env file already exists"
    fi
}

# Initialize database
init_database() {
    print_info "Initializing database..."
    
    if [ -f "bot.js" ]; then
        node -e "
        require('dotenv').config();
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        console.log('Testing database connection...');
        pool.query('SELECT NOW()', (err, res) => {
            if (err) {
                console.error('Database connection failed:', err.message);
                process.exit(1);
            }
            console.log('Database connected successfully!');
            pool.end();
        });
        "
        print_success "Database initialized"
    fi
}

# Create admin user
create_admin() {
    echo ""
    read -p "Enter your Telegram ID (get it from @userinfobot): " TELEGRAM_ID
    
    if [ ! -z "$TELEGRAM_ID" ]; then
        print_info "Creating admin user..."
        
        node -e "
        require('dotenv').config();
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        pool.query(
            'INSERT INTO admins (telegram_id, role) VALUES (\$1, \$2) ON CONFLICT DO NOTHING',
            [$TELEGRAM_ID, 'admin'],
            (err) => {
                if (err) {
                    console.error('Error creating admin:', err.message);
                } else {
                    console.log('Admin user created!');
                }
                pool.end();
            }
        );
        "
        print_success "Admin user created"
    fi
}

# Start bot
start_bot() {
    print_info "Starting bot..."
    
    if command -v pm2 &> /dev/null; then
        pm2 start bot.js --name morgan-wallen-bot
        pm2 save
        print_success "Bot started with PM2"
        print_info "Manage with: pm2 logs morgan-wallen-bot"
    else
        print_info "PM2 not found. Install with: npm install -g pm2"
        print_info "Starting with node..."
        node bot.js &
        print_success "Bot started"
    fi
}

# Deploy to Railway
deploy_railway() {
    print_info "Deploying to Railway..."
    
    if ! command -v railway &> /dev/null; then
        print_info "Installing Railway CLI..."
        npm install -g @railway/cli
    fi
    
    railway login
    railway init
    railway up
    
    print_success "Deployed to Railway!"
    print_info "Set environment variables in Railway dashboard"
}

# Deploy to Heroku
deploy_heroku() {
    print_info "Deploying to Heroku..."
    
    if ! command -v heroku &> /dev/null; then
        print_error "Heroku CLI not found. Install from: https://devcenter.heroku.com/articles/heroku-cli"
        exit 1
    fi
    
    heroku login
    heroku create morgan-wallen-bot
    heroku addons:create heroku-postgresql:mini
    heroku addons:create heroku-redis:mini
    
    git push heroku main
    
    print_success "Deployed to Heroku!"
    print_info "Set environment variables with: heroku config:set KEY=value"
}

# Main menu
main_menu() {
    echo ""
    echo "Select deployment option:"
    echo "1) Local Development Setup"
    echo "2) Deploy to Railway"
    echo "3) Deploy to Heroku"
    echo "4) Production Server Setup (VPS)"
    echo "5) Exit"
    echo ""
    read -p "Enter option (1-5): " option
    
    case $option in
        1)
            print_info "Setting up local development..."
            check_nodejs
            check_postgresql
            check_redis
            create_structure
            install_dependencies
            create_env
            init_database
            create_admin
            
            echo ""
            print_success "🎉 Local setup complete!"
            print_info "Next steps:"
            print_info "1. Edit .env with your credentials"
            print_info "2. Run: npm start"
            print_info "3. Test bot in Telegram"
            ;;
        2)
            deploy_railway
            ;;
        3)
            deploy_heroku
            ;;
        4)
            print_info "Production setup..."
            check_nodejs
            check_postgresql
            check_redis
            create_structure
            install_dependencies
            
            # Install PM2
            npm install -g pm2
            
            init_database
            create_admin
            start_bot
            
            print_success "🎉 Production setup complete!"
            print_info "Bot is running with PM2"
            print_info "Logs: pm2 logs morgan-wallen-bot"
            ;;
        5)
            exit 0
            ;;
        *)
            print_error "Invalid option"
            main_menu
            ;;
    esac
}

# Run main menu
main_menu
