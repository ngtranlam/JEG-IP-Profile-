# GoLogin Data Synchronization System - Hướng Dẫn Sử Dụng

## Tổng Quan

Hệ thống đồng bộ dữ liệu GoLogin cho phép lưu trữ folders và profiles từ GoLogin API vào database local, sau đó ứng dụng sẽ lấy dữ liệu từ database thay vì gọi trực tiếp GoLogin API.

## Bước 1: Tạo Database Tables

Chạy SQL script sau trong phpMyAdmin để tạo các tables cần thiết:

**File:** `php-api-server/database/gologin_sync_tables.sql`

```sql
-- Copy toàn bộ nội dung file gologin_sync_tables.sql và chạy trong phpMyAdmin
```

Script này sẽ tạo các tables:
- `gologin_folders` - Lưu trữ folders từ GoLogin
- `gologin_profiles` - Lưu trữ profiles từ GoLogin
- `gologin_profile_permissions` - Quản lý quyền truy cập của Seller
- `gologin_sync_log` - Theo dõi lịch sử đồng bộ

## Bước 2: Cấu Hình GoLogin API Token

Cần có GoLogin API token để đồng bộ dữ liệu. Có 2 cách cấu hình:

### Cách 1: Environment Variable
```bash
export GOLOGIN_API_TOKEN="your_gologin_api_token_here"
```

### Cách 2: Cập nhật trong GoLoginSyncService.php
```php
// File: php-api-server/services/GoLoginSyncService.php
private $goLoginToken = 'your_gologin_api_token_here';
```

## Bước 3: Đồng Bộ Dữ Liệu Lần Đầu

### Sử dụng API Endpoint

**Endpoint:** `POST /api/local_data/sync`

**Headers:**
```
Authorization: Bearer {your_auth_token}
Content-Type: application/json
```

**Body:**
```json
{
  "type": "full"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "folders_synced": 10,
    "profiles_synced": 150
  }
}
```

### Các Loại Sync

1. **Full Sync** - Đồng bộ cả folders và profiles:
```json
{ "type": "full" }
```

2. **Folders Only** - Chỉ đồng bộ folders:
```json
{ "type": "folders" }
```

3. **Profiles Only** - Chỉ đồng bộ profiles:
```json
{ "type": "profiles" }
```

## Bước 4: Sử Dụng API Endpoints Mới

### 1. Lấy Danh Sách Folders

**Endpoint:** `GET /api/local_data/folders`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "folder_id": "abc123",
      "name": "Marketing Team",
      "profilesCount": 25,
      "created_at": "2024-01-01 10:00:00",
      "synced_at": "2024-01-26 15:30:00"
    }
  ]
}
```

### 2. Lấy Danh Sách Profiles

**Endpoint:** `GET /api/local_data/profiles?page=1&limit=50`

**Query Parameters:**
- `page` - Số trang (default: 1)
- `limit` - Số profiles mỗi trang (default: 50)
- `search` - Tìm kiếm theo tên
- `folder` - Lọc theo folder_id

**Response:**
```json
{
  "success": true,
  "data": {
    "profiles": [...],
    "total": 150,
    "page": 1,
    "limit": 50,
    "totalPages": 3
  }
}
```

### 3. Lấy Thông Tin Profile Chi Tiết

**Endpoint:** `GET /api/local_data/profile/{profile_id}`

### 4. Lấy Dashboard Statistics

**Endpoint:** `GET /api/local_data/stats`

**Response:**
```json
{
  "success": true,
  "data": {
    "totalProfiles": 150,
    "runningProfiles": 5,
    "availableProfiles": 145
  }
}
```

### 5. Kiểm Tra Trạng Thái Sync

**Endpoint:** `GET /api/local_data/sync_status`

**Response:**
```json
{
  "success": true,
  "data": {
    "sync_type": "full",
    "status": "completed",
    "folders_synced": 10,
    "profiles_synced": 150,
    "started_at": "2024-01-26 15:30:00",
    "completed_at": "2024-01-26 15:32:00",
    "duration_seconds": 120
  }
}
```

## Bước 5: Quản Lý Permissions (Admin Only)

### Grant Permission cho Seller

**Endpoint:** `POST /api/local_data/grant_permission`

**Body - Grant folder access:**
```json
{
  "user_id": 35,
  "folder_id": "abc123",
  "permission_type": "view"
}
```

**Body - Grant profile access:**
```json
{
  "user_id": 35,
  "profile_id": "xyz789",
  "permission_type": "edit"
}
```

**Permission Types:**
- `view` - Xem profile/folder
- `edit` - Chỉnh sửa profile
- `delete` - Xóa profile
- `use` - Sử dụng profile

### Revoke Permission

**Endpoint:** `POST /api/local_data/revoke_permission`

**Body:**
```json
{
  "user_id": 35,
  "folder_id": "abc123"
}
```

## Bước 6: Tự Động Đồng Bộ (Cron Job)

Để tự động đồng bộ dữ liệu định kỳ, tạo cron job:

```bash
# Đồng bộ mỗi 30 phút
*/30 * * * * curl -X POST https://profile.jegdn.com/api/local_data/sync \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"full"}'
```

## Phân Quyền Theo Roles

### Admin (roles="1")
- ✅ Xem tất cả folders và profiles
- ✅ Đồng bộ dữ liệu từ GoLogin API
- ✅ Quản lý permissions cho Seller
- ✅ Truy cập tất cả endpoints

### Seller (roles="3")
- ✅ Chỉ xem folders/profiles được phân quyền
- ❌ Không thể đồng bộ dữ liệu
- ❌ Không thể quản lý permissions
- ✅ Xem dashboard stats của riêng họ

## Testing

### 1. Test Database Connection
```bash
curl -X GET https://profile.jegdn.com/api/local_data/test_connection \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Test Sync
```bash
curl -X POST https://profile.jegdn.com/api/local_data/sync \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"full"}'
```

### 3. Test Get Profiles
```bash
curl -X GET "https://profile.jegdn.com/api/local_data/profiles?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Lỗi: "GoLogin API request failed"
- Kiểm tra GoLogin API token có đúng không
- Kiểm tra kết nối internet
- Kiểm tra GoLogin API có hoạt động không

### Lỗi: "Access denied"
- Kiểm tra user có đúng role không
- Kiểm tra permissions đã được grant chưa
- Kiểm tra auth token còn hiệu lực không

### Dữ liệu không cập nhật
- Chạy sync manual: `POST /api/local_data/sync`
- Kiểm tra sync log: `GET /api/local_data/sync_status`
- Kiểm tra database tables có tồn tại không

## Database Schema

### gologin_folders
```sql
- id (PK)
- folder_id (UNIQUE) - GoLogin folder ID
- name
- created_at, updated_at, synced_at
```

### gologin_profiles
```sql
- id (PK)
- profile_id (UNIQUE) - GoLogin profile ID
- name, folder_id
- browser_type, os, user_agent
- screen_width, screen_height
- proxy_enabled, proxy_type, proxy_host, proxy_port
- status (active, running, stopped, deleted)
- can_be_running
- last_activity
- raw_data (Full JSON from GoLogin API)
- created_at, updated_at, synced_at
```

### gologin_profile_permissions
```sql
- id (PK)
- user_id (FK to users)
- folder_id, profile_id
- permission_type (view, edit, delete, use)
- created_at, updated_at
```

## Next Steps

1. ✅ Chạy SQL script tạo tables
2. ✅ Cấu hình GoLogin API token
3. ✅ Chạy sync lần đầu
4. ✅ Grant permissions cho Sellers
5. ✅ Cập nhật Electron app để sử dụng API mới
6. ✅ Setup cron job cho auto sync

## Support

Nếu gặp vấn đề, kiểm tra:
1. Database tables đã được tạo chưa
2. GoLogin API token có đúng không
3. Auth token còn hiệu lực không
4. User có đúng permissions không
