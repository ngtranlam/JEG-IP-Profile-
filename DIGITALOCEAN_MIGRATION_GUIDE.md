# Hướng Dẫn Migration từ Shared Hosting sang DigitalOcean Droplet

## 📋 Tổng Quan

**Hiện tại:** Shared Hosting (StableHost)
**Chuyển sang:** DigitalOcean Droplet (VPS)

**Lợi ích:**
- ✅ Dedicated resources (CPU, RAM, Storage)
- ✅ Full control over server configuration
- ✅ Better performance & scalability
- ✅ Không bị ảnh hưởng bởi users khác
- ✅ Tránh IP blacklist do shared hosting

---

## 🎯 Kiến Trúc Sau Migration

```
[DigitalOcean Droplet]
├── Nginx (Web Server)
├── PHP 8.1+ (FPM)
├── MySQL 8.0
├── SSL Certificate (Let's Encrypt)
└── Firewall (UFW)

Domain: profile.jegdn.com → Droplet IP
```

---

## 📦 Phần 1: Chuẩn Bị DigitalOcean Droplet

### Bước 1.1: Tạo Droplet

1. **Đăng nhập DigitalOcean**
   - Vào https://cloud.digitalocean.com

2. **Create Droplet:**
   - **Image:** Ubuntu 22.04 LTS x64
   - **Plan:** 
     - Basic: $6/month (1GB RAM, 1 vCPU, 25GB SSD) - Minimum
     - Recommended: $12/month (2GB RAM, 1 vCPU, 50GB SSD)
   - **Datacenter:** Singapore (gần Việt Nam)
   - **Authentication:** SSH Key (recommended) hoặc Password
   - **Hostname:** jeg-profile-server

3. **Ghi lại thông tin:**
   ```
   Droplet IP: xxx.xxx.xxx.xxx
   Root Password: (nếu dùng password auth)
   ```

### Bước 1.2: Cấu Hình DNS

1. **Vào DNS Manager của domain:**
   - Đăng nhập vào nhà cung cấp domain (GoDaddy, Namecheap, etc.)

2. **Cập nhật A Record:**
   ```
   Type: A
   Name: profile (hoặc @)
   Value: [Droplet IP]
   TTL: 3600
   ```

3. **Chờ DNS propagate:** 5-30 phút

---

## 🔧 Phần 2: Cài Đặt Server Stack (LEMP)

### Bước 2.1: Kết Nối SSH

```bash
# Từ máy local
ssh root@[DROPLET_IP]
```

### Bước 2.2: Update System

```bash
# Update packages
apt update && apt upgrade -y

# Install basic tools
apt install -y curl wget git unzip software-properties-common
```

### Bước 2.3: Cài Đặt Nginx

```bash
# Install Nginx
apt install -y nginx

# Start và enable Nginx
systemctl start nginx
systemctl enable nginx

# Check status
systemctl status nginx

# Test: Truy cập http://[DROPLET_IP] - sẽ thấy Nginx welcome page
```

### Bước 2.4: Cài Đặt MySQL

```bash
# Install MySQL
apt install -y mysql-server

# Secure MySQL
mysql_secure_installation
# - Set root password: YES (chọn password mạnh)
# - Remove anonymous users: YES
# - Disallow root login remotely: YES
# - Remove test database: YES
# - Reload privilege tables: YES

# Login MySQL
mysql -u root -p

# Tạo database và user cho ứng dụng
CREATE DATABASE jeg_profiles CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'jeg_user'@'localhost' IDENTIFIED BY 'YOUR_STRONG_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON jeg_profiles.* TO 'jeg_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Bước 2.5: Cài Đặt PHP 8.1

```bash
# Add PHP repository
add-apt-repository -y ppa:ondrej/php
apt update

# Install PHP 8.1 và extensions cần thiết
apt install -y php8.1-fpm php8.1-mysql php8.1-mbstring php8.1-xml \
  php8.1-curl php8.1-zip php8.1-gd php8.1-intl php8.1-bcmath \
  php8.1-soap php8.1-cli

# Check PHP version
php -v

# Start PHP-FPM
systemctl start php8.1-fpm
systemctl enable php8.1-fpm
```

### Bước 2.6: Cài Đặt Composer

```bash
# Download Composer
curl -sS https://getcomposer.org/installer | php

# Move to global
mv composer.phar /usr/local/bin/composer

# Verify
composer --version
```

---

## 📁 Phần 3: Deploy PHP Application

### Bước 3.1: Tạo Thư Mục Project

```bash
# Tạo thư mục cho web app
mkdir -p /var/www/profile.jegdn.com

# Set ownership
chown -R www-data:www-data /var/www/profile.jegdn.com
```

### Bước 3.2: Upload Code

**Option 1: Sử dụng Git (Recommended)**

```bash
cd /var/www/profile.jegdn.com

# Clone repository (nếu có)
git clone https://github.com/ngtranlam/JEG-IP-Profile-.git .

# Hoặc chỉ copy folder php-api-server
# (Upload qua SFTP/SCP)
```

**Option 2: Upload qua SFTP**

```bash
# Từ máy local, sử dụng SCP
scp -r php-api-server/* root@[DROPLET_IP]:/var/www/profile.jegdn.com/
```

### Bước 3.3: Cài Đặt Dependencies

```bash
cd /var/www/profile.jegdn.com

# Install Composer dependencies
composer install --no-dev --optimize-autoloader

# Set permissions
chown -R www-data:www-data /var/www/profile.jegdn.com
chmod -R 755 /var/www/profile.jegdn.com
```

### Bước 3.4: Cấu Hình Environment

```bash
# Tạo file .env
nano /var/www/profile.jegdn.com/.env
```

**Nội dung .env:**

```env
# Database Configuration
DB_HOST=localhost
DB_NAME=jeg_profiles
DB_USERNAME=jeg_user
DB_PASSWORD=YOUR_STRONG_PASSWORD_HERE

# GoLogin API
GOLOGIN_API_TOKEN=your_gologin_api_token_here

# Security
ENCRYPTION_KEY=your-secret-encryption-key-change-this-to-random-32-chars

# Environment
ENVIRONMENT=production

# Firebase (nếu có)
FIREBASE_PROJECT_ID=jeg-profiles-77907
```

**Bảo mật .env:**

```bash
chmod 600 /var/www/profile.jegdn.com/.env
chown www-data:www-data /var/www/profile.jegdn.com/.env
```

### Bước 3.5: Import Database

**Option 1: Export từ Shared Hosting**

```bash
# Trên shared hosting (qua cPanel phpMyAdmin):
# 1. Export database sang file .sql
# 2. Download về máy local

# Upload lên Droplet
scp database_backup.sql root@[DROPLET_IP]:/tmp/

# Import vào MySQL
mysql -u jeg_user -p jeg_profiles < /tmp/database_backup.sql
```

**Option 2: Tạo Tables Mới**

```bash
# Nếu chưa có data, chạy migration scripts
mysql -u jeg_user -p jeg_profiles < /var/www/profile.jegdn.com/database/schema.sql
```

---

## 🌐 Phần 4: Cấu Hình Nginx

### Bước 4.1: Tạo Nginx Config

```bash
nano /etc/nginx/sites-available/profile.jegdn.com
```

**Nội dung config:**

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name profile.jegdn.com;
    
    root /var/www/profile.jegdn.com;
    index index.php index.html;

    # Logging
    access_log /var/log/nginx/profile.jegdn.com-access.log;
    error_log /var/log/nginx/profile.jegdn.com-error.log;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # CORS headers
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With" always;

    # Handle OPTIONS requests
    if ($request_method = 'OPTIONS') {
        return 204;
    }

    # Main location
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # PHP handling
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
        
        # Increase timeouts for long-running requests
        fastcgi_read_timeout 300;
        fastcgi_send_timeout 300;
    }

    # Deny access to sensitive files
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

    # Disable directory listing
    autoindex off;

    # File upload size
    client_max_body_size 10M;
}
```

### Bước 4.2: Enable Site

```bash
# Create symlink
ln -s /etc/nginx/sites-available/profile.jegdn.com /etc/nginx/sites-enabled/

# Remove default site
rm /etc/nginx/sites-enabled/default

# Test Nginx config
nginx -t

# Reload Nginx
systemctl reload nginx
```

---

## 🔒 Phần 5: Cài Đặt SSL Certificate (Let's Encrypt)

### Bước 5.1: Install Certbot

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx
```

### Bước 5.2: Obtain SSL Certificate

```bash
# Get certificate
certbot --nginx -d profile.jegdn.com

# Follow prompts:
# - Enter email: your-email@example.com
# - Agree to Terms: Yes
# - Share email with EFF: No (optional)
# - Redirect HTTP to HTTPS: Yes (recommended)
```

### Bước 5.3: Auto-Renewal

```bash
# Test auto-renewal
certbot renew --dry-run

# Certbot tự động tạo cron job để renew
# Check: /etc/cron.d/certbot
```

**Nginx config sẽ tự động update thành:**

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name profile.jegdn.com;

    ssl_certificate /etc/letsencrypt/live/profile.jegdn.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/profile.jegdn.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # ... rest of config
}

server {
    listen 80;
    server_name profile.jegdn.com;
    return 301 https://$server_name$request_uri;
}
```

---

## 🔥 Phần 6: Cấu Hình Firewall

### Bước 6.1: Setup UFW

```bash
# Install UFW (usually pre-installed)
apt install -y ufw

# Allow SSH (IMPORTANT - don't lock yourself out!)
ufw allow 22/tcp

# Allow HTTP & HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw enable

# Check status
ufw status verbose
```

**Output mong đợi:**

```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
```

---

## 🧪 Phần 7: Testing & Verification

### Bước 7.1: Test API Endpoints

```bash
# Test root endpoint
curl https://profile.jegdn.com/

# Expected response:
# {"message":"Chrome Profile Tool API Server","status":"running","version":"1.0.0"}

# Test API endpoint
curl https://profile.jegdn.com/api/

# Test specific endpoint (may need auth)
curl https://profile.jegdn.com/api/gologin/test-connection
```

### Bước 7.2: Test từ Electron App

1. **Update .env trong chrome-profile-tool:**

```env
API_BASE_URL=https://profile.jegdn.com/api
```

2. **Rebuild app:**

```bash
cd chrome-profile-tool
npm run build
npm run dev
```

3. **Test các chức năng:**
   - Login
   - List profiles
   - Launch profile
   - Proxy management

---

## 📊 Phần 8: Monitoring & Maintenance

### Bước 8.1: Setup Log Rotation

```bash
# Nginx logs tự động rotate
# Check: /etc/logrotate.d/nginx

# PHP-FPM logs
nano /etc/logrotate.d/php-fpm
```

**Nội dung:**

```
/var/log/php8.1-fpm.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        systemctl reload php8.1-fpm > /dev/null
    endscript
}
```

### Bước 8.2: Monitoring Commands

```bash
# Check Nginx status
systemctl status nginx

# Check PHP-FPM status
systemctl status php8.1-fpm

# Check MySQL status
systemctl status mysql

# View Nginx error logs
tail -f /var/log/nginx/profile.jegdn.com-error.log

# View Nginx access logs
tail -f /var/log/nginx/profile.jegdn.com-access.log

# Check disk usage
df -h

# Check memory usage
free -h

# Check running processes
htop
```

### Bước 8.3: Database Backup Script

```bash
# Create backup directory
mkdir -p /var/backups/mysql

# Create backup script
nano /usr/local/bin/backup-database.sh
```

**Nội dung script:**

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/mysql"
DB_NAME="jeg_profiles"
DB_USER="jeg_user"
DB_PASS="YOUR_PASSWORD"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME | gzip > $BACKUP_DIR/jeg_profiles_$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "jeg_profiles_*.sql.gz" -mtime +7 -delete

echo "Backup completed: jeg_profiles_$DATE.sql.gz"
```

**Make executable và setup cron:**

```bash
chmod +x /usr/local/bin/backup-database.sh

# Add to crontab (daily at 2 AM)
crontab -e

# Add this line:
0 2 * * * /usr/local/bin/backup-database.sh >> /var/log/mysql-backup.log 2>&1
```

---

## 🔄 Phần 9: Migration Checklist

### Pre-Migration

- [ ] Backup database từ shared hosting
- [ ] Backup tất cả files từ shared hosting
- [ ] Ghi lại tất cả environment variables
- [ ] Test app trên local với API mới

### During Migration

- [ ] Tạo DigitalOcean Droplet
- [ ] Cài đặt LEMP stack
- [ ] Deploy code lên VPS
- [ ] Import database
- [ ] Cấu hình Nginx
- [ ] Cài đặt SSL certificate
- [ ] Setup firewall

### Post-Migration

- [ ] Test tất cả API endpoints
- [ ] Update DNS records
- [ ] Test Electron app với API mới
- [ ] Monitor logs trong 24h đầu
- [ ] Setup backup automation
- [ ] Document server credentials

---

## 🚨 Troubleshooting

### Issue 1: Nginx 502 Bad Gateway

```bash
# Check PHP-FPM status
systemctl status php8.1-fpm

# Check PHP-FPM socket
ls -la /var/run/php/php8.1-fpm.sock

# Restart PHP-FPM
systemctl restart php8.1-fpm
```

### Issue 2: Database Connection Failed

```bash
# Check MySQL status
systemctl status mysql

# Test MySQL connection
mysql -u jeg_user -p jeg_profiles

# Check .env file permissions
ls -la /var/www/profile.jegdn.com/.env
```

### Issue 3: Permission Denied

```bash
# Fix ownership
chown -R www-data:www-data /var/www/profile.jegdn.com

# Fix permissions
find /var/www/profile.jegdn.com -type d -exec chmod 755 {} \;
find /var/www/profile.jegdn.com -type f -exec chmod 644 {} \;
chmod 600 /var/www/profile.jegdn.com/.env
```

### Issue 4: SSL Certificate Issues

```bash
# Check certificate
certbot certificates

# Renew certificate
certbot renew --force-renewal

# Test Nginx config
nginx -t
```

---

## 💰 Chi Phí Ước Tính

| Item | Cost (Monthly) |
|------|----------------|
| DigitalOcean Droplet (2GB) | $12 |
| Domain (đã có) | $0 |
| SSL Certificate (Let's Encrypt) | $0 |
| **Total** | **$12/month** |

**So sánh với Shared Hosting:**
- Shared Hosting: ~$5-10/month (nhưng có giới hạn resources)
- VPS: $12/month (dedicated resources, full control)

---

## 📞 Support & Resources

### DigitalOcean Resources
- Docs: https://docs.digitalocean.com
- Community: https://www.digitalocean.com/community
- Support: https://cloud.digitalocean.com/support

### Server Management
- SSH Access: `ssh root@[DROPLET_IP]`
- Nginx Docs: https://nginx.org/en/docs/
- PHP-FPM: https://www.php.net/manual/en/install.fpm.php
- MySQL: https://dev.mysql.com/doc/

---

## ✅ Next Steps After Migration

1. **Update Electron App:**
   - Build new version với API URL mới
   - Distribute cho team

2. **Monitor Performance:**
   - Setup monitoring tools (optional): Netdata, Grafana
   - Track API response times
   - Monitor server resources

3. **Optimize:**
   - Enable PHP OPcache
   - Configure MySQL query cache
   - Setup Redis (nếu cần caching)

4. **Security Hardening:**
   - Change SSH port (optional)
   - Setup fail2ban
   - Regular security updates

---

**🎉 Chúc mừng! Bạn đã hoàn thành migration sang DigitalOcean!**

Nếu cần hỗ trợ, hãy check logs và troubleshooting section ở trên.
