# Carter CRM Backend API Documentation

## Overview
Express + MongoDB backend for Carter CRM with JWT authentication, rate limiting, and comprehensive error handling.

## Base URL
```
http://localhost:3000/api
```

## Authentication
Most endpoints require JWT Bearer token authentication.
```
Authorization: Bearer <your_jwt_token>
```

## Public Endpoints

### User Registration
**POST** `/api/users/register`
```json
{
  "username": "string (min 3, max 50)",
  "password": "string (min 8, max 100)",
  "businessName": "string (min 2, max 100)",
  "phone": "string (min 10, max 15)"
}
```
Response:
```json
{
  "success": true,
  "message": "User registered",
  "user": { "_id", "username", "businessName", "phone" }
}
```

### User Login
**POST** `/api/users/login`
```json
{
  "username": "string",
  "password": "string"
}
```
Response:
```json
{
  "success": true,
  "token": "jwt_token"
}
```

### Health Check
**GET** `/api/health`
- Public endpoint, no authentication required

---

## Protected Endpoints (Require JWT Token)

### Inventory Management

**GET** `/api/inventory`
- Query params: `page`, `limit`
- Returns paginated inventory list

**POST** `/api/inventory`
```json
{
  "itemCode": "string",
  "itemName": "string",
  "stock": "number (min 0)"
}
```

**POST** `/api/inventory/update`
```json
{
  "itemCode": "string",
  "stock": "number"
}
```

**POST** `/api/inventory/:id/consume`
```json
{
  "quantityUsed": "number (min 1)"
}
```

**GET** `/api/inventory/prediction`
- Returns predicted days until inventory depletion

**GET** `/api/inventory/alerts`
- Returns items with stock below 10

---

### Order Management

**GET** `/api/orders`
- Returns user's orders

**POST** `/api/orders`
```json
{
  "itemCode": "string",
  "quantity": "number (min 1)"
}
```

---

### Machine Management

**PUT** `/api/machines/:id`
```json
{
  "machineName": "string",
  "machineId": "string",
  "warrantyStatus": "active | expired",
  "purchaseDate": "date"
}
```

**DELETE** `/api/machines/:id`

---

### Payment Management

**PUT** `/api/payments/:id`
```json
{
  "amount": "number (min 0)",
  "paymentDate": "date",
  "paymentBy": "cash | online | dealer",
  "supervisedBy": "string"
}
```

**DELETE** `/api/payments/:id`

---

### Spare Parts Management

**PUT** `/api/spareparts/:id`
```json
{
  "partName": "string",
  "type": "ordered | required"
}
```

**DELETE** `/api/spareparts/:id`

---

### Service Management

**PUT** `/api/services/:id`
```json
{
  "machineId": "string",
  "workDetails": "string",
  "engineerName": "string",
  "date": "date"
}
```

**DELETE** `/api/services/:id`

---

### Connection (Customer) Management

**POST** `/api/connections`
```json
{
  "businessName": "string",
  "firstName": "string",
  "lastName": "string",
  "phone": "string",
  "email": "string (valid email)",
  "state": "string",
  "category": "string"
}
```

**GET** `/api/connections`
- Returns paginated list of connections

**GET** `/api/connections/:id/details`
- Returns customer details including machines, payments, spare parts, and service history

---

## Error Responses

All error responses follow this format:
```json
{
  "success": false,
  "message": "Error description"
}
```

Common status codes:
- `400` - Bad Request / Validation Error
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict (duplicate entry)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

---

## Rate Limiting

- Auth endpoints (`/api/users/login`, `/api/users/register`): 10 requests per 15 minutes
- General API: 100 requests per 15 minutes

---

## Security Features

- JWT Authentication
- bcrypt password hashing
- Helmet HTTP headers
- CORS enabled
- Input sanitization (XSS, NoSQL injection)
- Rate limiting
- Request ID tracking for debugging
