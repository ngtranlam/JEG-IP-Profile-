#!/bin/bash

#####################################################################
# Auto Deploy to VPS - JEG Browser
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

echo "=========================================="
echo "Auto Deploy to VPS"
echo "=========================================="
echo "VPS IP: $VPS_IP"
echo "Domain: $DOMAIN"
echo ""

# Colors
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

#####################################################################
# Step 1: Test SSH Connection
#####################################################################
print_info "Step 1: Testing SSH connection..."
if ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no $SSH_USER@$VPS_IP "echo 'SSH OK'" > /dev/null 2>&1; then
    print_success "SSH connection successful"
else
    print_error "Cannot connect to VPS. Please check:"
    echo "  - VPS IP: $VPS_IP"
    echo "  - SSH key is added to ssh-agent"
    echo "  - Firewall allows SSH (port 22)"
    exit 1
fi
echo ""

#####################################################################
# Step 2: Install LEMP Stack on VPS
#####################################################################
print_info "Step 2: Installing LEMP stack on VPS..."

ssh $SSH_USER@$VPS_IP 'bash -s' <<'ENDSSH'
set -e

echo "→ Updating system..."
apt update && apt upgrade -y

echo "→ Installing Nginx..."
apt install -y nginx
systemctl start nginx
systemctl enable nginx

echo "→ Installing MySQL..."
export DEBIAN_FRONTEND=noninteractive
apt install -y mysql-server

echo "→ Installing PHP 8.1..."
add-apt-repository -y ppa:ondrej/php
apt update
apt install -y php8.1-fpm php8.1-mysql php8.1-mbstring php8.1-xml \
  php8.1-curl php8.1-zip php8.1-gd php8.1-intl php8.1-bcmath php8.1-cli
systemctl start php8.1-fpm
systemctl enable php8.1-fpm

echo "→ Installing Composer..."
curl -sS https://getcomposer.org/installer | php
mv composer.phar /usr/local/bin/composer

echo "→ Installing Certbot..."
apt install -y certbot python3-certbot-nginx

echo "→ Installing utilities..."
apt install -y unzip git htop

echo "✓ LEMP stack installed"
ENDSSH

print_success "LEMP stack installed"
echo ""

#####################################################################
# Step 3: Create Database
#####################################################################
print_info "Step 3: Creating database..."

# Generate random password
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
# Step 4: Upload Database Backup
#####################################################################
print_info "Step 4: Uploading and importing database..."

if [ ! -f "$DB_BACKUP" ]; then
    print_error "Database backup not found: $DB_BACKUP"
    exit 1
fi

# Upload database backup
scp $DB_BACKUP $SSH_USER@$VPS_IP:/tmp/database.sql.gz

# Import database
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
# Step 5: Create Project Directory
#####################################################################
print_info "Step 5: Creating project directory..."

ssh $SSH_USER@$VPS_IP "bash -s" <<ENDSSH
set -e
mkdir -p $PROJECT_DIR
chown -R www-data:www-data $PROJECT_DIR
echo "✓ Project directory created"
ENDSSH

print_success "Project directory created: $PROJECT_DIR"
echo ""

#####################################################################
# Step 6: Upload Application Code
#####################################################################
print_info "Step 6: Uploading application code..."

if [ ! -d "$LOCAL_CODE" ]; then
    print_error "Code directory not found: $LOCAL_CODE"
    exit 1
fi

# Upload code
rsync -avz --exclude 'vendor' --exclude '.git' --exclude 'node_modules' \
    $LOCAL_CODE/ $SSH_USER@$VPS_IP:$PROJECT_DIR/

print_success "Code uploaded"
echo ""

#####################################################################
# Step 7: Install Dependencies
#####################################################################
print_info "Step 7: Installing Composer dependencies..."

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
# Step 8: Create .env File
#####################################################################
print_info "Step 8: Creating .env file..."

# Generate encryption key
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
# Step 9: Configure Nginx
#####################################################################
print_info "Step 9: Configuring Nginx..."

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

# Replace variables in Nginx config
sed -i "s|\$DOMAIN|$DOMAIN|g" /etc/nginx/sites-available/$DOMAIN
sed -i "s|\$PROJECT_DIR|$PROJECT_DIR|g" /etc/nginx/sites-available/$DOMAIN

# Enable site
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload
nginx -t
systemctl reload nginx

echo "✓ Nginx configured"
ENDSSH

print_success "Nginx configured"
echo ""

#####################################################################
# Step 10: Setup Firewall
#####################################################################
print_info "Step 10: Configuring firewall..."

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
# Step 11: Install SSL Certificate
#####################################################################
print_info "Step 11: Installing SSL certificate..."

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
# Step 12: Set Permissions
#####################################################################
print_info "Step 12: Setting permissions..."

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
# Step 13: Create Maintenance Scripts
#####################################################################
print_info "Step 13: Creating maintenance scripts..."

ssh $SSH_USER@$VPS_IP "bash -s" <<'ENDSSH'
set -e

# Backup script
cat > /usr/local/bin/backup-database.sh <<'BACKUPSCRIPT'
#!/bin/bash
BACKUP_DIR="/var/backups/mysql"
mkdir -p $BACKUP_DIR
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u jeg_user -p'$DB_PASSWORD' jeg_profiles | gzip > $BACKUP_DIR/jeg_profiles_$DATE.sql.gz
find $BACKUP_DIR -name "jeg_profiles_*.sql.gz" -mtime +7 -delete
echo "Backup completed: jeg_profiles_$DATE.sql.gz"
BACKUPSCRIPT

chmod +x /usr/local/bin/backup-database.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-database.sh >> /var/log/mysql-backup.log 2>&1") | crontab -

# Status script
cat > /usr/local/bin/jeg-status.sh <<'STATUSSCRIPT'
#!/bin/bash
echo "=== Services ==="
systemctl status nginx --no-pager | head -3
systemctl status php8.1-fpm --no-pager | head -3
systemctl status mysql --no-pager | head -3
echo ""
echo "=== Disk ==="
df -h | grep -E '(Filesystem|/$)'
echo ""
echo "=== Memory ==="
free -h
STATUSSCRIPT

chmod +x /usr/local/bin/jeg-status.sh

echo "✓ Maintenance scripts created"
ENDSSH

print_success "Maintenance scripts created"
echo ""

#####################################################################
# Step 14: Test API
#####################################################################
print_info "Step 14: Testing API..."

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
echo "IMPORTANT: Update .env file with GoLogin API token:"
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
echo "Maintenance:"
echo "  - Check status: ssh $SSH_USER@$VPS_IP 'jeg-status.sh'"
echo "  - View logs: ssh $SSH_USER@$VPS_IP 'tail -f /var/log/nginx/${DOMAIN}-error.log'"
echo "  - Backup DB: ssh $SSH_USER@$VPS_IP 'backup-database.sh'"
echo ""
print_info "Save database password securely!"
echo ""
