# Migration Checklist - Shared Hosting → DigitalOcean

## 📋 Pre-Migration (Chuẩn Bị)

### 1. Backup từ Shared Hosting
- [ ] Export database từ phpMyAdmin (file .sql)
- [ ] Download toàn bộ files PHP từ cPanel File Manager
- [ ] Backup file `.env` và ghi lại tất cả credentials
- [ ] Export danh sách users (nếu có)
- [ ] Screenshot cấu hình quan trọng

**Lưu vào:** `D:\JEG DEV\Backups\[DATE]_shared_hosting_backup\`

### 2. Chuẩn Bị Thông Tin

Ghi lại thông tin sau:

```
Domain hiện tại: profile.jegdn.com
Shared Hosting IP: ___________________
Database Name: ___________________
Database User: ___________________
Database Password: ___________________
GoLogin API Token: ___________________
Firebase Project ID: ___________________
```

### 3. Tạo DigitalOcean Account
- [ ] Đăng ký tài khoản DigitalOcean
- [ ] Thêm payment method
- [ ] Verify email

---

## 🚀 Migration Day (Ngày Chuyển)

### Phase 1: Setup VPS (30-45 phút)

#### 1.1 Tạo Droplet
- [ ] Login DigitalOcean: https://cloud.digitalocean.com
- [ ] Create → Droplets
- [ ] Chọn Ubuntu 22.04 LTS
- [ ] Chọn plan: $12/month (2GB RAM) - Recommended
- [ ] Chọn datacenter: Singapore
- [ ] Chọn authentication: SSH Key hoặc Password
- [ ] Hostname: `jeg-profile-server`
- [ ] Click "Create Droplet"
- [ ] **Ghi lại Droplet IP:** `___________________`

#### 1.2 Kết Nối SSH
```bash
ssh root@[DROPLET_IP]
```
- [ ] Kết nối thành công
- [ ] Update password (nếu dùng password auth)

#### 1.3 Upload Scripts
```bash
# Từ máy local
scp deployment-scripts/*.sh root@[DROPLET_IP]:/root/
```
- [ ] Scripts uploaded thành công

#### 1.4 Chạy Setup Script
```bash
# Trên server
cd /root
chmod +x *.sh
./setup-server.sh
```

**Nhập thông tin khi được hỏi:**
- [ ] MySQL root password: `___________________`
- [ ] Database name: `jeg_profiles`
- [ ] Database user: `jeg_user`
- [ ] Database password: `___________________`
- [ ] Domain: `profile.jegdn.com`

**Chờ script chạy xong (5-10 phút)**
- [ ] Setup hoàn tất, không có lỗi

---

### Phase 2: Deploy Application (20-30 phút)

#### 2.1 Upload Code
```bash
# Option 1: SCP từ local
scp -r php-api-server/* root@[DROPLET_IP]:/var/www/profile.jegdn.com/

# Option 2: Git
cd /var/www/profile.jegdn.com
git clone [REPO_URL] tmp
mv tmp/php-api-server/* .
rm -rf tmp
```
- [ ] Code uploaded thành công

#### 2.2 Upload Firebase Key (nếu có)
```bash
scp php-api-server/serviceAccountKey.json root@[DROPLET_IP]:/var/www/profile.jegdn.com/
```
- [ ] Firebase key uploaded

#### 2.3 Chạy Deploy Script
```bash
./deploy-app.sh
```

**Nhập thông tin:**
- [ ] Domain: `profile.jegdn.com`
- [ ] GoLogin API Token: `[YOUR_TOKEN]`
- [ ] Database backup file path: `/tmp/backup.sql` (nếu có)
- [ ] Email for SSL: `your-email@example.com`
- [ ] Install SSL now: `y`

**Chờ script chạy xong**
- [ ] Deploy hoàn tất
- [ ] SSL certificate installed
- [ ] API endpoints tested OK

---

### Phase 3: DNS Update (5 phút + 30 phút chờ)

#### 3.1 Cập Nhật DNS
- [ ] Login vào domain registrar (GoDaddy/Namecheap/etc)
- [ ] Vào DNS Management
- [ ] Update A record:
  ```
  Type: A
  Name: profile (hoặc @)
  Value: [DROPLET_IP]
  TTL: 3600
  ```
- [ ] Save changes

#### 3.2 Kiểm Tra DNS Propagation
```bash
# Từ máy local
nslookup profile.jegdn.com
# hoặc
ping profile.jegdn.com
```
- [ ] DNS trỏ đúng về Droplet IP
- **Thời gian chờ:** 5-30 phút

---

### Phase 4: Testing (15-20 phút)

#### 4.1 Test API từ Browser
- [ ] `https://profile.jegdn.com/` → Thấy welcome message
- [ ] `https://profile.jegdn.com/api/` → Thấy API info
- [ ] SSL certificate valid (ổ khóa xanh)

#### 4.2 Test API Endpoints
```bash
# Test auth endpoint
curl https://profile.jegdn.com/api/auth/login

# Test GoLogin connection
curl https://profile.jegdn.com/api/gologin/test-connection
```
- [ ] Endpoints trả về response hợp lệ

#### 4.3 Test Database
- [ ] Login MySQL: `mysql -u jeg_user -p jeg_profiles`
- [ ] Check tables: `SHOW TABLES;`
- [ ] Check data: `SELECT COUNT(*) FROM users;`
- [ ] Data đầy đủ

#### 4.4 Check Logs
```bash
jeg-logs.sh
```
- [ ] Không có errors nghiêm trọng

---

### Phase 5: Update Electron App (10 phút)

#### 5.1 Update API URL
```bash
# Trên máy local
cd chrome-profile-tool
nano .env
```

**Update:**
```env
API_BASE_URL=https://profile.jegdn.com/api
```
- [ ] .env updated

#### 5.2 Test App
```bash
npm run dev
```

**Test các chức năng:**
- [ ] Login thành công
- [ ] List profiles
- [ ] Launch profile
- [ ] Proxy management
- [ ] Tất cả features hoạt động bình thường

#### 5.3 Build Production Version
```bash
npm run build
npm run package
```
- [ ] Build thành công
- [ ] Installer files created

---

### Phase 6: Rollout to Team (Theo kế hoạch)

#### 6.1 Thông Báo Team
- [ ] Email/Slack thông báo về API URL mới
- [ ] Hướng dẫn cài đặt app version mới
- [ ] Thời gian downtime (nếu có)

#### 6.2 Distribute App
- [ ] Upload installer lên shared folder
- [ ] Gửi link download cho team
- [ ] Hỗ trợ team cài đặt

#### 6.3 Monitor Usage
- [ ] Check logs trong 24h đầu
- [ ] Theo dõi server resources
- [ ] Thu thập feedback từ team

---

## 🔍 Post-Migration Verification (Sau 24-48h)

### System Health
- [ ] Server uptime: `uptime`
- [ ] Disk usage < 50%: `df -h`
- [ ] Memory usage < 80%: `free -h`
- [ ] No critical errors in logs

### Application Health
- [ ] All API endpoints working
- [ ] Database queries performing well
- [ ] SSL certificate valid
- [ ] Backups running automatically

### User Feedback
- [ ] Team có thể login
- [ ] Profiles launch bình thường
- [ ] Không có complaints về performance
- [ ] Tất cả features hoạt động

---

## 🧹 Cleanup (Sau 1 tuần)

### Nếu Mọi Thứ OK:

#### 1. Cancel Shared Hosting
- [ ] Backup lần cuối từ shared hosting
- [ ] Cancel hosting subscription
- [ ] Request refund (nếu có)

#### 2. Remove Test Files
```bash
# Trên VPS
rm /var/www/profile.jegdn.com/test.php
rm /var/www/profile.jegdn.com/debug*.php
```
- [ ] Test files removed

#### 3. Document Everything
- [ ] Update team documentation
- [ ] Save all credentials securely
- [ ] Document server setup
- [ ] Create runbook for common tasks

---

## 🚨 Rollback Plan (Nếu Có Vấn Đề)

### Nếu Migration Thất Bại:

1. **Revert DNS:**
   - Point DNS back to shared hosting IP
   - Wait for propagation

2. **Update Electron App:**
   - Revert to old API URL
   - Redistribute old version

3. **Investigate Issues:**
   - Check server logs
   - Check database
   - Test API endpoints
   - Fix issues

4. **Retry Migration:**
   - Fix identified issues
   - Try again

---

## 📊 Success Metrics

Migration thành công khi:

- ✅ API response time < 500ms
- ✅ Uptime > 99.9%
- ✅ Zero data loss
- ✅ All features working
- ✅ Team satisfied with performance
- ✅ No critical bugs reported
- ✅ Backups running successfully
- ✅ SSL certificate valid

---

## 📞 Emergency Contacts

**DigitalOcean Support:**
- Dashboard: https://cloud.digitalocean.com/support
- Community: https://www.digitalocean.com/community

**Team Contacts:**
```
Tech Lead: ___________________
DevOps: ___________________
Database Admin: ___________________
```

**Critical Credentials Location:**
```
Password Manager: ___________________
Backup Location: ___________________
Documentation: ___________________
```

---

## 📝 Notes & Issues

**Migration Date:** ___________________

**Issues Encountered:**
```
1. 
2. 
3. 
```

**Solutions Applied:**
```
1. 
2. 
3. 
```

**Lessons Learned:**
```
1. 
2. 
3. 
```

---

## ✅ Final Sign-off

- [ ] Migration completed successfully
- [ ] All tests passed
- [ ] Team notified and trained
- [ ] Documentation updated
- [ ] Monitoring in place
- [ ] Backups verified
- [ ] Old hosting cancelled

**Completed by:** ___________________
**Date:** ___________________
**Signature:** ___________________

---

**🎉 Migration Complete! Welcome to DigitalOcean!**
