# Timelines App - Complete Project Structure

```
timelines-app/
│
├── 📄 Root Configuration Files
│   ├── package.json                     # Node dependencies & scripts
│   ├── package-lock.json                # Locked dependency versions
│   ├── tsconfig.json                    # TypeScript configuration
│   ├── tailwind.config.ts               # Tailwind CSS configuration
│   ├── next.config.ts                   # Next.js configuration
│   ├── postcss.config.mjs               # PostCSS configuration
│   ├── next-env.d.ts                    # Next.js TypeScript types
│   ├── .eslintrc.json                   # ESLint configuration
│   ├── .gitignore                       # Git ignore rules
│   ├── .env.local                       # Environment variables (SECRET)
│   └── .env.example                     # Example environment template
│
├── 📄 Documentation Files
│   ├── README.md                        # Project setup guide
│   ├── PROJECT_OVERVIEW.md              # Architecture overview
│   ├── PROJECT_STRUCTURE.md             # This file
│   ├── MATERIALS_SYSTEM_GUIDE.md        # Materials feature guide
│   ├── MATERIALS_STAGE_SUMMARY.md       # Materials stage details
│   ├── MATERIALS_VISUAL_REFERENCE.md    # Visual reference
│   ├── INVENTORY_SYSTEM_GUIDE.md        # Inventory feature guide
│   ├── MEASUREMENT_FIELDS_REFERENCE.md  # Measurement types
│   ├── MEASUREMENT_UPDATE_SUMMARY.md    # Measurement updates
│   ├── TESTING_CHECKLIST.md             # Testing guide
│   ├── FIX_STORAGE_BUCKET.md            # Storage fix guide
│   ├── BUILD_SUMMARY.md                 # Build summary
│   ├── CHECKLIST.md                     # General checklist
│   └── QUICK_REFERENCE.md               # Quick reference
│
├── 📁 src/                              # ========== SOURCE CODE ==========
│   │
│   ├── 📁 app/                          # ===== NEXT.JS APP ROUTER =====
│   │   ├── globals.css                  # Global CSS styles
│   │   ├── layout.tsx                   # Root layout component
│   │   ├── page.tsx                     # Home/Login page
│   │   │
│   │   │   ────────────────────────────────────────────────────
│   │   │                    ADMIN SECTION
│   │   │   ────────────────────────────────────────────────────
│   │   │
│   │   ├── 📁 admin/                    # Admin Dashboard
│   │   │   ├── page.tsx                 # Main admin dashboard
│   │   │   │
│   │   │   ├── 📁 staff/                # Staff Management
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── 📁 staff-work/           # Staff Work & Payments
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── 📁 staff-performance/    # Staff Analytics
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── 📁 marking-templates/    # Marking Task Templates
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── 📁 cutting-templates/    # Cutting Task Templates
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── 📁 materials/            # Materials & Inventory
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── 📁 orders/               # Order Management
│   │   │   │   ├── page.tsx             # Orders list
│   │   │   │   └── 📁 [orderId]/        # Dynamic order details
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── 📁 customers/            # Customer Management
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── 📁 purchases/            # Purchase Requests
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── 📁 reports/              # Reports & Analytics
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   └── 📁 settings/             # App Settings
│   │   │       └── page.tsx
│   │   │
│   │   │   ────────────────────────────────────────────────────
│   │   │                    WORKFLOW STAGES
│   │   │   ────────────────────────────────────────────────────
│   │   │
│   │   ├── 📁 intake/                   # STAGE 1: Intake/Order Creation
│   │   │   ├── page.tsx                 # Main intake page
│   │   │   ├── CreateOrderForm.tsx      # Order creation form (60KB)
│   │   │   └── OrdersList.tsx           # Pending orders list
│   │   │
│   │   ├── 📁 materials/                # STAGE 2: Materials Usage
│   │   │   └── page.tsx                 # Materials tracking page
│   │   │
│   │   ├── 📁 purchase/                 # Purchase Requests (Staff)
│   │   │   ├── page.tsx                 # Entry point
│   │   │   ├── PurchaseClient.tsx       # Client wrapper
│   │   │   └── PurchasePageContent.tsx  # Main purchase UI
│   │   │
│   │   ├── 📁 marking/                  # STAGE 3: Marking (Staff)
│   │   │   └── page.tsx                 # Marking tasks page
│   │   │
│   │   ├── 📁 marking-check/            # STAGE 3: Marking (Checker)
│   │   │   └── page.tsx                 # Marking approval page
│   │   │
│   │   ├── 📁 cutting/                  # STAGE 4: Cutting (Staff)
│   │   │   └── page.tsx                 # Cutting tasks page
│   │   │
│   │   ├── 📁 cutting-check/            # STAGE 4: Cutting (Checker)
│   │   │   └── page.tsx                 # Cutting approval page
│   │   │
│   │   ├── 📁 stitching/                # STAGE 5: Stitching (Staff)
│   │   │   └── page.tsx                 # Stitching tasks page
│   │   │
│   │   ├── 📁 stitching-check/          # STAGE 5: Stitching (Checker)
│   │   │   └── page.tsx                 # Stitching approval page
│   │   │
│   │   ├── 📁 ironing/                  # STAGE 6: Ironing
│   │   │   └── page.tsx                 # Ironing page
│   │   │
│   │   ├── 📁 billing/                  # STAGE 7: Billing
│   │   │   └── page.tsx                 # Billing page
│   │   │
│   │   ├── 📁 delivery/                 # STAGE 8: Delivery
│   │   │   └── page.tsx                 # Delivery page
│   │   │
│   │   ├── 📁 supervisor/               # Supervisor Dashboard
│   │   │   └── page.tsx                 # Supervisor view
│   │   │
│   │   ├── 📁 api/                      # API Routes
│   │   │   └── (API endpoints)
│   │   │
│   │   └── 📁 hooks/                    # Custom React Hooks
│   │       └── (hook files)
│   │
│   │   ────────────────────────────────────────────────────────
│   │                    SHARED COMPONENTS
│   │   ────────────────────────────────────────────────────────
│   │
│   ├── 📁 components/                   # Reusable UI Components
│   │   ├── TopBar.tsx                   # Navigation header
│   │   ├── Toast.tsx                    # Toast notifications
│   │   ├── ProtectedRoute.tsx           # Auth route wrapper
│   │   ├── StagePageContent.tsx         # Stage page layout (21KB)
│   │   ├── MaterialsInput.tsx           # Materials input form (12KB)
│   │   ├── MaterialsView.tsx            # Materials display (10KB)
│   │   ├── PlannedMaterialsInput.tsx    # Planned materials form (13KB)
│   │   ├── MultiItemInput.tsx           # Multi-item order input (14KB)
│   │   ├── DateFilter.tsx               # Date filtering component
│   │   └── AssignmentHistoryPanel.tsx   # Staff assignment history
│   │
│   │   ────────────────────────────────────────────────────────
│   │                    BUSINESS LOGIC
│   │   ────────────────────────────────────────────────────────
│   │
│   ├── 📁 lib/                          # Firebase Operations & Utils
│   │   ├── firebase.ts                  # Firebase configuration
│   │   ├── orders.ts                    # Order lifecycle & timeline
│   │   ├── orderItems.ts                # Order item operations
│   │   ├── customers.ts                 # Customer CRUD (13KB)
│   │   ├── markingTemplates.ts          # Marking tasks & templates (15KB)
│   │   ├── cuttingTemplates.ts          # Cutting tasks & templates (14KB)
│   │   ├── assignments.ts               # Staff assignment logic
│   │   ├── inventory.ts                 # Inventory management (11KB)
│   │   ├── purchases.ts                 # Purchase request logic
│   │   ├── storage.ts                   # File storage (Firebase)
│   │   ├── otp.ts                       # OTP authentication
│   │   └── privacy.ts                   # Privacy settings
│   │
│   │   ────────────────────────────────────────────────────────
│   │                    CONTEXTS & TYPES
│   │   ────────────────────────────────────────────────────────
│   │
│   ├── 📁 contexts/                     # React Contexts
│   │   └── AuthContext.tsx              # Authentication context
│   │
│   └── 📁 types/                        # TypeScript Definitions
│       └── index.ts                     # All interfaces & types (22KB)
│
└── 📁 node_modules/                     # Installed packages (auto-generated)
```

---

## 📋 Order Workflow Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ORDER WORKFLOW STAGES                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   1. INTAKE          2. MATERIALS        3. MARKING         4. CUTTING      │
│   ┌─────────┐        ┌─────────┐        ┌─────────┐        ┌─────────┐     │
│   │ Create  │   →    │ Track   │   →    │ Staff   │   →    │ Staff   │     │
│   │ Order   │        │ Usage   │        │ Tasks   │        │ Tasks   │     │
│   └─────────┘        └─────────┘        └────┬────┘        └────┬────┘     │
│                                              │                   │          │
│                                         ┌────▼────┐         ┌────▼────┐    │
│                                         │ Checker │         │ Checker │    │
│                                         │ Approve │         │ Approve │    │
│                                         └─────────┘         └─────────┘    │
│                                                                              │
│   5. STITCHING       6. IRONING         7. BILLING         8. DELIVERY     │
│   ┌─────────┐        ┌─────────┐        ┌─────────┐        ┌─────────┐     │
│   │ Staff   │   →    │ Iron &  │   →    │ Payment │   →    │ Hand    │     │
│   │ Tasks   │        │ Finish  │        │ Collect │        │ Over    │     │
│   └────┬────┘        └─────────┘        └─────────┘        └─────────┘     │
│        │                                                                     │
│   ┌────▼────┐                                                               │
│   │ Checker │                                                               │
│   │ Approve │                                                               │
│   └─────────┘                                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Firestore Collections

| Collection | Description |
|------------|-------------|
| `users` | Staff accounts, roles & permissions |
| `customers` | Customer records & contact info |
| `orders` | All orders with lifecycle data |
| `orderItems` | Individual items within orders |
| `markingTasks` | Marking stage subtasks |
| `cuttingTasks` | Cutting stage subtasks |
| `markingTemplates` | Template definitions for marking |
| `cuttingTemplates` | Template definitions for cutting |
| `inventory` | Material stock levels |
| `purchaseRequests` | Material purchase requests |

---

## 👥 User Roles

| Role | Access |
|------|--------|
| `admin` | Full access, all pages |
| `supervisor` | Dashboard, assignments, reports |
| `intake` | Order creation |
| `materials` | Materials usage |
| `purchase` | Purchase requests |
| `marking` | Marking tasks |
| `marking_checker` | Marking approval |
| `cutting` | Cutting tasks |
| `cutting_checker` | Cutting approval |
| `stitching` | Stitching tasks |
| `stitching_checker` | Stitching approval |
| `ironing` | Ironing tasks |
| `billing` | Payment collection |
| `delivery` | Order handover |
