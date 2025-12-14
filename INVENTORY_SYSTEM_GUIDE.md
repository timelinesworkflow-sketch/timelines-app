# 📦 Timelines Materials & Inventory System

## Complete Implementation Guide

---

## 🎯 Business Logic

### Core Principles:
1. **Materials are bought in BULK** and stored in a storeroom
2. **Inventory exists INDEPENDENTLY** of orders
3. **Orders only CONSUME inventory**, they never create it
4. **Materials required for an order are PLANNED during intake**
5. **Actual material usage happens later** in the Materials stage
6. **Inventory automatically updates** and shows shortages

---

## 🧱 System Modules

### 1️⃣ Order Intake Module - Material Planning

**Location:** `/intake` → Create Order Form

**What intake staff can do:**
- Add multiple materials per order
- Enter: Material ID, Material Name, Category (free text), Quantity, Meter

**⚠️ IMPORTANT:**
- This is **PLANNING ONLY**
- **NO inventory reduction** at this stage
- **NO cost calculation**
- **NO purchase action**

**Purpose:** Tell the materials person what is required for the order.

---

### 2️⃣ Materials Module (Staff App)

**Location:** `/materials`

#### A. Order-Based Materials Section

Shows orders currently in Materials Stage with:
- Materials required (from intake)
- Required quantity & meter
- Due date

**🔍 AUTOMATIC INVENTORY CHECK:**

| Status | Badge | Meaning |
|--------|-------|---------|
| ✅ In Stock | Green | Enough inventory available |
| ⚠️ Partial Stock | Yellow | Some inventory, purchase needed |
| ❌ Not in Stock | Red | No inventory, must purchase |

**🚫 Staff does NOT manually verify inventory** - System auto-calculates!

**🔔 Shortage Notification:**
If material is Partial/Not in Stock → Shows "Purchase Required" warning

#### B. Inventory Management Section

**➕ Bulk Purchase Entry:**
- Material ID / Lining ID
- Material Name
- Category (free text)
- Quantity bought
- Meter (length per quantity)
- Cost per meter (₹)
- Supplier (optional)

**System behavior:**
- Inventory increases automatically
- Staff ID auto-attached
- Timestamp saved
- Labor field NOT manually editable

**📦 Inventory View:**
- Material Name
- Category
- Total Bought
- Total Used
- Current Stock (meters)
- Last Updated

---

### 3️⃣ Admin Dashboard

**Location:** `/admin/materials`

#### Summary Cards:
- Inventory Items count
- Available Stock (meters)
- Total Used (meters)
- Purchase Value (₹)
- Low Stock count

#### Tabs:
1. **Inventory** - Current stock levels
2. **Purchases** - All purchase history
3. **Usage** - All consumption records

#### Filters:
- Date: Today / Week / Month / Custom
- Category
- Staff
- Search

#### Staff-wise Usage Analytics:
Shows each staff member's total usage

---

## 📊 Data Model

### Inventory Collection (`inventory`)
```javascript
{
    inventoryId: string,
    materialId: string,
    materialName: string,
    category: string,        // FREE TEXT
    totalBoughtLength: number,
    totalUsedLength: number,
    availableLength: number, // Auto-calculated
    lastUpdatedAt: Timestamp,
    createdAt: Timestamp
}
```

### Material Purchases (`material_purchases`)
```javascript
{
    purchaseId: string,
    materialId: string,
    materialName: string,
    category: string,
    quantity: number,
    meter: number,
    totalLength: number,     // Auto-calculated
    costPerMeter: number,
    totalCost: number,       // Auto-calculated
    supplier: string,        // Optional
    laborStaffId: string,    // Auto-filled
    laborStaffName: string,  // Auto-filled
    createdAt: Timestamp
}
```

### Material Usage (`material_usage`)
```javascript
{
    usageId: string,
    orderId: string,
    materialId: string,
    materialName: string,
    category: string,
    quantity: number,
    meter: number,
    totalLength: number,     // Auto-calculated
    laborStaffId: string,    // Auto-filled
    laborStaffName: string,  // Auto-filled
    createdAt: Timestamp
}
```

### Order Planned Materials (in Order document)
```javascript
{
    plannedMaterials: {
        items: PlannedMaterial[],
        plannedByStaffId: string,
        plannedByStaffName: string,
        plannedAt: Timestamp
    }
}
```

---

## 🔐 Role & Access Rules

| Action | Intake | Materials | Admin |
|--------|--------|-----------|-------|
| Plan materials at intake | ✅ | ❌ | ✅ |
| View planned materials | ❌ | ✅ | ✅ |
| Add bulk purchases | ❌ | ✅ | ✅ |
| Confirm usage | ❌ | ✅ | ✅ |
| View all inventory | ❌ | ✅ | ✅ |
| View analytics | ❌ | ❌ | ✅ |
| Edit/audit records | ❌ | ❌ | ✅ |

---

## 🚫 Explicitly Avoided

- ❌ Treating meter as cost
- ❌ Treating labor as labor cost
- ❌ Manual stock checking
- ❌ Dropdown-based category restriction
- ❌ Auto-reducing inventory at intake stage
- ❌ Manual staff ID entry

---

## 📁 Files Structure

### New Files:
```
src/
├── lib/
│   └── inventory.ts           # All inventory CRUD operations
├── components/
│   ├── PlannedMaterialsInput.tsx  # Intake planning component
│   └── MaterialsView.tsx          # Display component (updated)
├── app/
│   ├── materials/
│   │   └── page.tsx           # Staff materials page (complete rewrite)
│   └── admin/
│       └── materials/
│           └── page.tsx       # Admin dashboard (complete rewrite)
```

### Modified Files:
```
src/
├── types/
│   └── index.ts               # New interfaces added
├── app/
│   ├── intake/
│   │   └── CreateOrderForm.tsx  # Added PlannedMaterialsInput
│   └── admin/
│       └── page.tsx           # Added Materials link
```

---

## 🔄 Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                        ORDER LIFECYCLE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. INTAKE                                                      │
│     ├── Customer details                                        │
│     ├── Measurements                                            │
│     └── Materials Planning ─────────► NO inventory change       │
│                                                                 │
│  2. MATERIALS STAGE                                             │
│     ├── View planned materials                                  │
│     ├── Auto-check stock status                                 │
│     │   ├── ✅ In Stock → Ready                                 │
│     │   ├── ⚠️ Partial → Add Purchase                          │
│     │   └── ❌ Not in Stock → Add Purchase                      │
│     ├── Add purchases (updates inventory)                       │
│     └── Confirm usage ──────────────► Inventory REDUCES         │
│                                                                 │
│  3. SUBSEQUENT STAGES                                           │
│     └── View materials used (read-only)                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 💡 Example Flow

### Step 1: Intake creates order
```
Order #123
Materials Planned:
- FAB001 Cotton Fabric, 2 qty × 1.5m = 3m
- LIN001 Silk Lining, 1 qty × 2m = 2m
```
*Inventory unchanged*

### Step 2: Materials staff sees order
```
FAB001: Required 3m | Available 10m | ✅ In Stock
LIN001: Required 2m | Available 0m  | ❌ Not in Stock
```

### Step 3: Staff adds purchase
```
LIN001: Buy 5 qty × 2m = 10m @ ₹100/m = ₹1000
```
*Inventory: LIN001 = 10m*

### Step 4: Staff confirms usage
```
✅ All materials in stock
→ Confirm Usage
```
*Inventory: FAB001 = 7m, LIN001 = 8m*

---

## ✅ Implementation Complete

**Date:** December 14, 2025

All modules implemented and ready for testing!
