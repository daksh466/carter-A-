# Payload Templates & JSON Examples

Reference JSON payloads for all major API operations. Copy and customize for testing.

## Stores

### Create Single Store
```json
{
  "name": "Store_A",
  "location": "Warehouse District - Block 5",
  "phone": "1234567890"
}
```

### Batch Store Names
```
Store_A
Store_B
Store_C
Store_D
Store_E
```

---

## Machines

### Create Machine (Basic)
```json
{
  "name": "Lathe-1",
  "store_id": "{{STORE_ID}}",
  "model": "Model-X200",
  "type": "Lathe"
}
```

### Create Machine (Extended)
```json
{
  "name": "CNC-2",
  "store_id": "{{STORE_ID}}",
  "model": "CNC-3000",
  "type": "CNC",
  "serial_number": "SN-CNC-2026-001",
  "manufacturer": "TechCorp",
  "year_acquired": 2024,
  "warranty_expiry": "2026-12-31"
}
```

### Machines Per Store
```
Store_A: Lathe-1, CNC-2, Drill-3
Store_B: Grinder-4, Milling-5, Press-6
Store_C: Lathe-2, CNC-3, Drill-4
Store_D: Assembly-1, Welder-1, Paint-1
Store_E: Lathe-3, CNC-4
```

---

## Spare Parts

### Create Spare Part (Basic)
```json
{
  "name": "Bearing 6201 Small",
  "category": "Bearings"
}
```

### Create Spare Part (Extended)
```json
{
  "name": "Bearing 6201 Small",
  "category": "Bearings",
  "description": "Deep groove ball bearing, 6201 series, small size",
  "unit": "pieces",
  "cost": 15.50,
  "supplier": "Supplier-A",
  "reorder_point": 5,
  "lead_time_days": 7
}
```

### Spare Parts Catalog
```json
[
  {
    "name": "Bearing 6201 Small",
    "category": "Bearings"
  },
  {
    "name": "Bearing 6201 Large",
    "category": "Bearings"
  },
  {
    "name": "Sheet 5mm",
    "category": "Metal"
  },
  {
    "name": "Sheet 10mm",
    "category": "Metal"
  },
  {
    "name": "Bolt M10",
    "category": "Hardware"
  },
  {
    "name": "Bolt M12",
    "category": "Hardware"
  },
  {
    "name": "Gasket Type-A",
    "category": "Seals"
  },
  {
    "name": "Gasket Type-B",
    "category": "Seals"
  },
  {
    "name": "Filter Element",
    "category": "Filters"
  },
  {
    "name": "Chain Link",
    "category": "Chains"
  }
]
```

---

## Inventory

### Add Single Inventory Record
```json
{
  "store_id": "{{STORE_ID}}",
  "spare_part_id": "{{SPARE_PART_ID}}",
  "quantity": 75,
  "min_threshold": 5
}
```

### Stock Distribution Levels
```
LOW STOCK:    1-10 units
NORMAL:       10-50 units
HIGH STOCK:   50-100+ units
```

### Batch Inventory Setup (All Spares for One Store)
```json
[
  {
    "spare_part_id": "{{SPARE_ID_1}}",
    "quantity": 75,
    "min_threshold": 5
  },
  {
    "spare_part_id": "{{SPARE_ID_2}}",
    "quantity": 3,
    "min_threshold": 5
  },
  {
    "spare_part_id": "{{SPARE_ID_3}}",
    "quantity": 20,
    "min_threshold": 5
  },
  {
    "spare_part_id": "{{SPARE_ID_4}}",
    "quantity": 5,
    "min_threshold": 5
  },
  {
    "spare_part_id": "{{SPARE_ID_5}}",
    "quantity": 60,
    "min_threshold": 5
  }
]
```

---

## Shipments

### Outgoing Shipment (Inter-Store Transfer)
```json
{
  "from_store_id": "{{STORE_A_ID}}",
  "to_store_id": "{{STORE_B_ID}}",
  "shipment_type": "outgoing",
  "items": [
    {
      "spare_part_id": "{{SPARE_ID_1}}",
      "quantity": 5
    },
    {
      "spare_part_id": "{{SPARE_ID_2}}",
      "quantity": 3
    }
  ]
}
```

### Incoming Shipment (External Supplier)
```json
{
  "to_store_id": "{{STORE_E_ID}}",
  "shipment_type": "incoming",
  "source_type": "external",
  "source_name": "External Supplier",
  "items": [
    {
      "spare_part_id": "{{SPARE_ID_1}}",
      "quantity": 10
    },
    {
      "spare_part_id": "{{SPARE_ID_2}}",
      "quantity": 15
    }
  ]
}
```

### Incoming Shipment (Inter-Store)
```json
{
  "to_store_id": "{{STORE_D_ID}}",
  "shipment_type": "incoming",
  "source_type": "store",
  "source_name": "Store_A",
  "source_store_id": "{{STORE_A_ID}}",
  "items": [
    {
      "spare_part_id": "{{SPARE_ID_3}}",
      "quantity": 7
    }
  ]
}
```

### Shipment Routes
```
Outgoing:
  Store_A → Store_B (2 items)
  Store_B → Store_C (2 items)
  Store_C → Store_D (2 items)

Incoming:
  External → Store_E (2 items)
  Store_A → Store_D (1 item)
```

### Confirm Receive (API)
```json
{
  "receiver_name": "Auto Tester",
  "phone": "9999999999"
}
```

### Expected Status Transitions
```
Outgoing Shipment:
  Created → in_transit → (confirmed by receiver)

Incoming Shipment:
  Created → in_transit → received (via confirm-receive)
```

---

## Edge Cases

### Attempt: Overflow (More Than Available)
```json
{
  "spare_part_id": "{{SPARE_ID}}",
  "quantity": 9999
}

Expected Response:
{
  "status": 400,
  "error": "Bad Request",
  "message": "Quantity exceeds available stock",
  "available": 50,
  "requested": 9999
}
```

### Attempt: Invalid Spare Part ID
```json
{
  "spare_part_id": "invalid-id-123",
  "quantity": 5
}

Expected Response:
{
  "status": 404,
  "error": "Not Found",
  "message": "Spare part not found"
}
```

### Attempt: Duplicate Spare Part Name
```json
{
  "name": "Bearing 6201 Small"
}

Expected Response:
{
  "status": 409,
  "error": "Conflict",
  "message": "Spare part with name already exists"
}
```

---

## Variable Substitution Guide

| Variable | Example | Source |
|----------|---------|--------|
| `{{STORE_ID}}` | `550e8400-e29b-41d4-a716-446655440000` | Response from Create Store |
| `{{MACHINE_ID}}` | `660e8400-e29b-41d4-a716-446655440001` | Response from Create Machine |
| `{{SPARE_ID_1}}` | `770e8400-e29b-41d4-a716-446655440002` | Response from Create Spare Part |
| `{{STORE_A_ID}}` | `550e8400-...` | Predefined in test setup |
| `{{STORE_B_ID}}` | `550e8400-...` | Predefined in test setup |

---

## cURL Examples

### Create Store
```bash
curl -X POST http://localhost:5000/api/stores \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Store_A",
    "location": "Warehouse District",
    "phone": "1234567890"
  }'
```

### Create Machine
```bash
curl -X POST http://localhost:5000/api/machines \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lathe-1",
    "store_id": "550e8400-e29b-41d4-a716-446655440000",
    "model": "Model-X",
    "type": "Lathe"
  }'
```

### Create Outgoing Shipment
```bash
curl -X POST http://localhost:5000/api/shipments \
  -H "Content-Type: application/json" \
  -d '{
    "from_store_id": "550e8400-e29b-41d4-a716-446655440000",
    "to_store_id": "550e8400-e29b-41d4-a716-446655440001",
    "shipment_type": "outgoing",
    "items": [
      {
        "spare_part_id": "770e8400-e29b-41d4-a716-446655440002",
        "quantity": 5
      }
    ]
  }'
```

### Confirm Receive
```bash
curl -X POST http://localhost:5000/api/shipments/{{SHIPMENT_ID}}/confirm-receive \
  -H "Content-Type: application/json" \
  -d '{
    "receiver_name": "Auto Tester",
    "phone": "9999999999"
  }'
```

---

## Test Data Constraints

- **Store Names**: Unique; alphanumeric with underscores
- **Machine Names**: Unique per store; format: `Type-Number` (e.g., "Lathe-1")
- **Spare Part Names**: Unique globally; descriptive with variants (e.g., "Bearing 6201 Small")
- **Quantities**: Positive integers only; must not exceed available stock for transfers
- **Phone**: 10 digits minimum (format: "1234567890" or international)
- **Receiver Name**: Min 3 chars; no special characters except hyphens/spaces
