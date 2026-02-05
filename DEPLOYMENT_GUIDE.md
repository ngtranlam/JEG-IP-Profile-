# Hướng dẫn triển khai Chrome Profile Tool - Client-Server

## Tổng quan kiến trúc

```
[Electron Desktop App] → HTTP API → [PHP Server] → [MySQL Database]
                                          ↓
                                   [GoLogin API]
```

## Phần 1: Triển khai PHP API Server trên StableHost

### Bước 1: Chuẩn bị subdomain và database

1. **Tạo subdomain trong cPanel:**
   - Vào "Subdomains" 
   - Tạo subdomain mới (ví dụ: `api.yourdomain.com`)

2. **Tạo MySQL database:**
   - Vào "MySQL Databases"
   - Tạo database mới
   - Tạo user và gán quyền full cho database
   - Ghi lại thông tin: DB_NAME, DB_USERNAME, DB_PASSWORD

### Bước 2: Upload PHP API Server

1. **Upload files:**
   - Nén thư mục `php-api-server`
   - Upload lên thư mục `public_html` của subdomain
   - Giải nén

2. **Cấu hình .env:**
   ```bash
   # Copy file cấu hình
   cp .env.example .env
   ```
   
   Chỉnh sửa `.env`:
   ```env
   DB_HOST=localhost
   DB_NAME=your_database_name_here
   DB_USERNAME=your_db_username_here  
   DB_PASSWORD=your_db_password_here
   
   GOLOGIN_API_TOKEN=your_gologin_token_here
   ENCRYPTION_KEY=your-secret-key-change-this
   ENVIRONMENT=production
   ```

3. **Set file permissions:**
   - Thư mục: 755
   - Files: 644
   - `.env`: 600 (bảo mật)

### Bước 3: Test API Server

Truy cập: `https://api.yourdomain.com/`

Response thành công:
```json
{
  "message": "Chrome Profile Tool API Server",
  "status": "running", 
  "version": "1.0.0"
}
```

Test endpoints:
- `GET https://api.yourdomain.com/api/profiles`
- `GET https://api.yourdomain.com/api/proxies`
- `POST https://api.yourdomain.com/api/gologin/test-connection`

## Phần 2: Cấu hình Electron Desktop App

### Bước 1: Cập nhật cấu hình client

1. **Tạo file .env trong thư mục chrome-profile-tool:**
   ```env
   API_BASE_URL=https://api.yourdomain.com/api
   ```

2. **Build lại ứng dụng:**
   ```bash
   cd chrome-profile-tool
   npm run build
   ```

### Bước 2: Đóng gói ứng dụng cho nhân viên

1. **Build cho production:**
   ```bash
   npm run dist
   ```

2. **Tạo installer:**
   - Windows: `.exe` file trong `dist/`
   - macOS: `.dmg` file trong `dist/`
   - Linux: `.AppImage` file trong `dist/`

## Phần 3: Phân phối cho nhân viên

### Cách 1: Download trực tiếp
1. Upload installer lên server
2. Gửi link download cho nhân viên
3. Nhân viên tải về và cài đặt

### Cách 2: Shared folder
1. Đặt installer trong shared folder (Google Drive, Dropbox)
2. Chia sẻ quyền truy cập cho nhân viên

### Hướng dẫn cho nhân viên:

1. **Cài đặt ứng dụng:**
   - Tải file installer
   - Chạy và làm theo hướng dẫn cài đặt
   - Khởi động ứng dụng

2. **Sử dụng:**
   - Ứng dụng sẽ tự động kết nối với server API
   - Tất cả dữ liệu được đồng bộ qua server
   - Không cần cấu hình thêm gì

## Phần 4: Bảo trì và giám sát

### Logs và monitoring

1. **Server logs:**
   - Error logs: `/logs/error.log`
   - Access logs: cPanel → Raw Access Logs

2. **Database monitoring:**
   - cPanel → phpMyAdmin
   - Kiểm tra dung lượng và hiệu suất

### Backup

1. **Database backup:**
   - cPanel → Backup → Download Database Backup
   - Tự động hóa với cron jobs

2. **Files backup:**
   - Download toàn bộ thư mục API server
   - Backup file .env riêng biệt

### Updates

1. **Cập nhật API Server:**
   - Upload files mới
   - Giữ nguyên file .env
   - Test endpoints

2. **Cập nhật Desktop App:**
   - Build version mới
   - Phân phối installer mới cho nhân viên
   - Có thể implement auto-update

## Phần 5: Troubleshooting

### Lỗi thường gặp:

**1. API Server không hoạt động:**
- Kiểm tra .env configuration
- Kiểm tra database connection
- Xem error logs

**2. Desktop App không kết nối được:**
- Kiểm tra API_BASE_URL trong .env
- Test API endpoints bằng browser
- Kiểm tra firewall/network

**3. GoLogin API errors:**
- Kiểm tra GOLOGIN_API_TOKEN
- Test connection endpoint
- Kiểm tra GoLogin service status

**4. Database errors:**
- Kiểm tra MySQL user permissions
- Kiểm tra database disk space
- Restart MySQL service nếu cần

### Support contacts:
- Server issues: StableHost support
- Application issues: Development team
- GoLogin issues: GoLogin support

## Phần 6: Bảo mật

### Server security:
- ✅ Database credentials chỉ có trên server
- ✅ GoLogin API token được bảo vệ
- ✅ Proxy passwords được mã hóa
- ✅ HTTPS cho tất cả API calls
- ✅ .htaccess bảo vệ sensitive files

### Client security:
- ✅ Không lưu credentials local
- ✅ Tất cả requests qua HTTPS
- ✅ No direct database access
- ✅ API rate limiting

Kiến trúc này đảm bảo bảo mật tối đa và dễ dàng quản lý cho team của bạn!
