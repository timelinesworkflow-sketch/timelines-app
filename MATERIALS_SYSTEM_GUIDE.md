# 📦 Materials Management System - Implementation Guide

## Overview

The Materials Management system provides accurate tracking of materials, physical lengths, and responsible staff. This system ensures:
- **Meter = Physical Length** (NOT cost)
- **Labor = Staff Identity** (NOT labor cost)
- Full accountability and audit safety

---

## 🧱 Data Model

### Material Interface (Centralized Collection)

```typescript
interface Material {
    materialId: string;              // Auto-generated
    materialName: string;            // e.g., "Cotton Fabric"
    materialCategory: MaterialCategory; // Fabric, Thread, Button, etc.
    colour: string;                  // Color specification
    quantity: number;                // Number of items or rolls
    meter: number;                   // Length per quantity (PHYSICAL LENGTH ONLY)
    totalLength: number;             // Calculated: quantity × meter
    costPerMeter: number;            // Currency only (₹)
    totalMaterialCost: number;       // Calculated: totalLength × costPerMeter
    laborStaffId: string;            // Auto-filled from logged-in user
    laborStaffName: string;          // Auto-filled from logged-in user
    linkedOrderId: string;           // Order this material is used for
    createdAt: Timestamp;
    updatedAt?: Timestamp;
}
```

### Material Categories

| Value      | Label    |
|------------|----------|
| `fabric`   | Fabric   |
| `thread`   | Thread   |
| `button`   | Button   |
| `zipper`   | Zipper   |
| `lining`   | Lining   |
| `elastic`  | Elastic  |
| `hook`     | Hook     |
| `lace`     | Lace     |
| `other`    | Other    |

---

## 📊 Field Definitions

### Input Fields

| Field           | Type     | Unit    | Description                          | Editable |
|-----------------|----------|---------|--------------------------------------|----------|
| Material Name   | Text     | -       | Name of the material                 | ✅ Yes   |
| Category        | Select   | -       | Material category (Fabric, etc.)     | ✅ Yes   |
| Quantity        | Number   | items   | Number of items/rolls                | ✅ Yes   |
| Colour          | Text     | -       | Color specification                  | ✅ Yes   |
| Meter           | Number   | **m**   | Length per quantity (LENGTH ONLY)    | ✅ Yes   |
| Cost per Meter  | Number   | **₹**   | Price per meter                      | ✅ Yes   |

### Calculated Fields (Auto-computed)

| Field               | Formula                      | Unit    |
|---------------------|------------------------------|---------|
| Total Length        | `quantity × meter`           | **m**   |
| Total Material Cost | `totalLength × costPerMeter` | **₹**   |

### Auto-filled Fields (Read-only)

| Field            | Source                | Editable |
|------------------|----------------------|----------|
| Labor Staff ID   | Logged-in user       | ❌ No    |
| Labor Staff Name | Logged-in user       | ❌ No    |
| Created At       | System timestamp     | ❌ No    |

---

## 🚫 Strict Rules

### What Meter IS:
- ✅ Physical length of material
- ✅ Measured in meters (m)
- ✅ Numeric value only

### What Meter is NOT:
- ❌ Cost or price
- ❌ Currency value
- ❌ Labor charge

### What Labor IS:
- ✅ Staff identity (ID + Name)
- ✅ Auto-filled from authentication
- ✅ Used for accountability/audit

### What Labor is NOT:
- ❌ Labor cost
- ❌ Payment amount
- ❌ Editable field

---

## 🧑‍🏭 Staff App Behavior

### When Staff Logs In:

1. Staff ID and Name are fetched from authentication
2. These values are stored in `userData`
3. Cannot be modified by the user

### When Adding Material Entry:

1. Staff enters material details
2. `laborStaffId` is **automatically assigned** from `userData.staffId`
3. `laborStaffName` is **automatically assigned** from `userData.name`
4. Staff **cannot edit** labor fields
5. System calculates `totalLength` and `totalMaterialCost`

### Entry Process:

```
Staff Login → Select Order → Add Materials →
    Fill: Name, Category, Qty, Colour, Meter, ₹/Meter →
    Auto: Total Length, Total Cost, Labor Staff →
    Submit
```

---

## 🖥️ Admin Dashboard

### Location: `/admin/materials`

### Summary Cards:

| Card                  | Data Shown                    | Color   |
|-----------------------|-------------------------------|---------|
| Total Material Cost   | Sum of all filtered costs     | Green   |
| Total Length Used     | Sum of all filtered lengths   | Blue    |
| Most Used Material    | Material with highest usage   | Purple  |
| Total Entries         | Count of filtered entries     | Orange  |

### Filters Available:

| Filter         | Options                                    |
|----------------|-------------------------------------------|
| Date           | All Time, Today, This Week, This Month, Custom Range |
| Category       | All Categories, Fabric, Thread, Button... |
| Labor (Staff)  | All Staff, [Staff Name (ID)]...           |
| Order ID       | Text search                               |

### Materials Table Columns:

| Column          | Description                           |
|-----------------|---------------------------------------|
| Material Name   | Name of the material                  |
| Category        | Material type                         |
| Qty             | Number of items/rolls                 |
| Meter (Length)  | Length per quantity                   |
| Total Length    | Calculated total length (highlighted) |
| ₹/Meter         | Cost per meter                        |
| Total Cost      | Calculated total cost (highlighted)   |
| Labor (Staff)   | Staff name and ID                     |
| Order           | Linked order ID                       |
| Date            | Entry date                            |

### Staff-wise Usage Section:

Shows breakdown per staff member:
- Staff Name & ID
- Total Length used
- Total Cost of materials

---

## 📋 Files Created/Modified

### New Files:

| File                                      | Purpose                               |
|-------------------------------------------|---------------------------------------|
| `src/lib/materials.ts`                    | Firestore CRUD operations             |
| `src/app/admin/materials/page.tsx`        | Admin Materials Dashboard             |

### Modified Files:

| File                                      | Changes                               |
|-------------------------------------------|---------------------------------------|
| `src/types/index.ts`                      | Added Material, MaterialCategory types |
| `src/components/MaterialsInput.tsx`       | Updated with corrected data model     |
| `src/components/MaterialsView.tsx`        | Updated to show new fields            |
| `src/app/materials/page.tsx`              | Updated handler for new model         |
| `src/app/admin/page.tsx`                  | Added Materials & Inventory link      |

---

## 🔐 Access Control

### Role Permissions:

| Action                      | Staff | Supervisor | Admin |
|-----------------------------|-------|------------|-------|
| Add material entries        | ✅    | ✅         | ✅    |
| Edit own entries            | ✅    | ✅         | ✅    |
| Edit others' entries        | ❌    | ❌         | ✅    |
| View all entries            | ❌    | ❌         | ✅    |
| View analytics/filters      | ❌    | ❌         | ✅    |
| Override labor staff fields | ❌    | ❌         | ❌    |

---

## 📊 Analytics for Admin

Admin can instantly understand:

1. **Who took the material** → Labor (Staff) column/filter
2. **How much length was used** → Total Length column/summary
3. **For which order** → Order ID column/filter
4. **At what cost** → Total Cost column/summary
5. **In which time period** → Date filter

---

## 💡 Example Usage

### Scenario: Staff adds fabric for a blouse order

**Input:**
```
Material Name: Cotton Fabric
Category: Fabric
Quantity: 2
Colour: Red
Meter (Length): 1.5 m
Cost per Meter: ₹200
```

**Auto-calculated:**
```
Total Length: 2 × 1.5 = 3.0 m
Total Material Cost: 3.0 × ₹200 = ₹600
```

**Auto-filled:**
```
Labor Staff ID: STAFF_001
Labor Staff Name: Rajesh Kumar
```

---

## ⚙️ Technical Implementation

### Firestore Collection: `materials`

```javascript
// Document structure
{
    materialId: "abc123",
    materialName: "Cotton Fabric",
    materialCategory: "fabric",
    colour: "Red",
    quantity: 2,
    meter: 1.5,
    totalLength: 3.0,
    costPerMeter: 200,
    totalMaterialCost: 600,
    laborStaffId: "STAFF_001",
    laborStaffName: "Rajesh Kumar",
    linkedOrderId: "ORD_12345",
    createdAt: Timestamp,
    updatedAt: Timestamp
}
```

### Firestore Indexes Required:

- `laborStaffId` + `createdAt` (desc)
- `linkedOrderId` + `createdAt` (desc)
- `materialCategory` + `createdAt` (desc)
- `createdAt` (desc)

---

## 🔮 Future Ready

The system is designed for:

- ✅ Profit & Loss linkage (using `totalMaterialCost`)
- ✅ Inventory management extension
- ✅ Stock level tracking
- ✅ Purchase order integration
- ✅ Supplier management

---

## ✅ Validation Rules

1. **Meter field**: No currency symbols allowed
2. **Staff ID**: No manual override possible
3. **Calculations**: Validated before save
4. **Required fields**: materialName, quantity, meter, costPerMeter
5. **Auto-calculated**: Recalculated on any quantity/meter/cost change

---

**Implementation Date**: December 14, 2025
**Status**: Complete ✅
