# Work Order Status Tracking API Documentation

## Overview

The Work Order Status Tracking system automatically tracks and updates work order status based on job orders and dispatches. This provides real-time visibility into the progress of work orders throughout the production and delivery pipeline.

## Status Logic

### Status Definitions

1. **Pending**: Work order has been created but no job orders have been created yet
2. **In Progress**: At least one job order has been created, and dispatching is ongoing
3. **Completed**: All planned quantities and all line items have been fully dispatched
4. **Cancelled**: Work order has been manually cancelled

### Status Transition Flow

```
Pending → In Progress → Completed
   ↓           ↓           ↓
Cancelled   Cancelled   Completed
```

### Automatic Status Updates

The system automatically updates work order status in the following scenarios:

1. **Job Order Creation**: When a job order is created for a work order, the status changes from `Pending` to `In Progress`
2. **Dispatch Creation**: When dispatches are created, the system recalculates the status based on total dispatched quantities vs. planned quantities
3. **Status Recalculation**: The status is automatically set to `Completed` when:
   - All line items (products) from all job orders are fully dispatched
   - Total dispatched quantity >= Total planned quantity

## API Endpoints

### 1. Get Work Order Status

Get detailed status information for a specific work order.

**Endpoint**: `GET /api/falcon/workorders/:id/status`

**Authentication**: Required (JWT)

**Parameters**:
- `id` (path parameter): Work Order MongoDB ObjectId

**Response Example**:

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Work order status fetched successfully",
  "data": {
    "work_order_id": "6756a1b2c3d4e5f6a7b8c9d0",
    "work_order_number": "WO-2024-001",
    "date": "2024-01-15T00:00:00.000Z",
    "client": "ABC Construction Ltd.",
    "project": "Gateway Tower",
    "current_status": "In Progress",
    "total_planned_quantity": 1000,
    "total_dispatched_quantity": 450,
    "remaining_quantity": 550,
    "progress_percentage": 45.0,
    "line_items": [
      {
        "product_id": "6756a1b2c3d4e5f6a7b8c9d1",
        "product_name": "Aluminum Panel Type A",
        "job_order_id": "JO-2024-001",
        "sales_order_no": "SO-2024-001",
        "po_quantity": 500,
        "dispatched_quantity": 250,
        "remaining_quantity": 250,
        "is_fully_dispatched": false,
        "code": "APA-001",
        "width": 1200,
        "height": 2400,
        "color_code": "RAL-9010"
      },
      {
        "product_id": "6756a1b2c3d4e5f6a7b8c9d2",
        "product_name": "Aluminum Panel Type B",
        "job_order_id": "JO-2024-002",
        "sales_order_no": "SO-2024-002",
        "po_quantity": 500,
        "dispatched_quantity": 200,
        "remaining_quantity": 300,
        "is_fully_dispatched": false,
        "code": "APB-001",
        "width": 1000,
        "height": 2000,
        "color_code": "RAL-7016"
      }
    ],
    "summary": {
      "total_line_items": 2,
      "fully_dispatched_items": 0,
      "pending_items": 2
    }
  }
}
```

**Use Cases**:
- View detailed progress of a specific work order
- Track which products have been dispatched and which are pending
- Monitor dispatch progress for project management

---

### 2. Get All Work Orders Status Summary

Get status summary for all work orders in the system.

**Endpoint**: `GET /api/falcon/workorders/status/all`

**Authentication**: Required (JWT)

**Response Example**:

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Work orders status summary fetched successfully",
  "data": {
    "summary": {
      "total_work_orders": 25,
      "pending": 5,
      "in_progress": 15,
      "completed": 4,
      "cancelled": 1
    },
    "work_orders": [
      {
        "work_order_id": "6756a1b2c3d4e5f6a7b8c9d0",
        "work_order_number": "WO-2024-001",
        "date": "2024-01-15T00:00:00.000Z",
        "client": "ABC Construction Ltd.",
        "project": "Gateway Tower",
        "status": "In Progress",
        "progress_percentage": 45.0,
        "total_planned_quantity": 1000,
        "total_dispatched_quantity": 450,
        "remaining_quantity": 550,
        "total_line_items": 2,
        "fully_dispatched_items": 0
      },
      {
        "work_order_id": "6756a1b2c3d4e5f6a7b8c9d3",
        "work_order_number": "WO-2024-002",
        "date": "2024-01-20T00:00:00.000Z",
        "client": "XYZ Developers",
        "project": "Skyline Plaza",
        "status": "Completed",
        "progress_percentage": 100.0,
        "total_planned_quantity": 800,
        "total_dispatched_quantity": 800,
        "remaining_quantity": 0,
        "total_line_items": 3,
        "fully_dispatched_items": 3
      }
    ]
  }
}
```

**Use Cases**:
- Dashboard overview of all work orders
- Quick identification of pending or delayed orders
- Overall production and dispatch monitoring

---

## Integration Points

### Automatic Status Updates

The status tracking system is automatically integrated with:

1. **Job Order Creation** (`POST /api/falcon/joborder/create`)
   - Status changes from `Pending` to `In Progress`

2. **Dispatch Creation** (`POST /api/falcon/dispatch/create`)
   - Status recalculated based on dispatched quantities
   - Status may change from `In Progress` to `Completed`

## Status Calculation Algorithm

### Completion Criteria

A work order is marked as `Completed` when **both** conditions are met:

1. **Total Quantity Check**: `Total Dispatched Quantity >= Total Planned Quantity`
2. **Line Item Check**: All individual products/line items are fully dispatched

### Progress Calculation

```javascript
Progress Percentage = (Total Dispatched Quantity / Total Planned Quantity) × 100
```

### Example Scenarios

#### Scenario 1: Partial Dispatch
```
Work Order: WO-001
Total Planned: 1000 units
- Product A: 500 units planned, 200 dispatched
- Product B: 500 units planned, 300 dispatched
Total Dispatched: 500 units
Status: In Progress (50% complete)
```

#### Scenario 2: Completed
```
Work Order: WO-002
Total Planned: 800 units
- Product A: 400 units planned, 400 dispatched ✓
- Product B: 400 units planned, 400 dispatched ✓
Total Dispatched: 800 units
Status: Completed (100% complete)
```

#### Scenario 3: Over-dispatched but Incomplete Line Items
```
Work Order: WO-003
Total Planned: 1000 units
- Product A: 500 units planned, 600 dispatched (over-dispatched)
- Product B: 500 units planned, 300 dispatched (incomplete)
Total Dispatched: 900 units
Status: In Progress (90% complete)
Reason: Product B is not fully dispatched
```

## Error Handling

All endpoints include comprehensive error handling:

### Common Error Responses

#### Invalid Work Order ID
```json
{
  "statusCode": 400,
  "success": false,
  "message": "Invalid work order ID: xyz123"
}
```

#### Work Order Not Found
```json
{
  "statusCode": 404,
  "success": false,
  "message": "Work order with ID 6756a1b2c3d4e5f6a7b8c9d0 not found"
}
```

#### Server Error
```json
{
  "statusCode": 500,
  "success": false,
  "message": "Internal server error"
}
```

## Performance Considerations

1. **Caching**: Consider implementing caching for frequently accessed status data
2. **Async Updates**: Status updates during job order and dispatch creation are non-blocking
3. **Bulk Operations**: Use the status summary endpoint for dashboard views instead of multiple individual requests

## Frontend Integration Example

### React/TypeScript Example

```typescript
import axios from 'axios';

// Get single work order status
const getWorkOrderStatus = async (workOrderId: string) => {
  try {
    const response = await axios.get(
      `/api/falcon/workorders/${workOrderId}/status`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data.data;
  } catch (error) {
    console.error('Error fetching work order status:', error);
    throw error;
  }
};

// Get all work orders status summary
const getAllWorkOrdersStatus = async () => {
  try {
    const response = await axios.get(
      '/api/falcon/workorders/status/all',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data.data;
  } catch (error) {
    console.error('Error fetching work orders status:', error);
    throw error;
  }
};

// Usage in component
const WorkOrderStatusDashboard = () => {
  const [statusData, setStatusData] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      const data = await getAllWorkOrdersStatus();
      setStatusData(data);
    };
    fetchStatus();
  }, []);

  return (
    <div>
      <h2>Work Orders Status</h2>
      <p>Pending: {statusData?.summary.pending}</p>
      <p>In Progress: {statusData?.summary.in_progress}</p>
      <p>Completed: {statusData?.summary.completed}</p>
    </div>
  );
};
```

## Testing

### Manual Testing Steps

1. **Create a Work Order**
   - Verify status is `Pending`

2. **Create a Job Order for the Work Order**
   - Verify status changes to `In Progress`

3. **Create Dispatches**
   - Verify progress percentage increases
   - Verify remaining quantities decrease

4. **Complete All Dispatches**
   - Verify status changes to `Completed` when all quantities are dispatched

### Postman Collection

```json
{
  "info": {
    "name": "Work Order Status Tracking",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get Work Order Status",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/api/falcon/workorders/:id/status",
          "host": ["{{baseUrl}}"],
          "path": ["api", "falcon", "workorders", ":id", "status"],
          "variable": [
            {
              "key": "id",
              "value": "6756a1b2c3d4e5f6a7b8c9d0"
            }
          ]
        }
      }
    },
    {
      "name": "Get All Work Orders Status",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/api/falcon/workorders/status/all",
          "host": ["{{baseUrl}}"],
          "path": ["api", "falcon", "workorders", "status", "all"]
        }
      }
    }
  ]
}
```

## Monitoring and Logging

The system includes comprehensive logging:

```
✓ Work order status updated for work_order_number: WO-2024-001
✗ Error updating work order status: [error details]
✓ Work order status updated after dispatch for work_order_number: WO-2024-001
```

## Future Enhancements

Potential improvements for the status tracking system:

1. **Webhook Notifications**: Send notifications when status changes
2. **Email Alerts**: Notify stakeholders of completed or delayed work orders
3. **Advanced Analytics**: Historical status trends and performance metrics
4. **Real-time Updates**: WebSocket integration for live status updates
5. **Custom Status Definitions**: Allow clients to define custom statuses
6. **SLA Tracking**: Monitor delivery timelines against promised dates

## Support

For issues or questions regarding the status tracking API:
- Check server logs for detailed error messages
- Verify JWT token is valid and has proper permissions
- Ensure work order IDs are valid MongoDB ObjectIds
- Contact the development team for technical support

---

**Last Updated**: October 2024
**API Version**: 1.0.0

