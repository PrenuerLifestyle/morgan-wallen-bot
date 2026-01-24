#!/data/data/com.termux/files/usr/bin/bash

# 🔍 Morgan Wallen Bot - Project Status Checker & Auto-Fixer
# This script checks your project and fixes missing files/services

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Emojis
CHECK="✅"
CROSS="❌"
WARN="⚠️"
INFO="ℹ️"
ROCKET="🚀"

# Counters
ISSUES=0
FIXED=0

print_header() {
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_success() { echo -e "${GREEN}${CHECK} $1${NC}"; }
print_error() { echo -e "${RED}${CROSS} $1${NC}"; ISSUES=$((ISSUES + 1)); }
print_warn() { echo -e "${YELLOW}${WARN} $1${NC}"; }
print_info() { echo -e "${BLUE}${INFO} $1${NC}"; }
print_fixed() { echo -e "${GREEN}${ROCKET} $1${NC}"; FIXED=$((FIXED + 1)); }

# Check and fix function
check_and_fix() {
    local name=$1
    local check_cmd=$2
    local fix_cmd=$3
    local description=$4
    
    echo -e "\n${CYAN}Checking: $name${NC}"
    
    if eval "$check_cmd" &>/dev/null; then
        print_success "$name is OK"
        return 0
    else
        print_error "$name is missing or not working"
        
        if [ -n "$fix_cmd" ]; then
            print_info "Attempting to fix: $description"
            if eval "$fix_cmd"; then
                print_fixed "$name fixed successfully!"
                return 0
            else
                print_error "Failed to fix $name automatically"
                return 1
            fi
        fi
        return 1
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MAIN CHECKS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

print_header "🔍 PROJECT STATUS CHECK - Morgan Wallen Bot"

# 1. Check if in project directory
echo -e "${CYAN}Current directory:${NC} $(pwd)"
if [ ! -f "package.json" ]; then
    print_error "Not in project directory (package.json not found)"
    print_info "Please cd to your project directory first"
    exit 1
fi
print_success "In correct project directory"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. CHECK REQUIRED FILES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

print_header "📁 CHECKING REQUIRED FILES"

FILES=(
    "package.json:Project configuration"
    "bot.js:Main bot application"
    ".env:Environment configuration"
    "init-db.js:Database initialization"
    "create-admin.js:Admin creation script"
)

for item in "${FILES[@]}"; do
    IFS=':' read -r file desc <<< "$item"
    if [ -f "$file" ]; then
        print_success "$file - $desc"
    else
        print_error "Missing: $file - $desc"
    fi
done

# Check directories
print_info "Checking directories..."
DIRS=("public" "scripts" "logs" "node_modules")
for dir in "${DIRS[@]}"; do
    if [ -d "$dir" ]; then
        print_success "Directory: $dir"
    else
        print_warn "Missing directory: $dir"
        mkdir -p "$dir"
        print_fixed "Created directory: $dir"
    fi
done

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. CHECK NODE.JS & NPM
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

print_header "🟢 CHECKING NODE.JS"

check_and_fix "Node.js" \
    "command -v node" \
    "pkg install nodejs -y" \
    "Installing Node.js"

if command -v node &>/dev/null; then
    NODE_VERSION=$(node -v)
    print_info "Node.js version: $NODE_VERSION"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. CHECK NODE_MODULES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

print_header "📦 CHECKING NPM PACKAGES"

if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
    print_error "node_modules missing or empty"
    print_info "Installing dependencies..."
    if npm install; then
        print_fixed "Dependencies installed successfully!"
    else
        print_error "Failed to install dependencies"
    fi
else
    print_success "node_modules exists"
    
    # Check critical packages
    CRITICAL_PKGS=("telegraf" "pg" "express" "dotenv" "stripe")
    for pkg in "${CRITICAL_PKGS[@]}"; do
        if [ -d "node_modules/$pkg" ]; then
            print_success "Package: $pkg"
        else
            print_warn "Missing package: $pkg"
        fi
    done
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. CHECK POSTGRESQL
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

print_header "🐘 CHECKING POSTGRESQL"

check_and_fix "PostgreSQL" \
    "command -v psql" \
    "pkg install postgresql -y" \
    "Installing PostgreSQL"

if command -v psql &>/dev/null; then
    # Check if initialized
    if [ ! -d "$PREFIX/var/lib/postgresql/base" ]; then
        print_warn "PostgreSQL not initialized"
        print_info "Initializing PostgreSQL..."
        rm -rf $PREFIX/var/lib/postgresql
        mkdir -p $PREFIX/var/lib/postgresql
        if initdb $PREFIX/var/lib/postgresql; then
            print_fixed "PostgreSQL initialized!"
        fi
    else
        print_success "PostgreSQL initialized"
    fi
    
    # Check if running
    if pg_ctl -D $PREFIX/var/lib/postgresql status &>/dev/null; then
        print_success "PostgreSQL is running"
    else
        print_warn "PostgreSQL is not running"
        print_info "Starting PostgreSQL..."
        if pg_ctl -D $PREFIX/var/lib/postgresql start; then
            sleep 2
            print_fixed "PostgreSQL started!"
        else
            print_error "Failed to start PostgreSQL"
        fi
    fi
    
    # Check if database exists
    if psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw morganwallen_bot; then
        print_success "Database 'morganwallen_bot' exists"
    else
        print_warn "Database 'morganwallen_bot' does not exist"
        print_info "Creating database..."
        if createdb morganwallen_bot; then
            print_fixed "Database created!"
        fi
    fi
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 6. CHECK REDIS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

print_header "🔴 CHECKING REDIS"

check_and_fix "Redis" \
    "command -v redis-cli" \
    "pkg install redis -y" \
    "Installing Redis"

if command -v redis-cli &>/dev/null; then
    if redis-cli ping &>/dev/null; then
        print_success "Redis is running"
    else
        print_warn "Redis is not running"
        print_info "Starting Redis..."
        if redis-server --daemonize yes; then
            sleep 1
            print_fixed "Redis started!"
        fi
    fi
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 7. CHECK .ENV CONFIGURATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

print_header "⚙️  CHECKING ENVIRONMENT CONFIGURATION"

if [ -f ".env" ]; then
    print_success ".env file exists"
    
    # Check critical env vars
    CRITICAL_VARS=("BOT_TOKEN" "DATABASE_URL" "REDIS_URL")
    
    for var in "${CRITICAL_VARS[@]}"; do
        if grep -q "^${var}=" .env 2>/dev/null && ! grep -q "^${var}=YOUR_" .env 2>/dev/null; then
            VALUE=$(grep "^${var}=" .env | cut -d'=' -f2 | head -c 20)
            print_success "$var is set (${VALUE}...)"
        else
            print_error "$var is not configured"
        fi
    done
    
    # Auto-fix common issues
    if grep -q "^REDIS_URL=redis://default:password@host:port" .env; then
        print_warn "Invalid Redis URL detected"
        print_info "Fixing Redis URL..."
        sed -i 's|REDIS_URL=.*|REDIS_URL=redis://localhost:6379|' .env
        print_fixed "Redis URL fixed!"
    fi
    
    if grep -q "^DATABASE_URL=postgresql://username:password@localhost:5432" .env; then
        print_warn "Invalid Database URL detected"
        print_info "Fixing Database URL..."
        sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgresql://localhost:5432/morganwallen_bot|' .env
        print_fixed "Database URL fixed!"
    fi
    
else
    print_error ".env file missing"
    print_info "Create .env file with required configuration"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 8. TEST DATABASE CONNECTION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

print_header "🔌 TESTING DATABASE CONNECTION"

if [ -f "init-db.js" ]; then
    print_info "Testing database connection..."
    if node -e "
        require('dotenv').config();
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        pool.query('SELECT NOW()')
            .then(() => { console.log('✅ Database connection successful'); process.exit(0); })
            .catch(e => { console.log('❌ Database connection failed:', e.message); process.exit(1); });
    " 2>/dev/null; then
        print_success "Database connection working"
    else
        print_error "Cannot connect to database"
        print_info "Run: node init-db.js to initialize"
    fi
else
    print_warn "init-db.js not found"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 9. CHECK RUNNING PROCESSES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

print_header "🔄 CHECKING RUNNING PROCESSES"

if pgrep -f "node bot.js" > /dev/null; then
    PID=$(pgrep -f "node bot.js")
    print_success "Bot is running (PID: $PID)"
else
    print_warn "Bot is not running"
fi

if pgrep -f postgres > /dev/null; then
    print_success "PostgreSQL process is running"
else
    print_warn "PostgreSQL process not found"
fi

if pgrep -f redis-server > /dev/null; then
    print_success "Redis process is running"
else
    print_warn "Redis process not found"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 10. SUMMARY & RECOMMENDATIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

print_header "📊 SUMMARY"

echo -e "${CYAN}Issues found:${NC} $ISSUES"
echo -e "${GREEN}Auto-fixed:${NC} $FIXED"

if [ $ISSUES -eq 0 ]; then
    echo -e "\n${GREEN}${CHECK} All systems operational!${NC}"
    echo -e "\n${CYAN}Ready to start:${NC}"
    echo -e "  ${BLUE}node bot.js${NC}"
else
    echo -e "\n${YELLOW}${WARN} Some issues need attention${NC}"
    echo -e "\n${CYAN}Recommended actions:${NC}"
    
    if ! grep -q "^BOT_TOKEN=" .env 2>/dev/null || grep -q "^BOT_TOKEN=YOUR_" .env; then
        echo -e "  ${BLUE}1. Configure BOT_TOKEN in .env${NC}"
    fi
    
    if ! psql -lqt 2>/dev/null | grep -qw morganwallen_bot; then
        echo -e "  ${BLUE}2. Run: node init-db.js${NC}"
    fi
    
    if [ ! -d "node_modules" ]; then
        echo -e "  ${BLUE}3. Run: npm install${NC}"
    fi
fi

echo -e "\n${CYAN}Quick commands:${NC}"
echo -e "  ${BLUE}Start services: pg_ctl -D \$PREFIX/var/lib/postgresql start && redis-server --daemonize yes${NC}"
echo -e "  ${BLUE}Initialize DB:  node init-db.js${NC}"
echo -e "  ${BLUE}Create admin:   node create-admin.js${NC}"
echo -e "  ${BLUE}Start bot:      node bot.js${NC}"
echo -e "  ${BLUE}Check again:    bash check-status.sh${NC}"

echo ""
