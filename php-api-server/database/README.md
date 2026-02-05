# Database Setup Guide

## Setup Instructions

### 1. Create Database Tables

Run the following SQL scripts in order:

```bash
# 1. Create users table
mysql -u your_username -p your_database < create_users_table.sql

# 2. Create sessions table
mysql -u your_username -p your_database < create_sessions_table.sql

# 3. Insert users data
mysql -u your_username -p your_database < insert_users.sql
```

### 2. Database Schema

#### Users Table
- `id`: User ID (VARCHAR 36)
- `userName`: Username for login (UNIQUE)
- `fullName`: Full name
- `email`: Email address
- `phone`: Phone number
- `address`: Address
- `password`: Bcrypt hashed password
- `roles`: User role (1=Admin, 3=Seller)
- `status`: Account status (1=Active)
- `created_at`: Creation timestamp

#### Sessions Table
- `id`: Session ID (AUTO_INCREMENT)
- `user_id`: Foreign key to users table
- `token`: Authentication token (64 chars, UNIQUE)
- `expires_at`: Token expiration datetime
- `created_at`: Session creation timestamp

### 3. Test Users

**Admin User:**
- Username: `admin.tu`
- Password: Check `passwordText` field in original users.json

**Seller Users:**
- Various usernames with roles=3
- Passwords: Check `passwordText` field in original users.json

### 4. API Endpoints

#### Login
```
POST /api/auth/login
Body: { "userName": "admin.tu", "password": "your_password" }
Response: { "success": true, "data": { "user": {...}, "token": "...", "expiresAt": "..." } }
```

#### Validate Token
```
POST /api/auth/validate
Headers: { "Authorization": "Bearer YOUR_TOKEN" }
Response: { "success": true, "data": { "id": "...", "userName": "...", ... } }
```

#### Logout
```
POST /api/auth/logout
Headers: { "Authorization": "Bearer YOUR_TOKEN" }
Response: { "success": true, "message": "Logged out successfully" }
```

## Notes

- Passwords are hashed using bcrypt (Laravel's default)
- Tokens expire after 7 days
- Only users with roles 1 (Admin) and 3 (Seller) are included
- Inactive users (status != 1) cannot login
