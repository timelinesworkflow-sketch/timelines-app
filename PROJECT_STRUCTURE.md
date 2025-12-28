# Timelines App - Project Structure

```
timelines-app/
│
├── 📁 src/                              # Main source code directory
│   │
│   ├── 📁 app/                          # Next.js App Router pages
│   │   ├── globals.css                  # Global CSS styles
│   │   ├── layout.tsx                   # Root layout component
│   │   ├── page.tsx                     # Home/Login page
│   │   │
│   │   ├── 📁 admin/                    # Admin dashboard pages
│   │   │   ├── page.tsx                 # Main admin dashboard
│   │   │   ├── 📁 customers/            # Customer management
│   │   │   ├── 📁 cutting-templates/    # Cutting task templates
│   │   │   ├── 📁 marking-templates/    # Marking task templates
│   │   │   ├── 📁 materials/            # Materials management
│   │   │   ├── 📁 orders/               # Order management
│   │   │   ├── 📁 purchases/            # Purchase requests
│   │   │   ├── 📁 reports/              # Reports & analytics
│   │   │   ├── 📁 settings/             # App settings
│   │   │   ├── 📁 staff/                # Staff management
│   │   │   ├── 📁 staff-performance/    # Staff analytics
│   │   │   └── 📁 staff-work/           # Staff work logs
│   │   │
│   │   ├── 📁 intake/                   # Intake stage
│   │   │   ├── page.tsx                 # Intake main page
│   │   │   ├── CreateOrderForm.tsx      # Order creation form
│   │   │   └── OrdersList.tsx           # Pending orders list
│   │   │
│   │   ├── 📁 materials/                # Materials stage
│   │   │   └── page.tsx                 # Materials usage page
│   │   │
│   │   ├── 📁 purchase/                 # Purchase requests
│   │   │   ├── page.tsx                 # Purchase page
│   │   │   ├── PurchaseClient.tsx       # Client wrapper
│   │   │   └── PurchasePageContent.tsx  # Main purchase UI
│   │   │
│   │   ├── 📁 marking/                  # Marking stage (staff)
│   │   │   └── page.tsx                 # Marking tasks page
│   │   │
│   │   ├── 📁 marking-check/            # Marking checker stage
│   │   │   └── page.tsx                 # Marking approval page
│   │   │
│   │   ├── 📁 cutting/                  # Cutting stage (staff)
│   │   │   └── page.tsx                 # Cutting tasks page
│   │   │
│   │   ├── 📁 cutting-check/            # Cutting checker stage
│   │   │   └── page.tsx                 # Cutting approval page
│   │   │
│   │   ├── 📁 stitching/                # Stitching stage
│   │   │   └── page.tsx                 # Stitching tasks page
│   │   │
│   │   ├── 📁 stitching-check/          # Stitching checker stage
│   │   │   └── page.tsx                 # Stitching approval page
│   │   │
│   │   ├── 📁 ironing/                  # Ironing stage
│   │   │   └── page.tsx                 # Ironing page
│   │   │
│   │   ├── 📁 billing/                  # Billing stage
│   │   │   └── page.tsx                 # Billing page
│   │   │
│   │   ├── 📁 delivery/                 # Delivery stage
│   │   │   └── page.tsx                 # Delivery page
│   │   │
│   │   ├── 📁 supervisor/               # Supervisor dashboard
│   │   │   └── page.tsx                 # Supervisor page
│   │   │
│   │   ├── 📁 api/                      # API routes
│   │   │   └── (API endpoints)
│   │   │
│   │   └── 📁 hooks/                    # Custom React hooks
│   │
│   ├── 📁 components/                   # Reusable UI components
│   │   ├── AssignmentHistoryPanel.tsx   # Staff assignment history
│   │   ├── DateFilter.tsx               # Date filtering component
│   │   ├── MaterialsInput.tsx           # Materials input form
│   │   ├── MaterialsView.tsx            # Materials display
│   │   ├── MultiItemInput.tsx           # Multi-item order input
│   │   ├── PlannedMaterialsInput.tsx    # Planned materials form
│   │   ├── ProtectedRoute.tsx           # Auth route wrapper
│   │   ├── StagePageContent.tsx         # Stage page layout
│   │   ├── Toast.tsx                    # Toast notifications
│   │   └── TopBar.tsx                   # Navigation header
│   │
│   ├── 📁 contexts/                     # React contexts
│   │   └── AuthContext.tsx              # Authentication context
│   │
│   ├── 📁 lib/                          # Business logic & utilities
│   │   ├── firebase.ts                  # Firebase configuration
│   │   ├── assignments.ts               # Staff assignment logic
│   │   ├── customers.ts                 # Customer CRUD operations
│   │   ├── cuttingTemplates.ts          # Cutting tasks & templates
│   │   ├── inventory.ts                 # Inventory management
│   │   ├── markingTemplates.ts          # Marking tasks & templates
│   │   ├── orderItems.ts                # Order item operations
│   │   ├── orders.ts                    # Order lifecycle & timeline
│   │   ├── otp.ts                       # OTP authentication
│   │   ├── privacy.ts                   # Privacy settings
│   │   ├── purchases.ts                 # Purchase request logic
│   │   └── storage.ts                   # File storage (Firebase)
│   │
│   └── 📁 types/                        # TypeScript type definitions
│       └── index.ts                     # All interfaces & types
│
├── 📁 .agent/                           # Gemini agent workflows
│
├── 📄 Documentation Files
│   ├── README.md                        # Project setup guide
│   ├── PROJECT_OVERVIEW.md              # Architecture overview
│   ├── MATERIALS_SYSTEM_GUIDE.md        # Materials feature guide
│   ├── INVENTORY_SYSTEM_GUIDE.md        # Inventory feature guide
│   ├── MEASUREMENT_FIELDS_REFERENCE.md  # Measurement types
│   └── TESTING_CHECKLIST.md             # Testing guide
│
├── 📄 Configuration Files
│   ├── package.json                     # Node dependencies
│   ├── tsconfig.json                    # TypeScript config
│   ├── tailwind.config.ts               # Tailwind CSS config
│   ├── next.config.ts                   # Next.js config
│   ├── postcss.config.mjs               # PostCSS config
│   ├── .env.local                       # Environment variables
│   └── .eslintrc.json                   # ESLint config
│
└── 📁 node_modules/                     # Installed packages
```

---

## Workflow Stages (Order Pipeline)

```
┌──────────────────────────────────────────────────────────────────────┐
│                        ORDER WORKFLOW                                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   Intake → Materials → Marking → Cutting → Stitching → Ironing       │
│      ↓                    ↓         ↓         ↓                       │
│   Create              Checker    Checker   Checker                    │
│   Order              Approval   Approval   Approval                   │
│                                                                       │
│                                     ↓                                 │
│                            Billing → Delivery                         │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Key File Responsibilities

| Folder/File | Purpose |
|-------------|---------|
| `src/app/` | Pages (Next.js routes) |
| `src/components/` | Reusable UI pieces |
| `src/lib/` | Firebase operations & business logic |
| `src/contexts/` | Global state (auth) |
| `src/types/` | TypeScript interfaces |

---

## Firestore Collections

| Collection | Description |
|------------|-------------|
| `users` | Staff accounts & permissions |
| `customers` | Customer records |
| `orders` | All orders |
| `orderItems` | Items within orders |
| `markingTasks` | Marking stage subtasks |
| `cuttingTasks` | Cutting stage subtasks |
| `markingTemplates` | Template definitions for marking |
| `cuttingTemplates` | Template definitions for cutting |
| `inventory` | Material stock levels |
| `purchaseRequests` | Material purchase requests |
