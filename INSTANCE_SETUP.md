# Signage Instance Setup & Management

Complete guide to creating and managing signage instances.

## Overview

Signage instances are separate, independent displays. Each instance has:
- Its own questionnaire configuration
- Its own background configuration
- Its own user data and sessions
- Its own statistics

## Creating Instances

### Via Superadmin Dashboard (Recommended)

1. **Access Superadmin**:
   ```
   http://localhost:3001/superadmin
   ```

2. **Create Instance**:
   - Click "+ Create New Instance"
   - Enter Instance ID (e.g., `store_1`, `mall_kiosk`)
     - Rules: Only lowercase letters, numbers, and underscores
     - Examples: `store_1`, `location_2`, `kiosk_3`
   - Enter Location Name (e.g., "Store 1", "Mall Kiosk")
   - Click "Create Instance"

3. **Instance is Created With**:
   - Default questionnaire (He/She options, sample questions)
   - Default background (red/black gradient)
   - Active status
   - Ready to use immediately

### Via API

```bash
curl -X POST http://localhost:3001/api/signage \
  -H "Content-Type: application/json" \
  -d '{
    "id": "store_1",
    "location_name": "Store 1",
    "is_active": true
  }'
```

## Default Configuration

### Default Questionnaire

Every new instance gets default questionnaire configuration:
- **Initial options**: He / She (gender selection)
- **Sample questions**: Configurable per gender
- **Result bands**: Score ranges with custom messages

### Default Visual Layout

- **Background Type**: Gradient
- **Colors**: `['#991b1b', '#000000', '#991b1b']` (Red → Black → Red)
- **Signage display**: Responsive to all screen sizes

## Instance Management

### Edit Instance

**Via Superadmin**:
1. Go to superadmin dashboard
2. Click "Edit" button for the instance
3. Modify location name or active status
4. Press Enter or click "Save"

**Via API**:
```bash
curl -X PATCH http://localhost:3001/api/signage/store_1 \
  -H "Content-Type: application/json" \
  -d '{
    "location_name": "Updated Store Name",
    "is_active": true
  }'
```

### Activate/Deactivate Instance

**Via Superadmin**:
- Click "Activate" or "Deactivate" button
- Changes apply immediately

**Purpose**:
- Deactivate instances that are temporarily offline
- Prevent form submissions to inactive instances
- Keep instance data for reactivation later

### Delete Instance

**Via Superadmin**:
1. Click "Delete" button
2. Confirm deletion
3. All associated data is deleted:
   - Users
   - Sessions
   - Instance record

**Warning**: Deletion is permanent and cannot be undone!

## Accessing Instance Dashboards

### Instance Admin Dashboard

Each instance has its own dedicated admin dashboard:

```
http://localhost:3001/admin?id=INSTANCE_ID
```

**Features**:
- Overview statistics for this instance only
- Users who played for this instance
- Sessions for this instance
- Outcomes management for this instance
- Background customization for this instance

**No Instance Switching**: Each dashboard is focused on one instance only.

## Using Instances

### Signage Display

```
http://localhost:3001/signage?id=INSTANCE_ID
```

- Shows QR code linking to this instance's form
- Displays questionnaire and thank-you screen for this instance
- Shows results for this instance's games

### Mobile Form

```
http://localhost:3001/play/?id=INSTANCE_ID
```

- Users enter information
- Submits to this specific instance
- Triggers game on this instance's signage display

## Best Practices

### Instance Naming

1. **Use consistent format**: lowercase with underscores
   - Good: `store_1`, `mall_kiosk`, `airport_display`
   - Bad: `Store-1`, `Mall Kiosk`, `AirportDisplay`

2. **Use descriptive IDs**: Make it clear what the instance is
   - Good: `downtown_store`, `mall_entrance`, `event_tent`
   - Bad: `inst1`, `test`, `abc123`

3. **Keep it short**: Easier to type and remember
   - Good: `store_1`
   - Bad: `downtown_store_location_number_one`

### Instance Management

1. **Create before use**: Always create instances in superadmin first
2. **Test each instance**: Verify game works before going live
3. **Customize per location**: Set up outcomes and backgrounds per instance
4. **Monitor activity**: Use instance dashboards to track usage
5. **Deactivate unused**: Deactivate instances that are not in use

### Data Isolation

- Each instance has separate:
  - Users
  - Sessions
  - Outcomes
  - Background settings
  - Statistics

- Data is not shared between instances
- Each instance can be managed independently

## Troubleshooting

### Instance not found

**Error**: "Signage not found" when accessing instance

**Solutions**:
1. Verify instance exists in superadmin
2. Check instance ID spelling (case-sensitive)
3. Ensure instance is active (not deactivated)
4. Create instance in superadmin if it doesn't exist

### Instance has no outcomes

**Problem**: Signage doesn't display correctly

**Solutions**:
1. Go to instance admin dashboard
2. Outcomes tab
3. Add outcomes manually
4. Or check if outcomes are active

### Instance data not showing

**Problem**: Dashboard shows no users/sessions

**Solutions**:
1. Verify you're using correct instance ID
2. Check instance is active
3. Verify users submitted forms with correct instance ID
4. Check database connection

## API Reference

### List All Instances
```bash
GET /api/signage
```

### Get Instance Config
```bash
GET /api/signage/:id
```

### Create Instance
```bash
POST /api/signage
Body: { id, location_name, is_active? }
```

### Update Instance
```bash
PATCH /api/signage/:id
Body: { location_name?, is_active? }
```

### Delete Instance
```bash
DELETE /api/signage/:id
```

## Example: Multiple Store Setup

### Store 1
- ID: `store_1`
- Location: "Downtown Store"
- Admin: `http://localhost:3001/admin?id=store_1`
- Signage: `http://localhost:3001/signage?id=store_1`
- Form: `http://localhost:3001/play/?id=store_1`

### Store 2
- ID: `store_2`
- Location: "Mall Location"
- Admin: `http://localhost:3001/admin?id=store_2`
- Signage: `http://localhost:3001/signage?id=store_2`
- Form: `http://localhost:3001/play/?id=store_2`

### Store 3
- ID: `store_3`
- Location: "Airport Kiosk"
- Admin: `http://localhost:3001/admin?id=store_3`
- Signage: `http://localhost:3001/signage?id=store_3`
- Form: `http://localhost:3001/play/?id=store_3`

Each store operates independently with its own data and configuration.
