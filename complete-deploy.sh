#!/bin/bash

#####################################################################
# Complete Deployment - All Steps
# VPS: 192.34.61.246
# Domain: jegbrowser.com
#####################################################################

set -e

VPS_IP="192.34.61.246"
DOMAIN="jegbrowser.com"
SSH_USER="root"
PROJECT_DIR="/var/www/$DOMAIN"
LOCAL_CODE="./php-api-server"
DB_PASSWORD="V0XiWD2AnXP1ycPhqE43kw=="

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
echo "Complete Deployment"
echo "=========================================="
echo ""

#####################################################################
# Step 1: Install Composer on VPS
#####################################################################
print_info "Step 1: Installing Composer..."

ssh $SSH_USER@$VPS_IP 'bash -s' <<'ENDSSH'
set -e

if ! command -v composer &> /dev/null; then
    echo "→ Installing Composer..."
    curl -sS https://getcomposer.org/installer | php
    mv composer.phar /usr/local/bin/composer
    chmod +x /usr/local/bin/composer
    echo "✓ Composer installed"
else
    echo "✓ Composer already installed"
fi

composer --version
ENDSSH

print_success "Composer ready"
echo ""

#####################################################################
# Step 2: Upload Code
#####################################################################
print_info "Step 2: Uploading application code..."

if [ ! -d "$LOCAL_CODE" ]; then
    print_error "Code directory not found: $LOCAL_CODE"
    exit 1
fi

print_info "Creating archive..."
cd "$LOCAL_CODE"
tar -czf ../app-code.tar.gz --exclude='vendor' --exclude='.git' --exclude='node_modules' .
cd ..

print_info "Uploading to VPS..."
scp app-code.tar.gz $SSH_USER@$VPS_IP:/tmp/

print_info "Extracting on VPS..."
ssh $SSH_USER@$VPS_IP "bash -s" <<ENDSSH
set -e
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR
tar -xzf /tmp/app-code.tar.gz
rm /tmp/app-code.tar.gz
chown -R www-data:www-data $PROJECT_DIR
echo "✓ Code extracted"
ENDSSH

rm app-code.tar.gz

print_success "Code uploaded"
echo ""

#####################################################################
# Step 3: Install Dependencies
#####################################################################
print_info "Step 3: Installing Composer dependencies..."

ssh $SSH_USER@$VPS_IP "bash -s" <<ENDSSH
set -e
cd $PROJECT_DIR

# Check if composer.json exists
if [ ! -f "composer.json" ]; then
    echo "✗ composer.json not found!"
    exit 1
fi

echo "→ Running composer install..."
composer install --no-dev --optimize-autoloader --no-interaction

chown -R www-data:www-data $PROJECT_DIR
echo "✓ Dependencies installed"
ENDSSH

print_success "Dependencies installed"
echo ""

#####################################################################
# Step 4: Create .env File
#####################################################################
print_info "Step 4: Creating .env file..."

ENCRYPTION_KEY=$(openssl rand -base64 32)

ssh $SSH_USER@$VPS_IP "bash -s" <<ENDSSH
set -e

cat > $PROJECT_DIR/.env <<EOF
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
# Step 5: Configure Nginx
#####################################################################
print_info "Step 5: Configuring Nginx..."

ssh $SSH_USER@$VPS_IP "bash -s" <<'ENDSSH'
set -e

cat > /etc/nginx/sites-available/jegbrowser.com <<'NGINXCONF'
server {
    listen 80;
    listen [::]:80;
    server_name jegbrowser.com www.jegbrowser.com;
    
    root /var/www/jegbrowser.com;
    index index.php index.html;

    access_log /var/log/nginx/jegbrowser.com-access.log;
    error_log /var/log/nginx/jegbrowser.com-error.log;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With" always;

    if ($request_method = 'OPTIONS') {
        return 204;
    }

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
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

ln -sf /etc/nginx/sites-available/jegbrowser.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx

echo "✓ Nginx configured"
ENDSSH

print_success "Nginx configured"
echo ""

#####################################################################
# Step 6: Setup Firewall
#####################################################################
print_info "Step 6: Configuring firewall..."

ssh $SSH_USER@$VPS_IP "bash -s" <<ENDSSH
set -e

# Check if UFW is installed
if ! command -v ufw &> /dev/null; then
    apt install -y ufw
fi

ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
echo "✓ Firewall configured"
ENDSSH

print_success "Firewall configured"
echo ""

#####################################################################
# Step 7: Install SSL Certificate
#####################################################################
print_info "Step 7: Installing SSL certificate..."

echo "Enter email for SSL certificate:"
read SSL_EMAIL

ssh $SSH_USER@$VPS_IP "bash -s" <<ENDSSH
set -e
certbot --nginx -d jegbrowser.com -d www.jegbrowser.com \
    --non-interactive --agree-tos --email $SSL_EMAIL --redirect
echo "✓ SSL certificate installed"
ENDSSH

print_success "SSL certificate installed"
echo ""

#####################################################################
# Step 8: Set Permissions
#####################################################################
print_info "Step 8: Setting permissions..."

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
# Step 9: Create Maintenance Scripts
#####################################################################
print_info "Step 9: Creating maintenance scripts..."

ssh $SSH_USER@$VPS_IP "bash -s" <<'ENDSSH'
set -e

# Backup script
mkdir -p /var/backups/mysql

cat > /usr/local/bin/backup-database.sh <<'BACKUPSCRIPT'
#!/bin/bash
BACKUP_DIR="/var/backups/mysql"
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u jeg_user -p'V0XiWD2AnXP1ycPhqE43kw==' jeg_profiles | gzip > $BACKUP_DIR/jeg_profiles_$DATE.sql.gz
find $BACKUP_DIR -name "jeg_profiles_*.sql.gz" -mtime +7 -delete
echo "Backup completed: jeg_profiles_$DATE.sql.gz"
BACKUPSCRIPT

chmod +x /usr/local/bin/backup-database.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-database.sh >> /var/log/mysql-backup.log 2>&1") | crontab -

echo "✓ Maintenance scripts created"
ENDSSH

print_success "Maintenance scripts created"
echo ""

#####################################################################
# Step 10: Test API
#####################################################################
print_info "Step 10: Testing API..."

sleep 5

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://jegbrowser.com/ 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    print_success "API is working! (HTTP $HTTP_CODE)"
elif [ "$HTTP_CODE" = "000" ]; then
    print_info "Cannot test API yet (DNS may not be propagated)"
else
    print_info "API test: HTTP $HTTP_CODE"
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
echo "  - Main: https://jegbrowser.com/"
echo "  - API: https://jegbrowser.com/api/"
echo ""
echo "Database:"
echo "  - Name: jeg_profiles"
echo "  - User: jeg_user"
echo "  - Password: $DB_PASSWORD"
echo ""
echo "IMPORTANT NEXT STEPS:"
echo ""
echo "1. Update GoLogin API token:"
echo "   ssh root@192.34.61.246"
echo "   nano /var/www/jegbrowser.com/.env"
echo "   # Change: GOLOGIN_API_TOKEN=your_actual_token"
echo ""
echo "2. Test API endpoints:"
echo "   curl https://jegbrowser.com/"
echo "   curl https://jegbrowser.com/api/"
echo ""
echo "3. Update Electron app (.env file):"
echo "   API_BASE_URL=https://jegbrowser.com/api"
echo ""
echo "4. Rebuild and distribute Electron app:"
echo "   cd chrome-profile-tool"
echo "   npm run build"
echo "   npm run package"
echo ""
echo "Maintenance commands:"
echo "  - Backup database: ssh root@192.34.61.246 'backup-database.sh'"
echo "  - View logs: ssh root@192.34.61.246 'tail -f /var/log/nginx/jegbrowser.com-error.log'"
echo "  - Restart services: ssh root@192.34.61.246 'systemctl restart nginx php8.1-fpm'"
echo ""
print_info "Save database password securely: $DB_PASSWORD"
echo ""
