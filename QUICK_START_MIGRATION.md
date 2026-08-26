# 🚀 Quick Start - Migration to DigitalOcean

## TL;DR - 5 Bước Chính

```
1. Tạo Droplet → 2. Chạy setup-server.sh → 3. Upload code → 
4. Chạy deploy-app.sh → 5. Update DNS
```

**Thời gian:** ~2 giờ (bao gồm chờ DNS)

---

## 📦 Bước 1: Tạo DigitalOcean Droplet (5 phút)

1. Vào https://cloud.digitalocean.com
2. Create Droplet:
   - **OS:** Ubuntu 22.04 LTS
   - **Plan:** $12/month (2GB RAM)
   - **Region:** Singapore
3. Ghi lại IP: `___________________`

---

## 🔧 Bước 2: Setup Server (10 phút)

```bash
# SSH vào server
ssh root@YOUR_DROPLET_IP

# Upload script
# (Từ máy local)
scp deployment-scripts/setup-server.sh root@YOUR_DROPLET_IP:/root/

# Chạy setup
cd /root
chmod +x setup-server.sh
./setup-server.sh
```

**Nhập khi được hỏi:**
- MySQL root password
- Database name: `jeg_profiles`
- Database user: `jeg_user`
- Database password
- Domain: `profile.jegdn.com`

---

## 📁 Bước 3: Upload Code (5 phút)

```bash
# Từ máy local
scp -r php-api-server/* root@YOUR_DROPLET_IP:/var/www/profile.jegdn.com/

# Upload Firebase key (nếu có)
scp php-api-server/serviceAccountKey.json root@YOUR_DROPLET_IP:/var/www/profile.jegdn.com/
```

---

## 🚀 Bước 4: Deploy App (10 phút)

```bash
# Upload deploy script
scp deployment-scripts/deploy-app.sh root@YOUR_DROPLET_IP:/root/

# SSH vào server
ssh root@YOUR_DROPLET_IP

# Chạy deploy
cd /root
chmod +x deploy-app.sh
./deploy-app.sh
```

**Nhập khi được hỏi:**
- GoLogin API Token
- Database backup file (nếu có)
- Email for SSL certificate
- Install SSL: `y`

---

## 🌐 Bước 5: Update DNS (5 phút + 30 phút chờ)

1. Login vào domain registrar
2. Update A record:
   ```
   Type: A
   Name: profile
   Value: YOUR_DROPLET_IP
   TTL: 3600
   ```
3. Chờ DNS propagate (5-30 phút)

---

## ✅ Bước 6: Test & Verify (10 phút)

### Test API

```bash
# Test từ browser
https://profile.jegdn.com/
https://profile.jegdn.com/api/

# Test từ command line
curl https://profile.jegdn.com/
```

### Update Electron App

```bash
# Trên máy local
cd chrome-profile-tool

# Update .env
echo "API_BASE_URL=https://profile.jegdn.com/api" > .env

# Test
npm run dev

# Build
npm run build
npm run package
```

---

## 🎯 Checklist Nhanh

- [ ] Droplet created
- [ ] setup-server.sh completed
- [ ] Code uploaded
- [ ] deploy-app.sh completed
- [ ] DNS updated
- [ ] API tested OK
- [ ] Electron app updated
- [ ] Team notified

---

## 🚨 Troubleshooting Nhanh

### API không hoạt động?

```bash
# Check services
systemctl status nginx
systemctl status php8.1-fpm
systemctl status mysql

# Restart all
systemctl restart nginx php8.1-fpm mysql

# Check logs
jeg-logs.sh
```

### SSL không hoạt động?

```bash
# Install SSL manually
certbot --nginx -d profile.jegdn.com
```

### Database connection failed?

```bash
# Check .env
cat /var/www/profile.jegdn.com/.env

# Test MySQL
mysql -u jeg_user -p jeg_profiles
```

---

## 📚 Tài Liệu Chi Tiết

- **Full Guide:** `DIGITALOCEAN_MIGRATION_GUIDE.md`
- **Checklist:** `MIGRATION_CHECKLIST.md`
- **Scripts:** `deployment-scripts/README.md`

---

## 💰 Chi Phí

- **DigitalOcean Droplet:** $12/month
- **Domain:** $0 (đã có)
- **SSL:** $0 (Let's Encrypt)
- **Total:** $12/month

---

## 📞 Cần Hỗ Trợ?

1. Check `DIGITALOCEAN_MIGRATION_GUIDE.md` - Troubleshooting section
2. Check logs: `jeg-logs.sh`
3. DigitalOcean Community: https://www.digitalocean.com/community

---

**🎉 Done! Enjoy your new VPS!**
