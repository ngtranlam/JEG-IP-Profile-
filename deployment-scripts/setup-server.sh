#!/bin/bash

#####################################################################
# JEG Profile Server - Automated Setup Script for DigitalOcean
# Ubuntu 22.04 LTS
#####################################################################

set -e  # Exit on error

echo "=========================================="
echo "JEG Profile Server - Automated Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use sudo)"
    exit 1
fi

print_info "Starting server setup..."
echo ""

#####################################################################
# Step 1: Update System
#####################################################################
print_info "Step 1: Updating system packages..."
apt update && apt upgrade -y
apt install -y curl wget git unzip software-properties-common htop
print_success "System updated"
echo ""

#####################################################################
# Step 2: Install Nginx
#####################################################################
print_info "Step 2: Installing Nginx..."
apt install -y nginx
systemctl start nginx
systemctl enable nginx
print_success "Nginx installed and started"
echo ""

#####################################################################
# Step 3: Install MySQL
#####################################################################
print_info "Step 3: Installing MySQL..."
apt install -y mysql-server

# Prompt for MySQL root password
echo ""
read -sp "Enter MySQL root password: " MYSQL_ROOT_PASSWORD
echo ""
read -sp "Confirm MySQL root password: " MYSQL_ROOT_PASSWORD_CONFIRM
echo ""

if [ "$MYSQL_ROOT_PASSWORD" != "$MYSQL_ROOT_PASSWORD_CONFIRM" ]; then
    print_error "Passwords do not match!"
    exit 1
fi

# Secure MySQL installation
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '$MYSQL_ROOT_PASSWORD';"
mysql -e "DELETE FROM mysql.user WHERE User='';"
mysql -e "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');"
mysql -e "DROP DATABASE IF EXISTS test;"
mysql -e "DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';"
mysql -e "FLUSH PRIVILEGES;"

print_success "MySQL installed and secured"
echo ""

#####################################################################
# Step 4: Create Database and User
#####################################################################
print_info "Step 4: Creating database and user..."
echo ""
read -p "Enter database name [jeg_profiles]: " DB_NAME
DB_NAME=${DB_NAME:-jeg_profiles}

read -p "Enter database username [jeg_user]: " DB_USER
DB_USER=${DB_USER:-jeg_user}

read -sp "Enter database password: " DB_PASSWORD
echo ""

# Create database and user
mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<EOF
CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
EOF

print_success "Database '$DB_NAME' and user '$DB_USER' created"
echo ""

#####################################################################
# Step 5: Install PHP 8.1
#####################################################################
print_info "Step 5: Installing PHP 8.1..."
add-apt-repository -y ppa:ondrej/php
apt update
apt install -y php8.1-fpm php8.1-mysql php8.1-mbstring php8.1-xml \
  php8.1-curl php8.1-zip php8.1-gd php8.1-intl php8.1-bcmath \
  php8.1-soap php8.1-cli

systemctl start php8.1-fpm
systemctl enable php8.1-fpm

print_success "PHP 8.1 installed"
php -v
echo ""

#####################################################################
# Step 6: Install Composer
#####################################################################
print_info "Step 6: Installing Composer..."
curl -sS https://getcomposer.org/installer | php
mv composer.phar /usr/local/bin/composer
chmod +x /usr/local/bin/composer

print_success "Composer installed"
composer --version
echo ""

#####################################################################
# Step 7: Setup Project Directory
#####################################################################
print_info "Step 7: Setting up project directory..."
echo ""
read -p "Enter domain name [profile.jegdn.com]: " DOMAIN
DOMAIN=${DOMAIN:-profile.jegdn.com}

PROJECT_DIR="/var/www/$DOMAIN"
mkdir -p $PROJECT_DIR
chown -R www-data:www-data $PROJECT_DIR

print_success "Project directory created: $PROJECT_DIR"
echo ""

#####################################################################
# Step 8: Configure Nginx
#####################################################################
print_info "Step 8: Configuring Nginx..."

cat > /etc/nginx/sites-available/$DOMAIN <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    
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
EOF

# Enable site
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
nginx -t
systemctl reload nginx

print_success "Nginx configured for $DOMAIN"
echo ""

#####################################################################
# Step 9: Setup Firewall
#####################################################################
print_info "Step 9: Configuring firewall..."
ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp

print_success "Firewall configured"
ufw status
echo ""

#####################################################################
# Step 10: Create .env template
#####################################################################
print_info "Step 10: Creating .env template..."

cat > $PROJECT_DIR/.env <<EOF
# Database Configuration
DB_HOST=localhost
DB_NAME=$DB_NAME
DB_USERNAME=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# GoLogin API
GOLOGIN_API_TOKEN=your_gologin_api_token_here

# Security
ENCRYPTION_KEY=$(openssl rand -base64 32)

# Environment
ENVIRONMENT=production

# Firebase (if needed)
FIREBASE_PROJECT_ID=jeg-profiles-77907
EOF

chmod 600 $PROJECT_DIR/.env
chown www-data:www-data $PROJECT_DIR/.env

print_success ".env file created at $PROJECT_DIR/.env"
echo ""

#####################################################################
# Step 11: Create backup script
#####################################################################
print_info "Step 11: Setting up database backup..."

mkdir -p /var/backups/mysql

cat > /usr/local/bin/backup-database.sh <<EOF
#!/bin/bash
BACKUP_DIR="/var/backups/mysql"
DB_NAME="$DB_NAME"
DB_USER="$DB_USER"
DB_PASS="$DB_PASSWORD"
DATE=\$(date +%Y%m%d_%H%M%S)

mysqldump -u \$DB_USER -p\$DB_PASS \$DB_NAME | gzip > \$BACKUP_DIR/${DB_NAME}_\$DATE.sql.gz
find \$BACKUP_DIR -name "${DB_NAME}_*.sql.gz" -mtime +7 -delete
echo "Backup completed: ${DB_NAME}_\$DATE.sql.gz"
EOF

chmod +x /usr/local/bin/backup-database.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-database.sh >> /var/log/mysql-backup.log 2>&1") | crontab -

print_success "Database backup script created (runs daily at 2 AM)"
echo ""

#####################################################################
# Summary
#####################################################################
echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
print_success "Server stack installed successfully"
echo ""
echo "Next steps:"
echo "1. Upload your PHP application to: $PROJECT_DIR"
echo "2. Run: cd $PROJECT_DIR && composer install"
echo "3. Update .env file with your GoLogin API token"
echo "4. Import your database"
echo "5. Install SSL certificate: certbot --nginx -d $DOMAIN"
echo ""
echo "Database Info:"
echo "  - Database: $DB_NAME"
echo "  - Username: $DB_USER"
echo "  - Password: [saved in .env]"
echo ""
echo "Important files:"
echo "  - Project directory: $PROJECT_DIR"
echo "  - Nginx config: /etc/nginx/sites-available/$DOMAIN"
echo "  - Environment file: $PROJECT_DIR/.env"
echo "  - Backup script: /usr/local/bin/backup-database.sh"
echo ""
print_info "Don't forget to point your DNS to this server's IP!"
echo ""
