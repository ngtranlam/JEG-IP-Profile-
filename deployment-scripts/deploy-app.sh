#!/bin/bash

#####################################################################
# JEG Profile - Deploy Application Script
# Run this after setup-server.sh
#####################################################################

set -e

echo "=========================================="
echo "JEG Profile - Application Deployment"
echo "=========================================="
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

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use sudo)"
    exit 1
fi

#####################################################################
# Get domain and project directory
#####################################################################
read -p "Enter domain name [profile.jegdn.com]: " DOMAIN
DOMAIN=${DOMAIN:-profile.jegdn.com}

PROJECT_DIR="/var/www/$DOMAIN"

if [ ! -d "$PROJECT_DIR" ]; then
    print_error "Project directory $PROJECT_DIR does not exist!"
    print_info "Please run setup-server.sh first"
    exit 1
fi

#####################################################################
# Step 1: Upload application files
#####################################################################
print_info "Step 1: Preparing to upload application files..."
echo ""
echo "Please upload your php-api-server files to: $PROJECT_DIR"
echo ""
echo "Options:"
echo "  1. Use SCP from local machine:"
echo "     scp -r php-api-server/* root@YOUR_SERVER_IP:$PROJECT_DIR/"
echo ""
echo "  2. Use Git:"
echo "     cd $PROJECT_DIR"
echo "     git clone YOUR_REPO_URL ."
echo ""
echo "  3. Use SFTP client (FileZilla, WinSCP, etc.)"
echo ""
read -p "Have you uploaded the files? (y/n): " FILES_UPLOADED

if [ "$FILES_UPLOADED" != "y" ]; then
    print_info "Please upload files and run this script again"
    exit 0
fi

#####################################################################
# Step 2: Install Composer dependencies
#####################################################################
print_info "Step 2: Installing Composer dependencies..."
cd $PROJECT_DIR

if [ -f "composer.json" ]; then
    composer install --no-dev --optimize-autoloader
    print_success "Composer dependencies installed"
else
    print_error "composer.json not found!"
    exit 1
fi
echo ""

#####################################################################
# Step 3: Set permissions
#####################################################################
print_info "Step 3: Setting file permissions..."
chown -R www-data:www-data $PROJECT_DIR
find $PROJECT_DIR -type d -exec chmod 755 {} \;
find $PROJECT_DIR -type f -exec chmod 644 {} \;
chmod 600 $PROJECT_DIR/.env

print_success "Permissions set"
echo ""

#####################################################################
# Step 4: Update .env file
#####################################################################
print_info "Step 4: Configuring environment variables..."
echo ""
read -p "Enter GoLogin API Token: " GOLOGIN_TOKEN

if [ -f "$PROJECT_DIR/.env" ]; then
    sed -i "s/GOLOGIN_API_TOKEN=.*/GOLOGIN_API_TOKEN=$GOLOGIN_TOKEN/" $PROJECT_DIR/.env
    print_success ".env updated with GoLogin token"
else
    print_error ".env file not found!"
    exit 1
fi
echo ""

#####################################################################
# Step 5: Import database
#####################################################################
print_info "Step 5: Database setup..."
echo ""
echo "Do you have a database backup to import?"
read -p "(y/n): " HAS_BACKUP

if [ "$HAS_BACKUP" = "y" ]; then
    read -p "Enter path to SQL backup file: " SQL_FILE
    
    if [ -f "$SQL_FILE" ]; then
        # Get DB credentials from .env
        DB_NAME=$(grep DB_NAME $PROJECT_DIR/.env | cut -d '=' -f2)
        DB_USER=$(grep DB_USERNAME $PROJECT_DIR/.env | cut -d '=' -f2)
        DB_PASS=$(grep DB_PASSWORD $PROJECT_DIR/.env | cut -d '=' -f2)
        
        mysql -u $DB_USER -p$DB_PASS $DB_NAME < $SQL_FILE
        print_success "Database imported successfully"
    else
        print_error "SQL file not found: $SQL_FILE"
        exit 1
    fi
else
    print_info "Skipping database import"
    echo "You can import later using:"
    echo "mysql -u DB_USER -p DB_NAME < backup.sql"
fi
echo ""

#####################################################################
# Step 6: Test PHP configuration
#####################################################################
print_info "Step 6: Testing PHP configuration..."

# Create test PHP file
cat > $PROJECT_DIR/test.php <<'EOF'
<?php
phpinfo();
?>
EOF

print_success "Test file created: http://$DOMAIN/test.php"
echo ""

#####################################################################
# Step 7: Install SSL certificate
#####################################################################
print_info "Step 7: Installing SSL certificate..."
echo ""
read -p "Install SSL certificate now? (y/n): " INSTALL_SSL

if [ "$INSTALL_SSL" = "y" ]; then
    # Install Certbot if not already installed
    if ! command -v certbot &> /dev/null; then
        apt install -y certbot python3-certbot-nginx
    fi
    
    read -p "Enter email for SSL certificate: " SSL_EMAIL
    
    certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $SSL_EMAIL --redirect
    
    print_success "SSL certificate installed"
else
    print_info "You can install SSL later using:"
    echo "certbot --nginx -d $DOMAIN"
fi
echo ""

#####################################################################
# Step 8: Restart services
#####################################################################
print_info "Step 8: Restarting services..."
systemctl restart php8.1-fpm
systemctl restart nginx

print_success "Services restarted"
echo ""

#####################################################################
# Step 9: Test API endpoints
#####################################################################
print_info "Step 9: Testing API endpoints..."
echo ""

PROTOCOL="http"
if [ "$INSTALL_SSL" = "y" ]; then
    PROTOCOL="https"
fi

echo "Testing root endpoint..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $PROTOCOL://$DOMAIN/)
if [ "$RESPONSE" = "200" ]; then
    print_success "Root endpoint: OK (HTTP $RESPONSE)"
else
    print_error "Root endpoint: FAILED (HTTP $RESPONSE)"
fi

echo "Testing API endpoint..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $PROTOCOL://$DOMAIN/api/)
if [ "$RESPONSE" = "200" ]; then
    print_success "API endpoint: OK (HTTP $RESPONSE)"
else
    print_error "API endpoint: FAILED (HTTP $RESPONSE)"
fi
echo ""

#####################################################################
# Step 10: Create maintenance scripts
#####################################################################
print_info "Step 10: Creating maintenance scripts..."

# Clear cache script
cat > /usr/local/bin/jeg-clear-cache.sh <<EOF
#!/bin/bash
cd $PROJECT_DIR
rm -rf cache/*
systemctl restart php8.1-fpm
echo "Cache cleared and PHP-FPM restarted"
EOF

chmod +x /usr/local/bin/jeg-clear-cache.sh

# View logs script
cat > /usr/local/bin/jeg-logs.sh <<EOF
#!/bin/bash
echo "=== Nginx Error Log ==="
tail -n 50 /var/log/nginx/${DOMAIN}-error.log
echo ""
echo "=== Nginx Access Log ==="
tail -n 50 /var/log/nginx/${DOMAIN}-access.log
echo ""
echo "=== PHP-FPM Error Log ==="
tail -n 50 /var/log/php8.1-fpm.log
EOF

chmod +x /usr/local/bin/jeg-logs.sh

# Status check script
cat > /usr/local/bin/jeg-status.sh <<EOF
#!/bin/bash
echo "=== Service Status ==="
systemctl status nginx --no-pager | head -n 3
systemctl status php8.1-fpm --no-pager | head -n 3
systemctl status mysql --no-pager | head -n 3
echo ""
echo "=== Disk Usage ==="
df -h | grep -E '(Filesystem|/$)'
echo ""
echo "=== Memory Usage ==="
free -h
echo ""
echo "=== API Test ==="
curl -s $PROTOCOL://$DOMAIN/ | jq .
EOF

chmod +x /usr/local/bin/jeg-status.sh

print_success "Maintenance scripts created:"
echo "  - jeg-clear-cache.sh - Clear application cache"
echo "  - jeg-logs.sh - View application logs"
echo "  - jeg-status.sh - Check system status"
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
echo "  - Main: $PROTOCOL://$DOMAIN/"
echo "  - API: $PROTOCOL://$DOMAIN/api/"
echo "  - Test: $PROTOCOL://$DOMAIN/test.php"
echo ""
echo "Next steps:"
echo "1. Test all API endpoints"
echo "2. Update Electron app with new API URL:"
echo "   API_BASE_URL=$PROTOCOL://$DOMAIN/api"
echo "3. Remove test.php file:"
echo "   rm $PROJECT_DIR/test.php"
echo "4. Monitor logs:"
echo "   jeg-logs.sh"
echo ""
echo "Maintenance commands:"
echo "  - jeg-status.sh    - Check system status"
echo "  - jeg-logs.sh      - View logs"
echo "  - jeg-clear-cache.sh - Clear cache"
echo ""
print_info "Don't forget to test from your Electron app!"
echo ""
