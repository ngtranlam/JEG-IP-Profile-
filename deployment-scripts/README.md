# Deployment Scripts - Quick Start Guide

## 📁 Scripts Overview

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `setup-server.sh` | Initial server setup (LEMP stack) | First time setup on new VPS |
| `deploy-app.sh` | Deploy PHP application | After server setup |
| `backup-restore.sh` | Backup and restore database | Regular backups & migration |

---

## 🚀 Quick Start - Complete Migration

### Step 1: Prepare Local Machine

```bash
# Navigate to project directory
cd "D:\JEG DEV\JEG-IP-Profile-"

# Make scripts executable (if on Linux/Mac)
chmod +x deployment-scripts/*.sh
```

### Step 2: Create DigitalOcean Droplet

1. Login to DigitalOcean
2. Create Droplet:
   - **OS:** Ubuntu 22.04 LTS
   - **Plan:** $12/month (2GB RAM)
   - **Region:** Singapore
   - **Authentication:** SSH Key or Password
3. Note the Droplet IP address

### Step 3: Upload Scripts to Server

```bash
# From local machine
scp deployment-scripts/*.sh root@YOUR_DROPLET_IP:/root/

# SSH into server
ssh root@YOUR_DROPLET_IP
```

### Step 4: Run Setup Script

```bash
# On the server
cd /root
chmod +x *.sh

# Run server setup (takes 5-10 minutes)
./setup-server.sh
```

**What it does:**
- ✅ Updates system packages
- ✅ Installs Nginx
- ✅ Installs MySQL 8.0
- ✅ Creates database and user
- ✅ Installs PHP 8.1 + extensions
- ✅ Installs Composer
- ✅ Configures Nginx
- ✅ Sets up firewall
- ✅ Creates .env template
- ✅ Sets up automatic database backups

**You will be prompted for:**
- MySQL root password
- Database name (default: jeg_profiles)
- Database username (default: jeg_user)
- Database password
- Domain name (default: profile.jegdn.com)

### Step 5: Upload Application Files

**Option A: Using SCP (from local machine)**

```bash
# Upload PHP application
scp -r php-api-server/* root@YOUR_DROPLET_IP:/var/www/profile.jegdn.com/

# Upload serviceAccountKey.json (if using Firebase)
scp php-api-server/serviceAccountKey.json root@YOUR_DROPLET_IP:/var/www/profile.jegdn.com/
```

**Option B: Using Git**

```bash
# On the server
cd /var/www/profile.jegdn.com
git clone https://github.com/ngtranlam/JEG-IP-Profile-.git tmp
mv tmp/php-api-server/* .
rm -rf tmp
```

**Option C: Using SFTP Client**

- Use FileZilla, WinSCP, or Cyberduck
- Connect to: `YOUR_DROPLET_IP`
- Upload to: `/var/www/profile.jegdn.com/`

### Step 6: Run Deployment Script

```bash
# On the server
cd /root
./deploy-app.sh
```

**What it does:**
- ✅ Installs Composer dependencies
- ✅ Sets correct file permissions
- ✅ Updates .env with GoLogin token
- ✅ Imports database (optional)
- ✅ Installs SSL certificate (optional)
- ✅ Restarts services
- ✅ Tests API endpoints
- ✅ Creates maintenance scripts

**You will be prompted for:**
- GoLogin API token
- Database backup file (if you have one)
- Email for SSL certificate
- Whether to install SSL now

### Step 7: Update DNS

1. Go to your domain registrar (GoDaddy, Namecheap, etc.)
2. Update A record:
   ```
   Type: A
   Name: profile (or @)
   Value: YOUR_DROPLET_IP
   TTL: 3600
   ```
3. Wait 5-30 minutes for DNS propagation

### Step 8: Test Everything

```bash
# On the server - check status
jeg-status.sh

# Test API from browser
https://profile.jegdn.com/
https://profile.jegdn.com/api/

# View logs
jeg-logs.sh
```

### Step 9: Update Electron App

```bash
# On local machine
cd chrome-profile-tool

# Update .env
echo "API_BASE_URL=https://profile.jegdn.com/api" > .env

# Rebuild app
npm run build
npm run package

# Distribute new version to team
```

---

## 🔧 Maintenance Commands

After deployment, these commands are available on the server:

```bash
# Check system and service status
jeg-status.sh

# View application logs
jeg-logs.sh

# Clear application cache
jeg-clear-cache.sh

# Manual database backup
/usr/local/bin/backup-database.sh

# View backup files
ls -lh /var/backups/mysql/
```

---

## 📊 Monitoring & Logs

### View Real-time Logs

```bash
# Nginx access log
tail -f /var/log/nginx/profile.jegdn.com-access.log

# Nginx error log
tail -f /var/log/nginx/profile.jegdn.com-error.log

# PHP-FPM log
tail -f /var/log/php8.1-fpm.log

# MySQL error log
tail -f /var/log/mysql/error.log
```

### Check Service Status

```bash
# Nginx
systemctl status nginx

# PHP-FPM
systemctl status php8.1-fpm

# MySQL
systemctl status mysql

# Firewall
ufw status verbose
```

### Resource Usage

```bash
# Disk usage
df -h

# Memory usage
free -h

# CPU and processes
htop

# Network connections
netstat -tulpn
```

---

## 🔄 Database Backup & Restore

### Manual Backup

```bash
# Create backup
mysqldump -u jeg_user -p jeg_profiles | gzip > backup_$(date +%Y%m%d).sql.gz

# Download to local machine
scp root@YOUR_DROPLET_IP:/path/to/backup.sql.gz ./
```

### Restore from Backup

```bash
# Upload backup to server
scp backup.sql.gz root@YOUR_DROPLET_IP:/tmp/

# On server - restore
gunzip /tmp/backup.sql.gz
mysql -u jeg_user -p jeg_profiles < /tmp/backup.sql
```

### Automatic Backups

Backups run automatically every day at 2 AM:
- Location: `/var/backups/mysql/`
- Retention: 7 days
- Format: `jeg_profiles_YYYYMMDD_HHMMSS.sql.gz`

---

## 🚨 Troubleshooting

### Issue: 502 Bad Gateway

```bash
# Check PHP-FPM
systemctl status php8.1-fpm
systemctl restart php8.1-fpm

# Check Nginx
systemctl status nginx
nginx -t
systemctl restart nginx
```

### Issue: Database Connection Failed

```bash
# Check MySQL
systemctl status mysql

# Test connection
mysql -u jeg_user -p jeg_profiles

# Check .env file
cat /var/www/profile.jegdn.com/.env
```

### Issue: Permission Denied

```bash
# Fix permissions
cd /var/www/profile.jegdn.com
chown -R www-data:www-data .
find . -type d -exec chmod 755 {} \;
find . -type f -exec chmod 644 {} \;
chmod 600 .env
```

### Issue: SSL Certificate Problems

```bash
# Check certificate
certbot certificates

# Renew certificate
certbot renew --force-renewal

# Test Nginx config
nginx -t
systemctl reload nginx
```

### Issue: High Memory Usage

```bash
# Check what's using memory
ps aux --sort=-%mem | head -n 10

# Restart PHP-FPM to clear memory
systemctl restart php8.1-fpm

# Optimize MySQL (if needed)
mysql_tuner
```

---

## 🔐 Security Checklist

After deployment, verify:

- [ ] Firewall is enabled (UFW)
- [ ] Only ports 22, 80, 443 are open
- [ ] SSL certificate is installed
- [ ] .env file has correct permissions (600)
- [ ] MySQL root login is secured
- [ ] Database user has minimal privileges
- [ ] Nginx security headers are set
- [ ] Directory listing is disabled
- [ ] Sensitive files are protected (.env, .git, logs)

---

## 📈 Performance Optimization (Optional)

### Enable PHP OPcache

```bash
# Edit PHP config
nano /etc/php/8.1/fpm/php.ini

# Add/uncomment:
opcache.enable=1
opcache.memory_consumption=128
opcache.interned_strings_buffer=8
opcache.max_accelerated_files=4000
opcache.revalidate_freq=60

# Restart PHP-FPM
systemctl restart php8.1-fpm
```

### Enable Nginx Caching

```bash
# Edit Nginx config
nano /etc/nginx/sites-available/profile.jegdn.com

# Add inside server block:
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Reload Nginx
systemctl reload nginx
```

### Optimize MySQL

```bash
# Install MySQL Tuner
wget http://mysqltuner.pl/ -O mysqltuner.pl
chmod +x mysqltuner.pl

# Run tuner
./mysqltuner.pl

# Follow recommendations
```

---

## 🆘 Emergency Procedures

### Rollback to Previous Version

```bash
# If you have a backup
cd /var/www/profile.jegdn.com
mv current_version backup_$(date +%Y%m%d)
# Upload previous version
# Restore database from backup
```

### Restart All Services

```bash
systemctl restart nginx
systemctl restart php8.1-fpm
systemctl restart mysql
```

### Check All Logs

```bash
jeg-logs.sh
# Or manually:
tail -n 100 /var/log/nginx/profile.jegdn.com-error.log
tail -n 100 /var/log/php8.1-fpm.log
tail -n 100 /var/log/mysql/error.log
```

---

## 📞 Support Resources

### DigitalOcean
- Docs: https://docs.digitalocean.com
- Community: https://www.digitalocean.com/community
- Support: https://cloud.digitalocean.com/support

### Server Stack
- Nginx: https://nginx.org/en/docs/
- PHP: https://www.php.net/docs.php
- MySQL: https://dev.mysql.com/doc/

### Monitoring Tools
- Netdata: https://www.netdata.cloud/
- Grafana: https://grafana.com/
- UptimeRobot: https://uptimerobot.com/

---

## ✅ Post-Migration Checklist

- [ ] Server setup completed
- [ ] Application deployed
- [ ] Database imported
- [ ] SSL certificate installed
- [ ] DNS updated and propagated
- [ ] API endpoints tested
- [ ] Electron app updated
- [ ] Team notified of new API URL
- [ ] Backups configured and tested
- [ ] Monitoring set up
- [ ] Documentation updated
- [ ] Old hosting cancelled (after confirming everything works)

---

**🎉 Congratulations! Your application is now running on DigitalOcean!**

For detailed step-by-step instructions, see: `DIGITALOCEAN_MIGRATION_GUIDE.md`
