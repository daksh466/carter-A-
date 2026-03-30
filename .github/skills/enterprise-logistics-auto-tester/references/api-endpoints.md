# API Endpoints Reference

This document maps all logistics API endpoints used by the auto tester.

## Base URL
```
http://localhost:5000/api  (or configured via API_BASE_URL)
```

## Stores

### Create Store
```
POST /api/stores
Content-Type: application/json

{
  "name": "Store_A",
  "location": "Location-Store_A",
  "phone": "1234567890"
}

Response (201 Created):
{
  "id": "uuid-store-1",
  "_id": "mongodb-id",
  "name": "Store_A",
  "location": "Location-Store_A",
  "phone": "1234567890",
  "created_at": "2026-03-29T14:00:00Z"
}
```

### Get All Stores
```
GET /api/stores

Response (200 OK):
[
  { "id": "uuid-store-1", "name": "Store_A", ... },
  { "id": "uuid-store-2", "name": "Store_B", ... },
  ...
]
```

### Get Store Inventory
```
GET /api/stores/:storeId/inventory

Response (200 OK):
[
  {
    "id": "uuid-inv-1",
    "store_id": "uuid-store-1",
    "spare_part_id": "uuid-spare-1",
    "spare_part_name": "Bearing 6201 Small",
    "quantity": 75,
    "min_threshold": 5
  },
  ...
]
```

---

## Machines

### Create Machine
```
POST /api/machines
Content-Type: application/json

{
  "name": "Lathe-1",
  "store_id": "uuid-store-1",
  "model": "Model-Lathe",
  "type": "Industrial"
}

Response (201 Created):
{
  "id": "uuid-machine-1",
  "_id": "mongodb-id",
  "name": "Lathe-1",
  "store_id": "uuid-store-1",
  "model": "Model-Lathe",
  "type": "Industrial",
  "spares": []
}
```

### Get All Machines
```
GET /api/machines

Response (200 OK):
[
  {
    "id": "uuid-machine-1",
    "name": "Lathe-1",
    "store_id": "uuid-store-1",
    "spares": ["uuid-spare-1", "uuid-spare-2"]
  },
  ...
]
```

### Assign Spare to Machine
```
POST /api/machines/:machineId/spares
Content-Type: application/json

{
  "spare_part_id": "uuid-spare-1"
}

Response (201 Created):
{
  "id": "uuid-assignment-1",
  "machine_id": "uuid-machine-1",
  "spare_part_id": "uuid-spare-1",
  "created_at": "2026-03-29T14:05:00Z"
}
```

---

## Spare Parts

### Create Spare Part
```
POST /api/spare-parts
Content-Type: application/json

{
  "name": "Bearing 6201 Small",
  "category": "Bearings",
  "unit": "pieces",
  "cost": 15.50
}

Response (201 Created):
{
  "id": "uuid-spare-1",
  "_id": "mongodb-id",
  "name": "Bearing 6201 Small",
  "category": "Bearings",
  "unit": "pieces",
  "cost": 15.50
}
```

### Get All Spare Parts
```
GET /api/spare-parts

Response (200 OK):
[
  {
    "id": "uuid-spare-1",
    "name": "Bearing 6201 Small",
    "category": "Bearings",
    "unit": "pieces",
    "cost": 15.50
  },
  ...
]
```

---

## Inventory

### Add Inventory
```
POST /api/inventory
Content-Type: application/json

{
  "store_id": "uuid-store-1",
  "spare_part_id": "uuid-spare-1",
  "quantity": 75,
  "min_threshold": 5
}

Response (201 Created):
{
  "id": "uuid-inv-1",
  "store_id": "uuid-store-1",
  "spare_part_id": "uuid-spare-1",
  "quantity": 75,
  "min_threshold": 5,
  "created_at": "2026-03-29T14:10:00Z"
}
```

---

## Shipments

### Create Outgoing Shipment (Inter-Store)
```
POST /api/shipments
Content-Type: application/json

{
  "from_store_id": "uuid-store-a",
  "to_store_id": "uuid-store-b",
  "shipment_type": "outgoing",
  "items": [
    {
      "spare_part_id": "uuid-spare-1",
      "quantity": 5
    },
    {
      "spare_part_id": "uuid-spare-2",
      "quantity": 3
    }
  ]
}

Response (201 Created):
{
  "id": "uuid-shipment-1",
  "_id": "mongodb-id",
  "from_store_id": "uuid-store-a",
  "to_store_id": "uuid-store-b",
  "shipment_type": "outgoing",
  "status": "in_transit",
  "items": [...],
  "created_at": "2026-03-29T14:15:00Z"
}
```

### Create Incoming Shipment (External or From Another Store)
```
POST /api/incoming-shipments
Content-Type: application/json

{
  "to_store_id": "uuid-store-e",
  "shipment_type": "incoming",
  "source_type": "external",
  "source_name": "External Supplier",
  "items": [
    {
      "spare_part_id": "uuid-spare-1",
      "quantity": 10
    }
  ]
}

Response (201 Created):
{
  "id": "uuid-shipment-2",
  "_id": "mongodb-id",
  "to_store_id": "uuid-store-e",
  "shipment_type": "incoming",
  "source_type": "external",
  "source_name": "External Supplier",
  "status": "in_transit",
  "items": [...],
  "created_at": "2026-03-29T14:20:00Z"
}
```

### Get Shipment
```
GET /api/shipments/:shipmentId

Response (200 OK):
{
  "id": "uuid-shipment-1",
  "from_store_id": "uuid-store-a",
  "to_store_id": "uuid-store-b",
  "status": "in_transit",
  "items": [...],
  "created_at": "2026-03-29T14:15:00Z"
}
```

### Confirm Receive (Accept Incoming Shipment)
```
POST /api/shipments/:shipmentId/confirm-receive
Content-Type: application/json

{
  "receiver_name": "Auto Tester",
  "phone": "9999999999"
}

Response (200 OK):
{
  "id": "uuid-shipment-2",
  "status": "received",
  "receiver_name": "Auto Tester",
  "receiver_phone": "9999999999",
  "received_at": "2026-03-29T14:25:00Z",
  "...": "other shipment fields"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "status": 400,
  "error": "Bad Request",
  "message": "Quantity exceeds available stock",
  "details": {
    "spare_part": "uuid-spare-1",
    "available": 50,
    "requested": 60
  }
}
```

### 404 Not Found
```json
{
  "status": 404,
  "error": "Not Found",
  "message": "Spare part not found",
  "id": "invalid-uuid"
}
```

### 409 Conflict
```json
{
  "status": 409,
  "error": "Conflict",
  "message": "Spare part with name already exists",
  "name": "Bearing 6201 Small"
}
```

### 500 Internal Server Error
```json
{
  "status": 500,
  "error": "Internal Server Error",
  "message": "Database connection lost"
}
```

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request succeeded |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid input |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Duplicate or incompatible state |
| 500 | Server Error - Internal server issue |
| 503 | Service Unavailable - Server temporarily down |

---

## Retry Strategy

The auto tester implements exponential backoff:
- **Attempt 1**: Immediate
- **Attempt 2**: 1s delay
- **Attempt 3**: 2s delay (give up after 3rd failure)

This applies to network flakiness; 4xx/5xx responses fail immediately without retry.
