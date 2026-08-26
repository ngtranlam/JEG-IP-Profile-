#!/bin/bash

#####################################################################
# Final Deployment Script - Fixed Version
# VPS: 192.34.61.246
# Domain: jegbrowser.com
#####################################################################

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

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_info() { echo -e "${YELLOW}→ $1${NC}"; }

echo "=========================================="
echo "Final Deployment"
echo "=========================================="
echo ""

#####################################################################
# Test SSH first
#####################################################################
print_info "Testing SSH connection..."
if ! ssh -o ConnectTimeout=10 -o BatchMode=yes $SSH_USER@$VPS_IP "echo 'OK'" &>/dev/null; then
    print_error "Cannot connect to VPS via SSH"
    echo ""
    echo "Please check:"
    echo "1. VPS is running"
    echo "2. SSH key is configured: ssh-add ~/.ssh/id_ed25519"
    echo "3. Try manual SSH: ssh root@192.34.61.246"
    exit 1
fi
print_success "SSH connection OK"
echo ""

#####################################################################
# Install Composer
#####################################################################
print_info "Installing Composer on VPS..."
ssh $SSH_USER@$VPS_IP 'bash -s' <<'EOF'
if ! command -v composer &> /dev/null; then
    curl -sS https://getcomposer.org/installer -o /tmp/composer-setup.php
    php /tmp/composer-setup.php --install-dir=/usr/local/bin --filename=composer
    rm /tmp/composer-setup.php
fi
composer --version
EOF
print_success "Composer ready"
echo ""

#####################################################################
# Upload Code
#####################################################################
print_info "Uploading code..."
cd "$LOCAL_CODE"
tar czf /tmp/app-code.tar.gz --exclude='vendor' --exclude='.git' --exclude='node_modules' .
cd ..

scp /tmp/app-code.tar.gz $SSH_USER@$VPS_IP:/tmp/
rm /tmp/app-code.tar.gz

ssh $SSH_USER@$VPS_IP "mkdir -p $PROJECT_DIR && cd $PROJECT_DIR && tar xzf /tmp/app-code.tar.gz && rm /tmp/app-code.tar.gz"
print_success "Code uploaded"
echo ""

#####################################################################
# Install Dependencies
#####################################################################
print_info "Installing dependencies..."
ssh $SSH_USER@$VPS_IP "cd $PROJECT_DIR && composer install --no-dev --optimize-autoloader --no-interaction"
print_success "Dependencies installed"
echo ""

#####################################################################
# Create .env
#####################################################################
print_info "Creating .env..."
ENCRYPTION_KEY=$(openssl rand -base64 32)
ssh $SSH_USER@$VPS_IP "cat > $PROJECT_DIR/.env" <<EOF
DB_HOST=localhost
DB_NAME=jeg_profiles
DB_USERNAME=jeg_user
DB_PASSWORD=$DB_PASSWORD
GOLOGIN_API_TOKEN=your_gologin_api_token_here
ENCRYPTION_KEY=$ENCRYPTION_KEY
ENVIRONMENT=production
FIREBASE_PROJECT_ID=jeg-profiles-77907
EOF
ssh $SSH_USER@$VPS_IP "chmod 600 $PROJECT_DIR/.env"
print_success ".env created"
echo ""

#####################################################################
# Configure Nginx
#####################################################################
print_info "Configuring Nginx..."
ssh $SSH_USER@$VPS_IP 'bash -s' <<'EOF'
cat > /etc/nginx/sites-available/jegbrowser.com <<'NGINX'
server {
    listen 80;
    server_name jegbrowser.com www.jegbrowser.com;
    root /var/www/jegbrowser.com;
    index index.php index.html;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
    }

    location ~ /\.env { deny all; }
    location ~ /\.git { deny all; }
}
NGINX

ln -sf /etc/nginx/sites-available/jegbrowser.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
EOF
print_success "Nginx configured"
echo ""

#####################################################################
# Install SSL
#####################################################################
print_info "Installing SSL..."
read -p "Enter email for SSL: " SSL_EMAIL
ssh $SSH_USER@$VPS_IP "certbot --nginx -d jegbrowser.com -d www.jegbrowser.com --non-interactive --agree-tos --email $SSL_EMAIL --redirect"
print_success "SSL installed"
echo ""

#####################################################################
# Set Permissions
#####################################################################
print_info "Setting permissions..."
ssh $SSH_USER@$VPS_IP "chown -R www-data:www-data $PROJECT_DIR && find $PROJECT_DIR -type d -exec chmod 755 {} \; && find $PROJECT_DIR -type f -exec chmod 644 {} \; && chmod 600 $PROJECT_DIR/.env"
print_success "Permissions set"
echo ""

#####################################################################
# Done
#####################################################################
echo ""
echo "=========================================="
echo "✓ Deployment Complete!"
echo "=========================================="
echo ""
echo "URLs:"
echo "  https://jegbrowser.com/"
echo "  https://jegbrowser.com/api/"
echo ""
echo "Database password: $DB_PASSWORD"
echo ""
echo "Next: Update GoLogin token in .env"
echo "  ssh root@192.34.61.246"
echo "  nano /var/www/jegbrowser.com/.env"
echo ""
