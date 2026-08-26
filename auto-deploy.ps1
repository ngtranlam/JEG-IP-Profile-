# Auto Deploy to VPS - PowerShell Version
# VPS: 192.34.61.246
# Domain: jegbrowser.com

$VPS_IP = "192.34.61.246"
$DOMAIN = "jegbrowser.com"
$SSH_USER = "root"
$PROJECT_DIR = "/var/www/$DOMAIN"
$LOCAL_CODE = ".\php-api-server"
$DB_BACKUP = ".\gryjeqlb_ipprofiles.sql.gz"

Write-Host "=========================================="
Write-Host "Auto Deploy to VPS"
Write-Host "=========================================="
Write-Host "VPS IP: $VPS_IP"
Write-Host "Domain: $DOMAIN"
Write-Host ""

# Check if ssh command exists
if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: SSH not found. Please install OpenSSH or use Git Bash" -ForegroundColor Red
    Write-Host ""
    Write-Host "To install OpenSSH on Windows:"
    Write-Host "  Settings → Apps → Optional Features → Add OpenSSH Client"
    Write-Host ""
    Write-Host "OR use Git Bash:"
    Write-Host "  Right-click folder → Git Bash Here"
    Write-Host "  bash auto-deploy.sh"
    exit 1
}

Write-Host "Step 1: Testing SSH connection..." -ForegroundColor Yellow
try {
    ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no $SSH_USER@$VPS_IP "echo 'SSH OK'" 2>$null
    Write-Host "✓ SSH connection successful" -ForegroundColor Green
} catch {
    Write-Host "✗ Cannot connect to VPS" -ForegroundColor Red
    Write-Host "Please check:"
    Write-Host "  - VPS IP: $VPS_IP"
    Write-Host "  - SSH key is configured"
    Write-Host "  - Firewall allows SSH (port 22)"
    exit 1
}
Write-Host ""

Write-Host "=========================================="
Write-Host "IMPORTANT: This script requires Git Bash or WSL"
Write-Host "=========================================="
Write-Host ""
Write-Host "Please run the deployment using one of these methods:"
Write-Host ""
Write-Host "Method 1 - Git Bash (Recommended):"
Write-Host "  1. Right-click on this folder"
Write-Host "  2. Select 'Git Bash Here'"
Write-Host "  3. Run: bash auto-deploy.sh"
Write-Host ""
Write-Host "Method 2 - WSL:"
Write-Host "  1. Open WSL terminal"
Write-Host "  2. cd /mnt/d/JEG\ DEV/JEG-IP-Profile-"
Write-Host "  3. Run: bash auto-deploy.sh"
Write-Host ""
Write-Host "Method 3 - Manual SSH (Advanced):"
Write-Host "  I can guide you through manual SSH commands"
Write-Host ""
$choice = Read-Host "Do you want manual SSH guide? (y/n)"

if ($choice -eq "y") {
    Write-Host ""
    Write-Host "=========================================="
    Write-Host "Manual Deployment Steps"
    Write-Host "=========================================="
    Write-Host ""
    
    Write-Host "Step 1: SSH into VPS" -ForegroundColor Yellow
    Write-Host "ssh $SSH_USER@$VPS_IP"
    Write-Host ""
    
    Write-Host "Step 2: Update system and install LEMP" -ForegroundColor Yellow
    Write-Host @"
apt update && apt upgrade -y
apt install -y nginx mysql-server
add-apt-repository -y ppa:ondrej/php
apt update
apt install -y php8.1-fpm php8.1-mysql php8.1-mbstring php8.1-xml php8.1-curl php8.1-zip php8.1-gd php8.1-intl php8.1-bcmath php8.1-cli
curl -sS https://getcomposer.org/installer | php
mv composer.phar /usr/local/bin/composer
apt install -y certbot python3-certbot-nginx
"@
    Write-Host ""
    
    Write-Host "Step 3: Create database" -ForegroundColor Yellow
    Write-Host @"
mysql -e "CREATE DATABASE jeg_profiles CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER 'jeg_user'@'localhost' IDENTIFIED BY 'YOUR_STRONG_PASSWORD';"
mysql -e "GRANT ALL PRIVILEGES ON jeg_profiles.* TO 'jeg_user'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"
"@
    Write-Host ""
    
    Write-Host "Step 4: Upload database (from local machine)" -ForegroundColor Yellow
    Write-Host "scp $DB_BACKUP ${SSH_USER}@${VPS_IP}:/tmp/database.sql.gz"
    Write-Host ""
    Write-Host "Then on VPS:"
    Write-Host @"
cd /tmp
gunzip database.sql.gz
mysql -u jeg_user -p jeg_profiles < database.sql
"@
    Write-Host ""
    
    Write-Host "Step 5: Create project directory" -ForegroundColor Yellow
    Write-Host "mkdir -p $PROJECT_DIR"
    Write-Host ""
    
    Write-Host "Step 6: Upload code (from local machine)" -ForegroundColor Yellow
    Write-Host "scp -r $LOCAL_CODE\* ${SSH_USER}@${VPS_IP}:${PROJECT_DIR}/"
    Write-Host ""
    
    Write-Host "Step 7: Install dependencies (on VPS)" -ForegroundColor Yellow
    Write-Host @"
cd $PROJECT_DIR
composer install --no-dev --optimize-autoloader
"@
    Write-Host ""
    
    Write-Host "Step 8: Create .env file (on VPS)" -ForegroundColor Yellow
    Write-Host @"
cat > $PROJECT_DIR/.env <<'EOF'
DB_HOST=localhost
DB_NAME=jeg_profiles
DB_USERNAME=jeg_user
DB_PASSWORD=YOUR_PASSWORD_HERE
GOLOGIN_API_TOKEN=your_token_here
ENCRYPTION_KEY=$(openssl rand -base64 32)
ENVIRONMENT=production
FIREBASE_PROJECT_ID=jeg-profiles-77907
EOF
chmod 600 $PROJECT_DIR/.env
"@
    Write-Host ""
    
    Write-Host "Step 9: Configure Nginx" -ForegroundColor Yellow
    Write-Host "See DIGITALOCEAN_MIGRATION_GUIDE.md for Nginx config"
    Write-Host ""
    
    Write-Host "Step 10: Install SSL" -ForegroundColor Yellow
    Write-Host "certbot --nginx -d $DOMAIN -d www.$DOMAIN"
    Write-Host ""
    
    Write-Host "Step 11: Set permissions" -ForegroundColor Yellow
    Write-Host @"
chown -R www-data:www-data $PROJECT_DIR
find $PROJECT_DIR -type d -exec chmod 755 {} \;
find $PROJECT_DIR -type f -exec chmod 644 {} \;
chmod 600 $PROJECT_DIR/.env
"@
    Write-Host ""
    
    Write-Host "=========================================="
    Write-Host "For full automation, please use Git Bash:"
    Write-Host "  bash auto-deploy.sh"
    Write-Host "=========================================="
}
