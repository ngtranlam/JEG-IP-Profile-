# Proxy Management API v2 - Bidirectional Sync Documentation

## Overview

This is a **supplementary document** for the Proxy Management API, covering the new **bidirectional synchronization** endpoints added in v2. These endpoints allow the Proxy App to **write data back to the web platform**, enabling full two-way sync.

**Base URL:** `http://jegdn.com/api/proxy`

**API Version:** 2.0

---

## What's New in v2

### Previous (v1) - One-way: Web → App
The app could only **read** data from the web (list, stats, detail, order).

### Now (v2) - Bidirectional: Web ↔ App
The app can now also **write/update** data back to the web:

| Category | Direction | Endpoints |
|----------|-----------|-----------|
| **Read** | Web → App | list, stats, detail, sellers |
| **Order** | App → Web → Proxy-Cheap | order-options, calculate-price, order |
| **Write** | App → Web | update-note, extend, add-manual, update-manual-expiration, change-whitelisted-ips, update-seller, delete |
| **Sync** | App → Web | sync, extension-price |

---

## Authentication (Same as v1)

All requests require:

```
X-API-Key: JEGTECHNOLOGY@2026
X-Username: {username}
Content-Type: application/json   (for POST requests)
```

---

## Complete Endpoint Reference

### READ Endpoints (Web → App)

| # | Method | Endpoint | Access | Description |
|---|--------|----------|--------|-------------|
| 1 | GET | `/list` | All | Get proxy list with filters |
| 2 | GET | `/stats` | All | Get proxy statistics |
| 3 | GET | `/detail/{id}` | All | Get proxy detail |
| 4 | GET | `/sellers` | Admin | Get sellers list |

### ORDER Endpoints (App → Web → Proxy-Cheap)

| # | Method | Endpoint | Access | Description |
|---|--------|----------|--------|-------------|
| 5 | POST | `/order-options` | All | Get available order options |
| 6 | POST | `/calculate-price` | All | Calculate order price |
| 7 | POST | `/order` | All | Place proxy order |

### WRITE Endpoints (App → Web) - NEW in v2

| # | Method | Endpoint | Access | Description |
|---|--------|----------|--------|-------------|
| 8 | POST | `/update-note/{id}` | All | Update proxy notes |
| 9 | POST | `/extension-price` | All | Calculate extension price |
| 10 | POST | `/extend` | All | Extend proxy period |
| 11 | POST | `/add-manual` | All | Add manual proxy |
| 12 | POST | `/update-manual-expiration` | All | Update manual proxy expiration |
| 13 | POST | `/change-whitelisted-ips` | All | Change whitelisted IPs |
| 14 | POST | `/update-seller` | Admin | Assign proxy to seller |
| 15 | POST | `/delete` | Admin | Delete proxy |

### SYNC Endpoints

| # | Method | Endpoint | Access | Description |
|---|--------|----------|--------|-------------|
| 16 | POST | `/sync` | All | Trigger full proxy sync |

---

## New Endpoints - Detailed Documentation

---

### 8. Update Proxy Note

Update notes/comments for a specific proxy. Notes are synced bidirectionally - changes from the app will reflect on the web and vice versa.

**Endpoint:** `POST /api/proxy/update-note/{id}`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Proxy ID |

**Request Body:**

```json
{
  "notes": "This proxy is used for US market - Etsy store"
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| notes | string | No | Proxy note content (max 1000 chars). Send `null` or empty to clear notes. |

**Request Example:**

```bash
curl -X POST "http://jegdn.com/api/proxy/update-note/1701295" \
  -H "X-API-Key: JEGTECHNOLOGY@2026" \
  -H "X-Username: seller123" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Used for US Etsy store"}'
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Note updated successfully",
  "data": {
    "proxy_id": "1701295",
    "notes": "Used for US Etsy store"
  }
}
```

**Permissions:**
- Sellers can only update notes on their own proxies
- Admins can update notes on any proxy

---

### 9. Calculate Extension Price

Calculate the price to extend a proxy's period before actually extending it.

**Endpoint:** `POST /api/proxy/extension-price`

**Request Body:**

```json
{
  "proxy_id": "1701295",
  "period_in_months": 3
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| proxy_id | string | Yes | Proxy ID to extend |
| period_in_months | integer | Yes | Extension period (1-12 months) |

**Request Example:**

```bash
curl -X POST "http://jegdn.com/api/proxy/extension-price" \
  -H "X-API-Key: JEGTECHNOLOGY@2026" \
  -H "X-Username: seller123" \
  -H "Content-Type: application/json" \
  -d '{"proxy_id": "1701295", "period_in_months": 3}'
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "price": 10.17,
    "currency": "USD",
    "period": 3,
    "unit": "months"
  }
}
```

**Permissions:**
- Sellers can only check price for their own proxies
- Admins can check price for any proxy

---

### 10. Extend Proxy Period

Extend an active proxy's subscription period. **This charges real money.**

**Endpoint:** `POST /api/proxy/extend`

**Request Body:**

```json
{
  "proxy_id": "1701295",
  "period_in_months": 3,
  "coupon_code": "SAVE10"
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| proxy_id | string | Yes | Proxy ID to extend |
| period_in_months | integer | Yes | Extension period (1-12 months) |
| coupon_code | string | No | Optional coupon code for discount |

**Request Example:**

```bash
curl -X POST "http://jegdn.com/api/proxy/extend" \
  -H "X-API-Key: JEGTECHNOLOGY@2026" \
  -H "X-Username: seller123" \
  -H "Content-Type: application/json" \
  -d '{"proxy_id": "1701295", "period_in_months": 3}'
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Proxy extended successfully",
  "data": {
    "proxy_id": "1701295",
    "expires_at": "2026-06-15T10:30:00.000000Z",
    "expires_formatted": "2026-06-15 10:30",
    "api_response": {
      "success": true,
      "newExpiresAt": "2026-06-15T10:30:00Z"
    }
  }
}
```

**Error - Proxy Expired (400):**

```json
{
  "success": false,
  "message": "Proxy has expired and cannot be extended. Please contact IT department.",
  "error_code": "PROXY_EXPIRED"
}
```

**Important Notes:**
- **This endpoint charges real money** - always call `extension-price` first to show the user the cost
- Expired proxies cannot be extended
- Sellers can only extend their own proxies
- The system automatically updates the local database with the new expiration date

---

### 11. Add Manual Proxy

Add a manually configured proxy entry (not from Proxy-Cheap). Useful for proxies from other providers.

**Endpoint:** `POST /api/proxy/add-manual`

**Request Body:**

```json
{
  "location": "US",
  "isp": "Custom ISP",
  "expires": "2026-12-31",
  "connect_ip": "192.168.1.100",
  "proxy_username": "myuser",
  "proxy_password": "mypass123",
  "http_port": 8080,
  "notes": "Proxy from alternative provider"
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| location | string | Yes | Country code, 2 characters (e.g., `US`, `GB`) |
| isp | string | Yes | ISP name (max 255 chars) |
| expires | date | Yes | Expiration date (format: `YYYY-MM-DD`) |
| connect_ip | string | Yes | Proxy IP address (must be valid IP) |
| proxy_username | string | Yes | Proxy authentication username |
| proxy_password | string | Yes | Proxy authentication password |
| http_port | integer | Yes | HTTP port number (1-65535) |
| notes | string | No | Optional notes (max 1000 chars) |

**Request Example:**

```bash
curl -X POST "http://jegdn.com/api/proxy/add-manual" \
  -H "X-API-Key: JEGTECHNOLOGY@2026" \
  -H "X-Username: seller123" \
  -H "Content-Type: application/json" \
  -d '{
    "location": "US",
    "isp": "Custom ISP",
    "expires": "2026-12-31",
    "connect_ip": "192.168.1.100",
    "proxy_username": "myuser",
    "proxy_password": "mypass123",
    "http_port": 8080,
    "notes": "From alternative provider"
  }'
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Manual proxy added successfully",
  "data": {
    "id": "manual_1710000000_1234",
    "display_id": "🇺🇸 manual_1710000000_1234",
    "status": "ACTIVE",
    "network_type": "MANUAL",
    "country_code": "US",
    "public_ip": "192.168.1.100",
    "connect_ip": "192.168.1.100",
    "http_port": "8080",
    "username": "myuser",
    "password": "mypass123",
    "isp_name": "Custom ISP",
    "monthly_cost": "0.00",
    "expires_at": "2026-12-31T00:00:00.000000Z",
    "source": "manual",
    "is_manual": true,
    "notes": "From alternative provider"
  }
}
```

**Notes:**
- Manual proxies are assigned to the requesting user automatically
- Manual proxies have `monthly_cost = 0` (no cost tracking)
- Manual proxies have `source = "manual"` and `is_manual = true`
- The proxy ID is auto-generated with prefix `manual_`

---

### 12. Update Manual Proxy Expiration

Update the expiration date for a manual proxy only.

**Endpoint:** `POST /api/proxy/update-manual-expiration`

**Request Body:**

```json
{
  "proxy_id": "manual_1710000000_1234",
  "expires_at": "2027-06-30 23:59:59"
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| proxy_id | string | Yes | Proxy ID (must be a manual proxy) |
| expires_at | datetime | Yes | New expiration date (must be in the future) |

**Request Example:**

```bash
curl -X POST "http://jegdn.com/api/proxy/update-manual-expiration" \
  -H "X-API-Key: JEGTECHNOLOGY@2026" \
  -H "X-Username: seller123" \
  -H "Content-Type: application/json" \
  -d '{"proxy_id": "manual_1710000000_1234", "expires_at": "2027-06-30 23:59:59"}'
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Proxy expiration date updated successfully",
  "data": {
    "proxy_id": "manual_1710000000_1234",
    "expires_at": "2027-06-30 23:59:59",
    "expires_formatted": "2027-06-30 23:59"
  }
}
```

**Error - Not Manual Proxy (403):**

```json
{
  "success": false,
  "message": "Only manual proxies can have their expiration date edited",
  "error_code": "NOT_MANUAL_PROXY"
}
```

**Notes:**
- Only manual proxies (source = "manual") can have their expiration edited
- API proxies have their expiration managed by Proxy-Cheap (use `extend` instead)
- The new expiration date must be in the future

---

### 13. Change Whitelisted IPs

Update the list of whitelisted IPs for a proxy. For API proxies, this also updates on the Proxy-Cheap side.

**Endpoint:** `POST /api/proxy/change-whitelisted-ips`

**Request Body:**

```json
{
  "proxy_id": "1701295",
  "ips": ["203.0.113.1", "198.51.100.2", "192.0.2.3"]
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| proxy_id | string | Yes | Proxy ID |
| ips | array | Yes | Array of IP addresses (max 10) |
| ips.* | string | Yes | Each IP must be a valid IP address |

**Request Example:**

```bash
curl -X POST "http://jegdn.com/api/proxy/change-whitelisted-ips" \
  -H "X-API-Key: JEGTECHNOLOGY@2026" \
  -H "X-Username: seller123" \
  -H "Content-Type: application/json" \
  -d '{"proxy_id": "1701295", "ips": ["203.0.113.1", "198.51.100.2"]}'
```

**Response (200 OK) - API Proxy:**

```json
{
  "success": true,
  "message": "Whitelisted IPs updated successfully",
  "data": {
    "proxy_id": "1701295",
    "whitelisted_ips": ["203.0.113.1", "198.51.100.2"],
    "api_response": { ... }
  }
}
```

**Response (200 OK) - Manual Proxy:**

```json
{
  "success": true,
  "message": "Whitelisted IPs updated successfully",
  "data": {
    "proxy_id": "manual_1710000000_1234",
    "whitelisted_ips": ["203.0.113.1", "198.51.100.2"]
  }
}
```

**Notes:**
- Maximum 10 whitelisted IPs per proxy
- For **API proxies**: Updates both the Proxy-Cheap API and local database
- For **manual proxies**: Updates local database only
- Sellers can only update their own proxies

---

### 14. Update Proxy Seller Assignment (Admin Only)

Assign or unassign a proxy to/from a seller.

**Endpoint:** `POST /api/proxy/update-seller`

**Request Body - Assign:**

```json
{
  "proxy_id": "1701295",
  "seller_username": "seller123"
}
```

**Request Body - Unassign:**

```json
{
  "proxy_id": "1701295",
  "seller_username": null
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| proxy_id | string | Yes | Proxy ID |
| seller_username | string | No | Seller username to assign to. Send `null` or empty to unassign. |

**Request Example:**

```bash
curl -X POST "http://jegdn.com/api/proxy/update-seller" \
  -H "X-API-Key: JEGTECHNOLOGY@2026" \
  -H "X-Username: admin_user" \
  -H "Content-Type: application/json" \
  -d '{"proxy_id": "1701295", "seller_username": "seller123"}'
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Proxy transferred to seller successfully",
  "data": {
    "proxy_id": "1701295",
    "old_seller": null,
    "new_seller": "seller123",
    "updated_at": "2026-03-12 22:30:00"
  }
}
```

**Error - Seller Not Found (404):**

```json
{
  "success": false,
  "message": "Seller not found",
  "error_code": "SELLER_NOT_FOUND"
}
```

**Notes:**
- **Admin only** - sellers cannot change proxy assignments
- Use the `GET /sellers` endpoint to get the list of valid seller usernames
- Sending `seller_username: null` or empty will unassign the proxy

---

### 15. Delete Proxy (Admin Only)

Permanently delete a proxy from the system.

**Endpoint:** `POST /api/proxy/delete`

**Request Body:**

```json
{
  "proxy_id": "1701295",
  "reason": "Proxy no longer needed"
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| proxy_id | string | Yes | Proxy ID to delete |
| reason | string | No | Reason for deletion (max 500 chars) |

**Request Example:**

```bash
curl -X POST "http://jegdn.com/api/proxy/delete" \
  -H "X-API-Key: JEGTECHNOLOGY@2026" \
  -H "X-Username: admin_user" \
  -H "Content-Type: application/json" \
  -d '{"proxy_id": "1701295", "reason": "Proxy no longer needed"}'
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Proxy deleted successfully",
  "data": {
    "proxy_id": "1701295",
    "public_ip": "192.168.1.100",
    "assigned_to": "seller123",
    "status": "ACTIVE",
    "monthly_cost": 3.41
  }
}
```

**Notes:**
- **Admin only** - sellers cannot delete proxies
- Deleted proxies are recorded in `deleted_proxies` table to prevent re-syncing
- **This action is irreversible** - the proxy cannot be recovered
- This does NOT cancel the proxy on Proxy-Cheap - it only removes it from the web platform

---

### 4. Get Sellers List (Admin Only) - NEW in v2

Retrieve the list of all sellers for proxy assignment.

**Endpoint:** `GET /api/proxy/sellers`

**Request Example:**

```bash
curl -X GET "http://jegdn.com/api/proxy/sellers" \
  -H "X-API-Key: JEGTECHNOLOGY@2026" \
  -H "X-Username: admin_user"
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "userName": "seller123",
      "fullName": "John Doe"
    },
    {
      "userName": "seller456",
      "fullName": "Jane Smith"
    }
  ]
}
```

---

## Bidirectional Sync Flow

### How It Works

```
┌─────────────────────────────────────────────────────────┐
│                    PROXY APP                             │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────────┐ │
│  │  READ    │  │  WRITE   │  │  ORDER                │ │
│  │ (Pull)   │  │ (Push)   │  │ (App→Web→ProxyCheap)  │ │
│  └────┬─────┘  └────┬─────┘  └──────────┬────────────┘ │
│       │              │                    │              │
└───────┼──────────────┼────────────────────┼──────────────┘
        │              │                    │
        ▼              ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│                  WEB PLATFORM (API)                      │
│                  http://jegdn.com/api/proxy              │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────────┐ │
│  │  GET     │  │  POST    │  │  ProxyCheapService     │ │
│  │ list     │  │ update   │  │  executeOrder()        │ │
│  │ stats    │  │ note     │  │  extendProxy()         │ │
│  │ detail   │  │ extend   │  │  changeWhitelistedIps()│ │
│  │ sellers  │  │ add      │  │  calculatePrice()      │ │
│  │          │  │ delete   │  │                        │ │
│  └────┬─────┘  └────┬─────┘  └──────────┬────────────┘ │
│       │              │                    │              │
│       ▼              ▼                    ▼              │
│  ┌─────────────────────────────────────────────────┐    │
│  │              DATABASE (MySQL)                    │    │
│  │         proxies, users, deleted_proxies          │    │
│  └──────────────────────────────────────────────────┘   │
│                                     │                    │
└─────────────────────────────────────┼────────────────────┘
                                      │
                                      ▼
                          ┌───────────────────────┐
                          │   PROXY-CHEAP API      │
                          │   (External Provider)  │
                          └───────────────────────┘
```

### Recommended Sync Strategy for App

#### 1. Initial Load (App startup)

```
1. GET /stats       → Show dashboard numbers
2. GET /list?status=all → Load all proxies into local storage
```

#### 2. Periodic Refresh (Every 5-10 minutes)

```
1. GET /list?status=all → Refresh local proxy list
2. GET /stats           → Refresh dashboard
```

#### 3. After User Actions (Immediate sync)

```
After editing notes   → POST /update-note/{id}   → Then refresh list
After extending       → POST /extend             → Then refresh list
After adding manual   → POST /add-manual          → Then refresh list
After ordering        → POST /order               → Wait 5s → POST /sync → Refresh list
After changing IPs    → POST /change-whitelisted-ips → Then refresh list
```

#### 4. Full Sync (Manual trigger by user)

```
1. POST /sync       → Sync with Proxy-Cheap API
2. Wait 5-10 seconds
3. GET /list?status=all → Refresh everything
```

---

## Permissions Matrix

| Endpoint | Admin | Seller |
|----------|-------|--------|
| GET /list | All proxies | Own proxies only |
| GET /stats | Global stats | Own stats only |
| GET /detail/{id} | Any proxy | Own proxies only |
| GET /sellers | ✅ | ❌ (403) |
| POST /order-options | ✅ | ✅ |
| POST /calculate-price | ✅ | ✅ |
| POST /order | ✅ | ✅ |
| POST /update-note/{id} | Any proxy | Own proxies only |
| POST /extension-price | Any proxy | Own proxies only |
| POST /extend | Any proxy | Own proxies only |
| POST /add-manual | ✅ | ✅ |
| POST /update-manual-expiration | Any manual proxy | Own manual proxies only |
| POST /change-whitelisted-ips | Any proxy | Own proxies only |
| POST /update-seller | ✅ | ❌ (403) |
| POST /delete | ✅ | ❌ (403) |
| POST /sync | ✅ | ✅ |

---

## Error Codes Reference (Complete)

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| INVALID_API_KEY | 401 | API key is invalid or missing |
| MISSING_USERNAME | 400 | Username header not provided |
| USER_NOT_FOUND | 404 | Username doesn't exist in database |
| INSUFFICIENT_PERMISSIONS | 403 | User lacks required permissions |
| PROXY_NOT_FOUND | 404 | Proxy ID not found or no access |
| PROXY_EXPIRED | 400 | Proxy has expired, cannot extend |
| NOT_MANUAL_PROXY | 403 | Operation only allowed on manual proxies |
| SELLER_NOT_FOUND | 404 | Seller username not found |
| EXTEND_FAILED | 400 | Proxy extension failed on Proxy-Cheap API |
| UPDATE_FAILED | 400 | Update operation failed |

---

## Complete Testing Checklist

### Read Endpoints
- [ ] GET /list - Default (active proxies)
- [ ] GET /list?status=all - All proxies
- [ ] GET /list?status=expiring_soon - Expiring soon
- [ ] GET /list?country=US - Filter by country
- [ ] GET /list?search=192.168 - Search by IP
- [ ] GET /stats - Dashboard statistics
- [ ] GET /detail/{valid_id} - Valid proxy
- [ ] GET /detail/{invalid_id} - Should return 404
- [ ] GET /sellers - Sellers list (Admin only)

### Order Endpoints
- [ ] POST /order-options - Get available options
- [ ] POST /calculate-price - Calculate before ordering
- [ ] POST /order - **CAUTION: Charges real money**

### Write Endpoints (NEW)
- [ ] POST /update-note/{id} - Add a note
- [ ] POST /update-note/{id} with `notes: null` - Clear a note
- [ ] POST /extension-price - Check extension cost
- [ ] POST /extend - **CAUTION: Charges real money**
- [ ] POST /add-manual - Add manual proxy
- [ ] POST /update-manual-expiration - Change manual proxy date
- [ ] POST /change-whitelisted-ips - Update IPs
- [ ] POST /update-seller - Assign to seller (Admin)
- [ ] POST /delete - Delete proxy (Admin)

### Sync
- [ ] POST /sync - Full sync

### Error Handling
- [ ] Invalid API key → 401
- [ ] Missing username → 400
- [ ] Invalid username → 404
- [ ] Seller accessing admin endpoint → 403
- [ ] Invalid validation data → 422
- [ ] Non-existent proxy ID → 404

---

## Postman Endpoints for v2

**Add these to your existing Postman collection:**

### 8. Update Note
- Method: `POST`
- URL: `http://jegdn.com/api/proxy/update-note/1701295`
- Body: `{"notes": "Test note from app"}`

### 9. Calculate Extension Price
- Method: `POST`
- URL: `http://jegdn.com/api/proxy/extension-price`
- Body: `{"proxy_id": "1701295", "period_in_months": 1}`

### 10. Extend Proxy
- Method: `POST`
- URL: `http://jegdn.com/api/proxy/extend`
- Body: `{"proxy_id": "1701295", "period_in_months": 1}`

### 11. Add Manual Proxy
- Method: `POST`
- URL: `http://jegdn.com/api/proxy/add-manual`
- Body:
```json
{
  "location": "US",
  "isp": "Test ISP",
  "expires": "2027-12-31",
  "connect_ip": "192.168.1.100",
  "proxy_username": "testuser",
  "proxy_password": "testpass",
  "http_port": 8080,
  "notes": "Test manual proxy"
}
```

### 12. Update Manual Expiration
- Method: `POST`
- URL: `http://jegdn.com/api/proxy/update-manual-expiration`
- Body: `{"proxy_id": "manual_xxx", "expires_at": "2027-12-31 23:59:59"}`

### 13. Change Whitelisted IPs
- Method: `POST`
- URL: `http://jegdn.com/api/proxy/change-whitelisted-ips`
- Body: `{"proxy_id": "1701295", "ips": ["203.0.113.1", "198.51.100.2"]}`

### 14. Update Seller (Admin)
- Method: `POST`
- URL: `http://jegdn.com/api/proxy/update-seller`
- Body: `{"proxy_id": "1701295", "seller_username": "seller123"}`

### 15. Delete Proxy (Admin)
- Method: `POST`
- URL: `http://jegdn.com/api/proxy/delete`
- Body: `{"proxy_id": "1701295", "reason": "Test deletion"}`

### 4. Get Sellers (Admin)
- Method: `GET`
- URL: `http://jegdn.com/api/proxy/sellers`

---

## JavaScript Client Update (v2)

Add these methods to the `ProxyAPIClient` class from v1:

```javascript
class ProxyAPIClient {
  // ... existing methods from v1 ...

  // ===== NEW v2 WRITE METHODS =====

  // Update proxy note
  async updateNote(proxyId, notes) {
    return this.request(`/update-note/${proxyId}`, 'POST', { notes });
  }

  // Calculate extension price
  async getExtensionPrice(proxyId, periodInMonths) {
    return this.request('/extension-price', 'POST', {
      proxy_id: proxyId,
      period_in_months: periodInMonths
    });
  }

  // Extend proxy
  async extendProxy(proxyId, periodInMonths, couponCode = null) {
    return this.request('/extend', 'POST', {
      proxy_id: proxyId,
      period_in_months: periodInMonths,
      coupon_code: couponCode
    });
  }

  // Add manual proxy
  async addManualProxy(data) {
    return this.request('/add-manual', 'POST', data);
  }

  // Update manual proxy expiration
  async updateManualExpiration(proxyId, expiresAt) {
    return this.request('/update-manual-expiration', 'POST', {
      proxy_id: proxyId,
      expires_at: expiresAt
    });
  }

  // Change whitelisted IPs
  async changeWhitelistedIps(proxyId, ips) {
    return this.request('/change-whitelisted-ips', 'POST', {
      proxy_id: proxyId,
      ips: ips
    });
  }

  // Get sellers list (Admin)
  async getSellers() {
    return this.request('/sellers');
  }

  // Update seller assignment (Admin)
  async updateSeller(proxyId, sellerUsername) {
    return this.request('/update-seller', 'POST', {
      proxy_id: proxyId,
      seller_username: sellerUsername
    });
  }

  // Delete proxy (Admin)
  async deleteProxy(proxyId, reason = null) {
    return this.request('/delete', 'POST', {
      proxy_id: proxyId,
      reason: reason
    });
  }
}
```

### Usage Examples:

```javascript
const client = new ProxyAPIClient(
  'JEGTECHNOLOGY@2026',
  'seller123',
  'http://jegdn.com/api/proxy'
);

// Update notes
await client.updateNote('1701295', 'Used for US Etsy store');

// Check extension price before extending
const price = await client.getExtensionPrice('1701295', 3);
console.log(`Extension costs: $${price.data.price}`);

// Extend proxy
const result = await client.extendProxy('1701295', 3);
console.log(`New expiry: ${result.data.expires_formatted}`);

// Add manual proxy
await client.addManualProxy({
  location: 'US',
  isp: 'Custom ISP',
  expires: '2027-12-31',
  connect_ip: '192.168.1.100',
  proxy_username: 'user1',
  proxy_password: 'pass1',
  http_port: 8080,
  notes: 'Manual entry from app'
});

// Change whitelisted IPs
await client.changeWhitelistedIps('1701295', ['203.0.113.1', '198.51.100.2']);

// Full bidirectional sync
async function fullSync() {
  await client.sync();                            // Push: trigger server sync
  await new Promise(r => setTimeout(r, 5000));    // Wait 5s
  const proxies = await client.getProxies({ status: 'all' }); // Pull: get all data
  return proxies;
}
```

---

## Changelog

### Version 2.0 (2026-03-12)

**New Endpoints:**
- `POST /update-note/{id}` - Update proxy notes (bidirectional)
- `POST /extension-price` - Calculate extension price
- `POST /extend` - Extend proxy period
- `POST /add-manual` - Add manual proxy from app
- `POST /update-manual-expiration` - Update manual proxy expiration
- `POST /change-whitelisted-ips` - Change whitelisted IPs
- `GET /sellers` - Get sellers list (Admin)
- `POST /update-seller` - Assign proxy to seller (Admin)
- `POST /delete` - Delete proxy (Admin)

**Improvements:**
- Full bidirectional synchronization support
- All proxy data (notes, IPs, assignments) can be modified from the app
- Comprehensive error codes for all failure scenarios
- Permissions matrix for Admin vs Seller access

### Version 1.0 (2026-03-12)

- Initial release with read-only + order endpoints

---

**Last Updated:** March 12, 2026
**API Version:** 2.0
**Document Version:** 2.0
