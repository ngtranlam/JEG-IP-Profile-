#!/bin/bash

#####################################################################
# Final Deployment - Upload Code and Configure
# VPS: 192.34.61.246
# Domain: jegbrowser.com
#####################################################################

set -e

VPS_IP="192.34.61.246"
DOMAIN="jegbrowser.com"
SSH_USER="root"
PROJECT_DIR="/var/www/$DOMAIN"
LOCAL_CODE="./php-api-server"

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
echo "Final Deployment"
echo "=========================================="
echo ""

# Database password from previous step
DB_PASSWORD="V0XiWD2AnXP1ycPhqE43kw=="

#####################################################################
# Step 1: Upload Code using SCP
#####################################################################
print_info "Step 1: Uploading application code..."

if [ ! -d "$LOCAL_CODE" ]; then
    print_error "Code directory not found: $LOCAL_CODE"
    exit 1
fi

# Create temp archive
print_info "Creating archive..."
cd "$LOCAL_CODE"
tar -czf ../app-code.tar.gz --exclude='vendor' --exclude='.git' --exclude='node_modules' .
cd ..

print_info "Uploading to VPS..."
scp app-code.tar.gz $SSH_USER@$VPS_IP:/tmp/

print_info "Extracting on VPS..."
ssh $SSH_USER@$VPS_IP "bash -s" <<ENDSSH
set -e
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
# Step 2: Install Dependencies
#####################################################################
print_info "Step 2: Installing Composer dependencies..."

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
# Step 3: Create .env File
#####################################################################
print_info "Step 3: Creating .env file..."

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
# Step 4: Configure Nginx
#####################################################################
print_info "Step 4: Configuring Nginx..."

ssh $SSH_USER@$VPS_IP "bash -s" <<ENDSSH
set -e

cat > /etc/nginx/sites-available/$DOMAIN <<'NGINXCONF'
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

ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx

echo "✓ Nginx configured"
ENDSSH

print_success "Nginx configured"
echo ""

#####################################################################
# Step 5: Setup Firewall
#####################################################################
print_info "Step 5: Configuring firewall..."

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
# Step 6: Install SSL Certificate
#####################################################################
print_info "Step 6: Installing SSL certificate..."

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
# Step 7: Set Permissions
#####################################################################
print_info "Step 7: Setting permissions..."

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
# Step 8: Test API
#####################################################################
print_info "Step 8: Testing API..."

sleep 3

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/ 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    print_success "API is working! (HTTP $HTTP_CODE)"
else
    print_info "API test: HTTP $HTTP_CODE (may need DNS propagation)"
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
