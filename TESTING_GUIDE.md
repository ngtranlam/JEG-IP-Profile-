# Testing Guide - Authentication System

## ✅ Đã Hoàn Thành

1. ✅ Backend API với authentication endpoints
2. ✅ Frontend Login component với UI đẹp
3. ✅ Tích hợp authentication flow vào App.tsx
4. ✅ Logout button trong Sidebar
5. ✅ Build thành công

## 🧪 Test Authentication Flow

### Bước 1: Upload Files Lên Server

Upload các files sau lên server `https://profile.jegdn.com`:

```bash
php-api-server/
├── api/auth.php
├── services/UserService.php
└── index.php (updated)
```

### Bước 2: Setup Database

Chạy SQL scripts trên server:

```bash
# SSH vào server
ssh user@profile.jegdn.com

# Navigate to database folder
cd /path/to/php-api-server/database

# Run migrations
mysql -u username -p database_name < migrate.sql
mysql -u username -p database_name < insert_users.sql

# Verify
mysql -u username -p database_name -e "SELECT COUNT(*) FROM users;"
# Expected: 49 users
```

### Bước 3: Test API Endpoints

Test login API từ terminal:

```bash
# Test login với admin account
curl -X POST https://profile.jegdn.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "userName": "admin.tu",
    "password": "Dc73Yi5KzahQkTsO@123Q2"
  }'

# Expected response:
# {
#   "success": true,
#   "data": {
#     "user": {
#       "id": "24",
#       "userName": "admin.tu",
#       "fullName": "Trần Tứ",
#       "email": "trantutbqn@gmail.com",
#       "roles": "1"
#     },
#     "token": "abc123...",
#     "expiresAt": "2026-01-30 10:00:00"
#   }
# }
```

Test validate token:

```bash
# Replace YOUR_TOKEN with token from login response
curl -X POST https://profile.jegdn.com/api/auth/validate \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected response:
# {
#   "success": true,
#   "data": {
#     "id": "24",
#     "userName": "admin.tu",
#     ...
#   }
# }
```

### Bước 4: Test Electron App

```bash
cd chrome-profile-tool

# Build đã xong, chỉ cần run
npm run dev
```

### Bước 5: Test Login Flow

Khi app khởi động:

1. **Checking Authentication Screen**
   - App sẽ hiển thị "Checking authentication..." với spinner
   - Kiểm tra token đã lưu local

2. **Login Screen** (nếu chưa login)
   - Hiển thị form login với logo IEG
   - Input username và password
   - Click "Sign In"

3. **Test Login**
   - Username: `admin.tu`
   - Password: `Dc73Yi5KzahQkTsO@123Q2`
   - Click "Sign In"
   - Nếu thành công → Chuyển sang Dashboard

4. **Test Persistent Login**
   - Đóng app
   - Mở lại app
   - App sẽ tự động login (không cần nhập lại)

5. **Test Logout**
   - Click nút "Logout" ở Sidebar (màu đỏ)
   - App sẽ quay về Login screen
   - Token local đã bị xóa

### Bước 6: Test Error Cases

**Wrong Password:**
```
Username: admin.tu
Password: wrong_password
Expected: Error message "Invalid username or password"
```

**Non-existent User:**
```
Username: nonexistent
Password: anything
Expected: Error message "Invalid username or password"
```

**Inactive User:**
```
Username: (user with status != 1)
Expected: Error message "Invalid username or password"
```

## 🔍 Debugging

### Check Console Logs

**Main Process (Terminal):**
```
API Service initialized with base URL: https://profile.jegdn.com/api
User authenticated: { userName: 'admin.tu', ... }
```

**Renderer Process (DevTools):**
```
User authenticated: { id: '24', userName: 'admin.tu', ... }
```

### Check Token Storage

Token được lưu tại:
```
~/Library/Application Support/chrome-profile-tool/auth-token.json
```

View token:
```bash
cat ~/Library/Application\ Support/chrome-profile-tool/auth-token.json
```

### Check Database

```sql
-- Check users
SELECT * FROM users WHERE userName = 'admin.tu';

-- Check active sessions
SELECT * FROM sessions WHERE expires_at > NOW();

-- Check expired sessions
SELECT * FROM sessions WHERE expires_at <= NOW();
```

## ✨ Expected Behavior

### First Launch (No Token)
```
1. App starts
2. Show "Checking authentication..." (1-2 seconds)
3. Show Login screen
4. User enters credentials
5. Click Sign In
6. API validates credentials
7. Token saved locally
8. Show Dashboard
```

### Subsequent Launch (Has Valid Token)
```
1. App starts
2. Show "Checking authentication..." (1-2 seconds)
3. Validate token with API
4. Show Dashboard (auto-login)
```

### Logout
```
1. User clicks Logout button
2. Delete token from server
3. Delete token from local storage
4. Show Login screen
```

## 📊 Test Results Checklist

- [ ] Database có 49 users
- [ ] API login trả về token
- [ ] API validate token hoạt động
- [ ] App hiển thị Login screen khi chưa login
- [ ] Login thành công với credentials đúng
- [ ] Login thất bại với credentials sai
- [ ] Persistent login hoạt động (auto-login)
- [ ] Logout xóa token và quay về Login screen
- [ ] Token expire sau 7 ngày

## 🎯 Test Accounts

### Admin
- Username: `admin.tu`
- Password: `Dc73Yi5KzahQkTsO@123Q2`
- Role: 1 (Admin)

### Sellers
- Username: `minhductran1996` | Password: `minhductran1996`
- Username: `nguyen` | Password: `Dc73Yi5KzahQkTsO`
- Username: `huynhtan` | Password: Check users.json

## 🐛 Common Issues

### Issue: Login screen không hiển thị
**Solution:** Check console logs, verify API_BASE_URL trong .env

### Issue: Login failed
**Solution:** 
- Check database có users chưa
- Check password đúng chưa
- Check API endpoint accessible

### Issue: Token invalid
**Solution:**
- Token đã expire (> 7 days)
- Logout và login lại

### Issue: App không auto-login
**Solution:**
- Check token file exists
- Check token chưa expire
- Check API validate endpoint

---

**Status:** ✅ Ready for Testing
**Next:** Upload files và run database migration
