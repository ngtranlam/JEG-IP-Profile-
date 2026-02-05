# Chrome Profile Tool - PHP API Server

Đây là PHP API Server cho ứng dụng Chrome Profile Tool, hoạt động như một proxy/gateway cho cả MySQL database và GoLogin API.

## Cấu trúc thư mục

```
php-api-server/
├── api/
│   ├── profiles.php      # Profile management endpoints
│   ├── proxies.php       # Proxy management endpoints
│   └── gologin.php       # GoLogin API proxy endpoints
├── config/
│   ├── database.php      # Database connection class
│   ├── gologin.php       # GoLogin API client
│   └── config.php        # Main configuration
├── services/
│   ├── ProfileService.php # Profile business logic
│   └── ProxyService.php   # Proxy business logic
├── logs/                 # Log files (auto-created)
├── .env                  # Environment variables (create from .env.example)
├── .env.example          # Environment template
├── .htaccess            # Apache configuration
├── index.php            # Main router
└── README.md            # This file
```

## Cài đặt trên StableHost

### Bước 1: Upload files

1. Tải toàn bộ thư mục `php-api-server` lên subdomain của bạn
2. Đường dẫn: `/public_html/` (của subdomain)

### Bước 2: Cấu hình Environment

1. Copy `.env.example` thành `.env`
2. Cập nhật thông tin database và API token:

```env
# Database Configuration
DB_HOST=localhost
DB_NAME=your_database_name
DB_USERNAME=your_database_username
DB_PASSWORD=your_database_password

# GoLogin API Configuration
GOLOGIN_API_TOKEN=your_gologin_api_token_here

# Encryption Key for passwords
ENCRYPTION_KEY=your-secret-encryption-key-change-this

# Environment
ENVIRONMENT=production
```

### Bước 3: Cấu hình Database

API sẽ tự động tạo các bảng cần thiết khi chạy lần đầu:
- `profiles` - Lưu thông tin profiles local
- `proxies` - Lưu thông tin proxy servers

### Bước 4: Test API

Truy cập: `https://your-subdomain.yourdomain.com/`

Bạn sẽ thấy response:
```json
{
  "message": "Chrome Profile Tool API Server",
  "status": "running",
  "version": "1.0.0"
}
```

## API Endpoints

### Profile Management

- `GET /api/profiles` - Lấy danh sách profiles
- `POST /api/profiles` - Tạo profile mới
- `GET /api/profiles/{id}` - Lấy thông tin profile
- `PUT /api/profiles/{id}` - Cập nhật profile
- `DELETE /api/profiles/{id}` - Xóa profile

### Proxy Management

- `GET /api/proxies` - Lấy danh sách proxies
- `POST /api/proxies` - Tạo proxy mới
- `GET /api/proxies/{id}` - Lấy thông tin proxy
- `PUT /api/proxies/{id}` - Cập nhật proxy
- `DELETE /api/proxies/{id}` - Xóa proxy
- `POST /api/proxies/{id}/validate` - Kiểm tra proxy
- `POST /api/proxies/{id}/rotate-ip` - Đổi IP proxy

### GoLogin API Proxy

- `GET /api/gologin` - Lấy danh sách GoLogin profiles
- `POST /api/gologin` - Tạo GoLogin profile
- `GET /api/gologin/{id}` - Lấy thông tin GoLogin profile
- `PUT /api/gologin/{id}` - Cập nhật GoLogin profile
- `DELETE /api/gologin/{id}` - Xóa GoLogin profile
- `POST /api/gologin/{id}/launch` - Khởi chạy profile
- `POST /api/gologin/{id}/stop` - Dừng profile
- `POST /api/gologin/quick` - Tạo quick profile
- `GET /api/gologin/folders` - Lấy danh sách folders
- `POST /api/gologin/folders` - Tạo folder mới

## Bảo mật

- GoLogin API token được bảo vệ trên server
- Database credentials chỉ có trên server
- Proxy passwords được mã hóa AES-256-CBC
- CORS headers được cấu hình cho cross-origin requests
- Sensitive files (.env, logs) được bảo vệ bởi .htaccess

## Logs

- Error logs: `/logs/error.log`
- API sẽ tự động tạo thư mục logs nếu chưa có

## Troubleshooting

### Lỗi Database Connection
- Kiểm tra thông tin DB trong `.env`
- Đảm bảo database đã được tạo trong cPanel
- Kiểm tra user có quyền truy cập database

### Lỗi GoLogin API
- Kiểm tra `GOLOGIN_API_TOKEN` trong `.env`
- Test connection: `POST /api/gologin/test-connection`

### Lỗi CORS
- Kiểm tra `.htaccess` đã được upload
- Đảm bảo Apache mod_headers được enable

### Lỗi 500 Internal Server Error
- Kiểm tra `/logs/error.log`
- Đảm bảo PHP version >= 7.4
- Kiểm tra file permissions (755 cho thư mục, 644 cho files)
