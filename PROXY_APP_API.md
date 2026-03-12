# Proxy Management API Documentation

## Overview

This API allows the Proxy Management App to interact with the web platform for managing proxies. The API provides endpoints for listing proxies, viewing statistics, placing orders, and synchronizing proxy data.

**Base URL:** `https://jegdn.com/api/proxy`

**API Version:** 1.0

---

## Authentication

All API requests require authentication using an API key and username.

### Authentication Headers

```
X-API-Key: JEGTECHNOLOGY@2026
X-Username: {username}
```

**Alternative:** You can also pass credentials as query parameters:
```
?api_key=JEGTECHNOLOGY@2026&username={username}
```

### Authentication Flow

1. Include the API key in the `X-API-Key` header
2. Include the user's username in the `X-Username` header
3. The system will validate:
   - API key matches the configured key
   - Username exists in the database
   - User has appropriate permissions (Seller or Admin role)

### Error Responses

**Invalid API Key (401):**
```json
{
  "success": false,
  "message": "Invalid or missing API key",
  "error_code": "INVALID_API_KEY"
}
```

**Missing Username (400):**
```json
{
  "success": false,
  "message": "Username is required",
  "error_code": "MISSING_USERNAME"
}
```

**User Not Found (404):**
```json
{
  "success": false,
  "message": "User not found",
  "error_code": "USER_NOT_FOUND"
}
```

**Insufficient Permissions (403):**
```json
{
  "success": false,
  "message": "User does not have permission to access proxy management",
  "error_code": "INSUFFICIENT_PERMISSIONS"
}
```

---

## Endpoints

### 1. Get Proxy List

Retrieve a list of proxies with optional filters.

**Endpoint:** `GET /api/proxy/list`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| status | string | No | active | Filter by status: `active`, `expiring_soon`, `inactive`, `all` |
| search | string | No | - | Search by proxy ID, public IP, or connect IP |
| country | string | No | - | Filter by country code (e.g., `US`, `GB`) |
| network | string | No | - | Filter by network type |
| isp | string | No | - | Filter by ISP name (partial match) |

**Request Example:**

```bash
curl -X GET "https://your-domain.com/api/proxy/list?status=active&country=US" \
  -H "X-API-Key: JEGTECHNOLOGY@2026" \
  -H "X-Username: seller123"
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "proxies": [
      {
        "id": "1701295",
        "display_id": "🇺🇸 1701295",
        "status": "ACTIVE",
        "raw_status": "ACTIVE",
        "network_type": "STATIC RESIDENTIAL",
        "network_type_raw": "RESIDENTIAL_STATIC",
        "country_code": "US",
        "country_flag": "🇺🇸",
        "public_ip": "192.168.1.100",
        "notes": null,
        "connect_ip": "proxy.example.com",
        "http_port": "8080",
        "https_port": "8443",
        "socks5_port": "1080",
        "ip_version": "IPv4",
        "proxy_type": "HTTP",
        "username": "user123",
        "password": "pass123",
        "whitelisted_ips": [],
        "isp_name": "Verizon Business",
        "name": "seller123",
        "seller_full_name": "John Doe",
        "monthly_cost": "3.41",
        "monthly_cost_raw": 3.41,
        "created_at": "2024-01-15T10:30:00.000000Z",
        "expires_at": "2024-02-15T10:30:00.000000Z",
        "expires_formatted": "2024-02-15 10:30",
        "bandwidth": "Unlimited",
        "source": "api",
        "is_manual": false,
        "added_by": null
      }
    ],
    "total": 1
  }
}
```

**Notes:**
- Sellers will only see proxies assigned to them
- Admins will see all proxies
- The `display_id` includes a country flag emoji for better UX

---

### 2. Get Proxy Statistics

Retrieve statistics about proxies.

**Endpoint:** `GET /api/proxy/stats`

**Request Example:**

```bash
curl -X GET "https://your-domain.com/api/proxy/stats" \
  -H "X-API-Key: JEGTECHNOLOGY@2026" \
  -H "X-Username: seller123"
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "active": 25,
    "expiring_soon": 3,
    "inactive": 2,
    "total": 30,
    "total_monthly_cost": 102.30
  }
}
```

**Field Descriptions:**

| Field | Description |
|-------|-------------|
| active | Number of active proxies (not expiring within 7 days) |
| expiring_soon | Number of proxies expiring within 7 days |
| inactive | Number of expired or inactive proxies |
| total | Total number of proxies |
| total_monthly_cost | Total monthly cost of all proxies (float) |

---

### 3. Get Proxy Detail

Retrieve detailed information about a specific proxy.

**Endpoint:** `GET /api/proxy/detail/{id}`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Proxy ID |

**Request Example:**

```bash
curl -X GET "https://your-domain.com/api/proxy/detail/1701295" \
  -H "X-API-Key: JEGTECHNOLOGY@2026" \
  -H "X-Username: seller123"
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "1701295",
    "display_id": "🇺🇸 1701295",
    "status": "ACTIVE",
    "network_type": "STATIC RESIDENTIAL",
    "country_code": "US",
    "public_ip": "192.168.1.100",
    "connect_ip": "proxy.example.com",
    "http_port": "8080",
    "https_port": "8443",
    "socks5_port": "1080",
    "username": "user123",
    "password": "pass123",
    "isp_name": "Verizon Business",
    "monthly_cost": "3.41",
    "created_at": "2024-01-15T10:30:00.000000Z",
    "expires_at": "2024-02-15T10:30:00.000000Z",
    "bandwidth": "Unlimited"
  }
}
```

**Error Response (404 Not Found):**

```json
{
  "success": false,
  "message": "Proxy not found or access denied",
  "error_code": "PROXY_NOT_FOUND"
}
```

---

### 4. Get Order Options

Retrieve available options for ordering proxies (countries, ISPs, plans).

**Endpoint:** `POST /api/proxy/order-options`

**Request Body:**

```json
{
  "service_type": "static-residential-ipv4",
  "plan_id": "standard"
}
```

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| service_type | string | Yes | Service type: `static-residential-ipv4`, `static-datacenter-ipv4`, `rotating-residential`, `rotating-mobile` |
| plan_id | string | No | Plan ID (default: `standard`) |

**Request Example:**

```bash
curl -X POST "https://your-domain.com/api/proxy/order-options" \
  -H "X-API-Key: JEGTECHNOLOGY@2026" \
  -H "X-Username: seller123" \
  -H "Content-Type: application/json" \
  -d '{
    "service_type": "static-residential-ipv4",
    "plan_id": "standard"
  }'
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "countries": {
      "US": "🇺🇸 United States",
      "GB": "🇬🇧 United Kingdom",
      "DE": "🇩🇪 Germany"
    },
    "isps": {
      "US": [
        {
          "id": "isp-123",
          "name": "Verizon Business"
        },
        {
          "id": "isp-456",
          "name": "AT&T"
        }
      ]
    },
    "plans": [
      {
        "id": "standard",
        "name": "Standard Plan",
        "description": "Dedicated IP with standard features"
      }
    ]
  }
}
```

---

### 5. Calculate Order Price

Calculate the price for a proxy order before placing it.

**Endpoint:** `POST /api/proxy/calculate-price`

**Request Body:**

```json
{
  "service_type": "static-residential-ipv4",
  "plan_id": "standard",
  "quantity": 5,
  "duration": 1,
  "country": "US",
  "isp_id": "isp-123",
  "coupon_code": "SAVE10"
}
```

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| service_type | string | Yes | Service type |
| plan_id | string | Yes | Plan ID |
| quantity | integer | Yes | Number of proxies (1-100) |
| duration | integer | Yes | Duration in months (1-12) |
| country | string | Yes | Country code (e.g., `US`) |
| isp_id | string | No | ISP ID (optional) |
| coupon_code | string | No | Coupon code for discount (optional) |

**Request Example:**

```bash
curl -X POST "https://your-domain.com/api/proxy/calculate-price" \
  -H "X-API-Key: JEGTECHNOLOGY@2026" \
  -H "X-Username: seller123" \
  -H "Content-Type: application/json" \
  -d '{
    "service_type": "static-residential-ipv4",
    "plan_id": "standard",
    "quantity": 5,
    "duration": 1,
    "country": "US"
  }'
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "unitPrice": 3.59,
    "unitPriceAfterDiscount": 3.41,
    "totalPrice": 17.05,
    "finalPrice": 17.05,
    "discount": 0.90,
    "discountPercentage": 5,
    "appliedDiscounts": [
      {
        "type": "volume",
        "percentage": 5,
        "amount": 0.90
      }
    ],
    "currency": "USD"
  }
}
```

**Validation Errors (422):**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "quantity": ["The quantity must be between 1 and 100."],
    "duration": ["The duration must be between 1 and 12."]
  }
}
```

---

### 6. Place Proxy Order

Place an order for proxies. This will charge the account and assign proxies to the user.

**Endpoint:** `POST /api/proxy/order`

**Request Body:**

```json
{
  "service_type": "static-residential-ipv4",
  "plan_id": "standard",
  "quantity": 5,
  "duration": 1,
  "country": "US",
  "isp_id": "isp-123",
  "coupon_code": "SAVE10"
}
```

**Request Parameters:** Same as Calculate Price endpoint

**Request Example:**

```bash
curl -X POST "https://your-domain.com/api/proxy/order" \
  -H "X-API-Key: JEGTECHNOLOGY@2026" \
  -H "X-Username: seller123" \
  -H "Content-Type: application/json" \
  -d '{
    "service_type": "static-residential-ipv4",
    "plan_id": "standard",
    "quantity": 5,
    "duration": 1,
    "country": "US"
  }'
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Order placed successfully",
  "data": {
    "order_id": "order-789456",
    "requested_quantity": 5,
    "assigned_count": 5,
    "assigned_proxy_ids": [
      "1701295",
      "1701296",
      "1701297",
      "1701298",
      "1701299"
    ],
    "cost_per_proxy": 3.41,
    "total_cost": 17.05
  }
}
```

**Important Notes:**

- **This endpoint charges real money** - the order is executed immediately
- Proxies are automatically assigned to the requesting user
- The system will sync with Proxy-Cheap API to fetch the new proxies
- Processing time: typically 5-10 seconds
- If proxies are not immediately available in the order response, the system will sync and assign the latest unassigned proxies

**Error Response (400 Bad Request):**

```json
{
  "success": false,
  "message": "Insufficient balance",
  "errors": {
    "balance": "Your account balance is insufficient for this order"
  }
}
```

---

### 7. Sync Proxies

Manually trigger a sync of proxy data from Proxy-Cheap API to the database.

**Endpoint:** `POST /api/proxy/sync`

**Request Example:**

```bash
curl -X POST "https://your-domain.com/api/proxy/sync" \
  -H "X-API-Key: JEGTECHNOLOGY@2026" \
  -H "X-Username: seller123"
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Proxy sync completed successfully"
}
```

**Notes:**
- This endpoint runs the `proxy:sync` artisan command
- Sync typically takes 5-30 seconds depending on the number of proxies
- Use this after placing an order if proxies don't appear immediately
- Automatic sync runs every hour via cron job

---

## Common Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid API key |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 422 | Unprocessable Entity - Validation failed |
| 500 | Internal Server Error |

---

## Error Handling

All error responses follow this format:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error_code": "MACHINE_READABLE_CODE",
  "error": "Detailed error information (optional)"
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| INVALID_API_KEY | API key is invalid or missing |
| MISSING_USERNAME | Username header is required |
| USER_NOT_FOUND | Username doesn't exist in database |
| INSUFFICIENT_PERMISSIONS | User lacks required permissions |
| PROXY_NOT_FOUND | Proxy ID not found or access denied |
| VALIDATION_ERROR | Request validation failed |

---

## Rate Limiting

- **Rate Limit:** 60 requests per minute per API key
- **Burst Limit:** 10 requests per second

**Rate Limit Headers:**

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640000000
```

**Rate Limit Exceeded Response (429):**

```json
{
  "success": false,
  "message": "Too many requests. Please try again later.",
  "error_code": "RATE_LIMIT_EXCEEDED",
  "retry_after": 60
}
```

---

## Best Practices

### 1. Cache Order Options

Order options (countries, ISPs, plans) don't change frequently. Cache them locally for 1 hour to reduce API calls.

```javascript
// Example caching strategy
const CACHE_DURATION = 3600; // 1 hour
let cachedOrderOptions = null;
let cacheTimestamp = 0;

async function getOrderOptions() {
  const now = Date.now() / 1000;
  if (cachedOrderOptions && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedOrderOptions;
  }
  
  const response = await fetch('/api/proxy/order-options', {
    method: 'POST',
    headers: {
      'X-API-Key': 'JEGTECHNOLOGY@2026',
      'X-Username': username,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      service_type: 'static-residential-ipv4'
    })
  });
  
  cachedOrderOptions = await response.json();
  cacheTimestamp = now;
  return cachedOrderOptions;
}
```

### 2. Handle Order Delays

Orders may take 5-10 seconds to process. Implement proper loading states and error handling.

```javascript
async function placeOrder(orderData) {
  try {
    // Show loading state
    showLoading();
    
    const response = await fetch('/api/proxy/order', {
      method: 'POST',
      headers: {
        'X-API-Key': 'JEGTECHNOLOGY@2026',
        'X-Username': username,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Wait 3 seconds then refresh proxy list
      setTimeout(() => {
        refreshProxyList();
      }, 3000);
      
      showSuccess(`Order placed! ${result.data.assigned_count} proxies assigned.`);
    } else {
      showError(result.message);
    }
  } catch (error) {
    showError('Network error. Please try again.');
  } finally {
    hideLoading();
  }
}
```

### 3. Sync After Order

If proxies don't appear immediately after ordering, trigger a manual sync:

```javascript
async function placeOrderWithSync(orderData) {
  const orderResult = await placeOrder(orderData);
  
  if (orderResult.success && orderResult.data.assigned_count === 0) {
    // No proxies assigned yet, trigger sync
    await fetch('/api/proxy/sync', {
      method: 'POST',
      headers: {
        'X-API-Key': 'JEGTECHNOLOGY@2026',
        'X-Username': username
      }
    });
    
    // Wait 5 seconds for sync to complete
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Refresh proxy list
    await refreshProxyList();
  }
}
```

### 4. Implement Retry Logic

For critical operations like ordering, implement exponential backoff retry:

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      // Don't retry on client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        return response;
      }
      
      // Retry on server errors (5xx)
      if (i < maxRetries - 1) {
        await new Promise(resolve => 
          setTimeout(resolve, Math.pow(2, i) * 1000)
        );
      }
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
}
```

---

## Example Integration (JavaScript)

### Complete Proxy Management Class

```javascript
class ProxyAPIClient {
  constructor(apiKey, username, baseUrl) {
    this.apiKey = apiKey;
    this.username = username;
    this.baseUrl = baseUrl || 'https://your-domain.com/api/proxy';
  }
  
  async request(endpoint, method = 'GET', body = null) {
    const options = {
      method,
      headers: {
        'X-API-Key': this.apiKey,
        'X-Username': this.username,
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }
    
    return data;
  }
  
  // Get proxy list
  async getProxies(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/list?${params}`);
  }
  
  // Get statistics
  async getStats() {
    return this.request('/stats');
  }
  
  // Get proxy detail
  async getProxyDetail(proxyId) {
    return this.request(`/detail/${proxyId}`);
  }
  
  // Get order options
  async getOrderOptions(serviceType, planId = 'standard') {
    return this.request('/order-options', 'POST', {
      service_type: serviceType,
      plan_id: planId
    });
  }
  
  // Calculate price
  async calculatePrice(orderData) {
    return this.request('/calculate-price', 'POST', orderData);
  }
  
  // Place order
  async placeOrder(orderData) {
    return this.request('/order', 'POST', orderData);
  }
  
  // Sync proxies
  async sync() {
    return this.request('/sync', 'POST');
  }
}

// Usage example
const client = new ProxyAPIClient(
  'JEGTECHNOLOGY@2026',
  'seller123',
  'https://your-domain.com/api/proxy'
);

// Get active proxies
const proxies = await client.getProxies({ status: 'active', country: 'US' });
console.log(proxies.data.proxies);

// Place an order
const order = await client.placeOrder({
  service_type: 'static-residential-ipv4',
  plan_id: 'standard',
  quantity: 5,
  duration: 1,
  country: 'US'
});
console.log(`Order placed: ${order.data.order_id}`);
```

---

## Testing

### Test Credentials

For testing purposes, you can use:

- **API Key:** `JEGTECHNOLOGY@2026`
- **Test Username:** Contact admin for test account

### Postman Collection

A Postman collection is available for testing all endpoints. Import the collection and set the following environment variables:

- `api_key`: `JEGTECHNOLOGY@2026`
- `username`: Your username
- `base_url`: `https://your-domain.com/api/proxy`

---

## Support

For technical support or questions:

- **Email:** support@jegtechnology.com
- **Documentation:** https://your-domain.com/docs/api
- **Status Page:** https://status.jegtechnology.com

---

## Changelog

### Version 1.0 (2026-03-12)

- Initial release
- Endpoints: list, stats, detail, order-options, calculate-price, order, sync
- Authentication via API key and username
- Support for sellers and admins
- Automatic proxy assignment after order

---

## Security Considerations

1. **Never expose the API key in client-side code** - Store it securely on your backend
2. **Use HTTPS only** - All API requests must use HTTPS
3. **Validate user input** - Always validate and sanitize user input before sending to API
4. **Implement request signing** - For production, consider implementing request signing for additional security
5. **Monitor API usage** - Track API calls to detect unusual patterns
6. **Rotate API keys regularly** - Change API keys periodically for security

---

**Last Updated:** March 12, 2026  
**API Version:** 1.0  
**Document Version:** 1.0
