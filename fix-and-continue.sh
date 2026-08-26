#!/bin/bash

#####################################################################
# Fix and Continue Deployment
# VPS: 192.34.61.246
# Domain: jegbrowser.com
#####################################################################

set -e

VPS_IP="192.34.61.246"
DOMAIN="jegbrowser.com"
SSH_USER="root"
PROJECT_DIR="/var/www/$DOMAIN"
LOCAL_CODE="./php-api-server"
DB_BACKUP="./gryjeqlb_ipprofiles.sql.gz"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

echo "=========================================="
echo "Fix and Continue Deployment"
echo "=========================================="
echo ""

#####################################################################
# Step 1: Wait for MySQL to be ready
#####################################################################
print_info "Step 1: Checking MySQL installation..."

ssh $SSH_USER@$VPS_IP 'bash -s' <<'ENDSSH'
set -e

# Wait for dpkg to finish
echo "→ Waiting for package manager..."
while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 ; do
    sleep 2
done

# Check if MySQL is installed
if ! command -v mysql &> /dev/null; then
    echo "→ MySQL not found, installing..."
    export DEBIAN_FRONTEND=noninteractive
    apt install -y mysql-server
fi

# Start MySQL
systemctl start mysql
systemctl enable mysql

# Wait for MySQL to be ready
echo "→ Waiting for MySQL to start..."
for i in {1..30}; do
    if mysqladmin ping -h localhost --silent; then
        echo "✓ MySQL is ready"
        break
    fi
    sleep 2
done

echo "✓ MySQL is running"
ENDSSH

print_success "MySQL is ready"
echo ""

#####################################################################
# Step 2: Create Database
#####################################################################
print_info "Step 2: Creating database..."

DB_PASSWORD=$(openssl rand -base64 16)

ssh $SSH_USER@$VPS_IP "bash -s" <<ENDSSH
set -e

# Create database and user
mysql -e "CREATE DATABASE IF NOT EXISTS jeg_profiles CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS 'jeg_user'@'localhost' IDENTIFIED BY '$DB_PASSWORD';"
mysql -e "GRANT ALL PRIVILEGES ON jeg_profiles.* TO 'jeg_user'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

echo "✓ Database created"
ENDSSH

print_success "Database created: jeg_profiles"
echo "Database password: $DB_PASSWORD"
echo ""

#####################################################################
# Step 3: Upload and Import Database
#####################################################################
print_info "Step 3: Uploading and importing database..."

if [ ! -f "$DB_BACKUP" ]; then
    print_error "Database backup not found: $DB_BACKUP"
    exit 1
fi

scp $DB_BACKUP $SSH_USER@$VPS_IP:/tmp/database.sql.gz

ssh $SSH_USER@$VPS_IP "bash -s" <<ENDSSH
set -e
cd /tmp
gunzip -f database.sql.gz
mysql -u jeg_user -p'$DB_PASSWORD' jeg_profiles < database.sql
rm -f database.sql
echo "✓ Database imported"
ENDSSH

print_success "Database imported"
echo ""

#####################################################################
# Step 4: Create Project Directory
#####################################################################
print_info "Step 4: Creating project directory..."

ssh $SSH_USER@$VPS_IP "bash -s" <<ENDSSH
set -e
mkdir -p $PROJECT_DIR
chown -R www-data:www-data $PROJECT_DIR
echo "✓ Project directory created"
ENDSSH

print_success "Project directory created"
echo ""

#####################################################################
# Step 5: Upload Code
#####################################################################
print_info "Step 5: Uploading application code..."

if [ ! -d "$LOCAL_CODE" ]; then
    print_error "Code directory not found: $LOCAL_CODE"
    exit 1
fi

rsync -avz --exclude 'vendor' --exclude '.git' --exclude 'node_modules' \
    $LOCAL_CODE/ $SSH_USER@$VPS_IP:$PROJECT_DIR/

print_success "Code uploaded"
echo ""

#####################################################################
# Step 6: Install Dependencies
#####################################################################
print_info "Step 6: Installing Composer dependencies..."

ssh $SSH_USER@$VPS_IP "bash -s" <<ENDSSH
set -e
cd $PROJECT_DIR
composer install --no-dev --optimize-autoloader
chown -R www-data:www-data $PROJECT_DIR
echo "✓ Dependencies installed"
ENDSSH

print_success "Dependencies installed"
echo ""

#####################################################################
# Step 7: Create .env File
#####################################################################
print_info "Step 7: Creating .env file..."

ENCRYPTION_KEY=$(openssl rand -base64 32)

ssh $SSH_USER@$VPS_IP "bash -s" <<ENDSSH
set -e

cat > $PROJECT_DIR/.env <<'EOF'
# Database Configuration
DB_HOST=localhost
DB_NAME=jeg_profiles
DB_USERNAME=jeg_user
DB_PASSWORD=$DB_PASSWORD

# GoLogin API
GOLOGIN_API_TOKEN=your_gologin_api_token_here

# Security
ENCRYPTION_KEY=$ENCRYPTION_KEY

# Environment
ENVIRONMENT=production

# Firebase
FIREBASE_PROJECT_ID=jeg-profiles-77907
EOF

chmod 600 $PROJECT_DIR/.env
chown www-data:www-data $PROJECT_DIR/.env
echo "✓ .env file created"
ENDSSH

print_success ".env file created"
echo ""

#####################################################################
# Step 8: Configure Nginx
#####################################################################
print_info "Step 8: Configuring Nginx..."

ssh $SSH_USER@$VPS_IP "bash -s" <<ENDSSH
set -e

cat > /etc/nginx/sites-available/$DOMAIN <<'NGINXCONF'
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
    
    root $PROJECT_DIR;
    index index.php index.html;

    access_log /var/log/nginx/${DOMAIN}-access.log;
    error_log /var/log/nginx/${DOMAIN}-error.log;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With" always;

    if (\$request_method = 'OPTIONS') {
        return 204;
    }

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_read_timeout 300;
        fastcgi_send_timeout 300;
    }

    location ~ /\.env {
        deny all;
    }

    location ~ /\.ht {
        deny all;
    }

    location ~ /\.git {
        deny all;
    }

    location ~ \.log$ {
        deny all;
    }

    autoindex off;
    client_max_body_size 10M;
}
NGINXCONF

sed -i "s|\\\$DOMAIN|$DOMAIN|g" /etc/nginx/sites-available/$DOMAIN
sed -i "s|\\\$PROJECT_DIR|$PROJECT_DIR|g" /etc/nginx/sites-available/$DOMAIN

ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx

echo "✓ Nginx configured"
ENDSSH

print_success "Nginx configured"
echo ""

#####################################################################
# Step 9: Setup Firewall
#####################################################################
print_info "Step 9: Configuring firewall..."

ssh $SSH_USER@$VPS_IP "bash -s" <<ENDSSH
set -e
ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
echo "✓ Firewall configured"
ENDSSH

print_success "Firewall configured"
echo ""

#####################################################################
# Step 10: Install SSL Certificate
#####################################################################
print_info "Step 10: Installing SSL certificate..."

echo "Enter email for SSL certificate:"
read SSL_EMAIL

ssh $SSH_USER@$VPS_IP "bash -s" <<ENDSSH
set -e
certbot --nginx -d $DOMAIN -d www.$DOMAIN \
    --non-interactive --agree-tos --email $SSL_EMAIL --redirect
echo "✓ SSL certificate installed"
ENDSSH

print_success "SSL certificate installed"
echo ""

#####################################################################
# Step 11: Set Permissions
#####################################################################
print_info "Step 11: Setting permissions..."

ssh $SSH_USER@$VPS_IP "bash -s" <<ENDSSH
set -e
cd $PROJECT_DIR
chown -R www-data:www-data .
find . -type d -exec chmod 755 {} \;
find . -type f -exec chmod 644 {} \;
chmod 600 .env
echo "✓ Permissions set"
ENDSSH

print_success "Permissions set"
echo ""

#####################################################################
# Step 12: Test API
#####################################################################
print_info "Step 12: Testing API..."

sleep 3

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/)
if [ "$HTTP_CODE" = "200" ]; then
    print_success "API is working! (HTTP $HTTP_CODE)"
else
    print_error "API test failed (HTTP $HTTP_CODE)"
fi
echo ""

#####################################################################
# Summary
#####################################################################
echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
print_success "Application deployed successfully"
echo ""
echo "URLs:"
echo "  - Main: https://$DOMAIN/"
echo "  - API: https://$DOMAIN/api/"
echo ""
echo "Database:"
echo "  - Name: jeg_profiles"
echo "  - User: jeg_user"
echo "  - Password: $DB_PASSWORD"
echo ""
echo "IMPORTANT: Update GoLogin API token:"
echo "  ssh $SSH_USER@$VPS_IP"
echo "  nano $PROJECT_DIR/.env"
echo "  # Update GOLOGIN_API_TOKEN"
echo ""
echo "Next steps:"
echo "1. Update GoLogin API token in .env"
echo "2. Test API: https://$DOMAIN/api/"
echo "3. Update Electron app:"
echo "   API_BASE_URL=https://$DOMAIN/api"
echo ""
print_info "Save database password securely!"
echo ""
