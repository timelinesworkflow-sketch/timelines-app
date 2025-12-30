import { Timestamp } from "firebase/firestore";

export type UserRole =
    | "admin"
    | "supervisor"
    | "intake"
    | "materials"
    | "marking"
    | "marking_checker"
    | "cutting"
    | "cutting_checker"
    | "aari"
    | "stitching"
    | "stitching_checker"
    | "hooks"
    | "ironing"
    | "billing"
    | "delivery"
    | "purchase";

// Stage types that support sub-stages (parallel tasks)
export type SubStageParentRole = "marking" | "cutting" | "stitching";

export interface User {
    email: string;
    staffId: string;
    name: string;
    role: UserRole;
    allowedStages: string[];
    isActive: boolean;
    createdAt: Timestamp;
    // Dynamic sub-stage eligibility - keys are sub-stage IDs from templates
    // e.g., { "front_neck_marking": true, "back_neck_marking": true }
    subStageEligibility?: Record<string, boolean>;
    // Default assignment for sub-stages (sub-stage ID -> true if default for that sub-stage)
    // Only 1 staff should be default per sub-stage
    subStageDefaults?: Record<string, boolean>;
}

export type GarmentType = "blouse" | "chudi" | "frock" | "pavadai_sattai" | "re_blouse" | "re_pavada_sattai" | "other";

export type OrderStatus =
    | "draft"
    | "otp_sent"
    | "confirmed_locked"
    | "in_progress"
    | "completed"
    | "delivered";

export interface AssignedStaff {
    intake?: string;
    materials?: string;
    marking?: string;
    marking_checker?: string;
    cutting?: string;
    cutting_checker?: string;
    stitching?: string;
    stitching_checker?: string;
    hooks?: string;
    ironing?: string;
    billing?: string;
}

export interface ChangeHistoryEntry {
    changedAt: Timestamp;
    changedByStaffId: string;
    fieldsChanged: string[];
    oldValues: any;
    newValues: any;
    verifiedByOtp: boolean;
}

// Bill Line Item for itemized billing
export interface BillLineItem {
    sno: number;
    particular: string;
    qty: number;
    price: number;
    total: number;  // qty × price
}

// Predefined bill particulars (from billing format)
export const BILL_PARTICULARS = [
    "Aari work",
    "Aari stitch company",
    "Aari stitch customer",
    "Lining blouse stitch",
    "Puff design",
    "Design blouse",
    "Lining comp",
    "Lining cus",
    "Saree fall hemming",
    "Company blouse",
    "Lining blouse prince cut",
    "Saree pre pleat",
    "Saree knot",
    "Extra lining",
    "Extra silkcotton",
    "Readymade knot",
    "Piping",
    "Chudi",
    "Top",
    "Pant",
    "Machine embroidery",
    "Blouse stitching",
    "Pavada stitching",
    "Sattai stitching",
    "Alteration",
    "Ironing",
    "Other"
] as const;

export type BillParticular = typeof BILL_PARTICULARS[number];

// Bill Status for tracking
export type BillStatus = "draft" | "generated" | "paid" | "delivered";

export interface OrderBilling {
    // Bill identification
    billNumber: string;
    billDate: Timestamp;

    // Line items for detailed billing
    lineItems: BillLineItem[];

    // Legacy charge fields (for backward compatibility)
    markingCharges: number;
    cuttingCharges: number;
    stitchingCharges: number;
    hooksCharges: number;
    ironingCharges: number;
    extraWorkCharges: number;
    materialsCost: number;

    // Calculated totals
    subtotal: number;           // Sum of lineItems totals
    totalAmount: number;
    discountEnabled: boolean;
    discountAmount: number;
    finalAmount: number;

    // Payment info
    amountReceived: number;
    advancePaid: number;
    balance: number;
    paymentStatus: "paid" | "partially_paid" | "not_paid";
    paymentMode: "cash" | "upi" | "card" | "other";

    // Bill status tracking
    status: BillStatus;

    // Billing staff info
    billedByStaffId: string;
    billedByStaffName?: string;
    billedAt: Timestamp;

    // Payment completion
    paidAt?: Timestamp;
    paidReceivedByStaffId?: string;
    paidReceivedByStaffName?: string;

    // Delivery tracking
    deliveredAt?: Timestamp;
    deliveredByStaffId?: string;
    deliveredByStaffName?: string;
    deliveryNotes?: string;
}

// ============================================
// MATERIALS & INVENTORY SYSTEM
// ============================================

// Stock Status for inventory checking
export type StockStatus = "in_stock" | "partial_stock" | "not_in_stock";

// MaterialItem (for legacy order materials and form input)
export interface MaterialItem {
    particular: string;          // Material name/description
    quantity: number;            // Number of units
    colour: string;              // Color specification
    category: string;            // Free text category (NOT dropdown)
    meter: number;               // Meter per unit (LENGTH, not cost)
    costPerMeter: number;        // Cost per meter (₹)
    totalLength: number;         // Calculated: quantity × meter
    totalCost: number;           // Calculated: totalLength × costPerMeter
    laborStaffId: string;        // Auto-filled from logged-in user
    laborStaffName: string;      // Auto-filled from logged-in user
}

// Material measurement unit type
export type MaterialUnit = "Meter" | "Gram" | "Packet";

// Planned Material (at Intake Stage - PLANNING ONLY, no inventory reduction)
export interface PlannedMaterial {
    materialId: string;          // Material ID / Lining ID
    materialName: string;        // Material Name
    colour: string;              // Color specification
    measurement: number;         // Value in selected unit
    unit: MaterialUnit;          // Selected unit (Meter/Gram/Packet)
    materialSource: "customer" | "company";  // Who provides the material (defaults to "company")
}

// Order's planned materials from intake
export interface OrderPlannedMaterials {
    items: PlannedMaterial[];
    plannedByStaffId: string;
    plannedByStaffName: string;
    plannedAt: Timestamp;
}

// Inventory Item (Stock in storeroom - EXISTS INDEPENDENTLY OF ORDERS)
export interface InventoryItem {
    inventoryId: string;
    materialId: string;          // Material ID / Lining ID
    materialName: string;
    category: string;            // Free text category
    totalBoughtLength: number;   // Total meters bought
    totalUsedLength: number;     // Total meters consumed
    availableLength: number;     // Calculated: totalBoughtLength - totalUsedLength
    lastUpdatedAt: Timestamp;
    createdAt: Timestamp;
}

// Material Purchase (Bulk buying - adds to inventory)
export interface MaterialPurchase {
    purchaseId: string;
    materialId: string;          // Material ID / Lining ID
    materialName: string;
    category: string;            // Free text category
    quantity: number;            // Number of items/rolls bought
    meter: number;               // Length per quantity
    totalLength: number;         // Calculated: quantity × meter
    costPerMeter: number;        // Cost per meter (₹)
    totalCost: number;           // Calculated: totalLength × costPerMeter
    supplier?: string;           // Optional supplier name
    laborStaffId: string;        // Auto-filled (NOT editable)
    laborStaffName: string;      // Auto-filled (NOT editable)
    createdAt: Timestamp;
}

// Material Usage (Consumption from orders - reduces inventory)
export interface MaterialUsage {
    usageId: string;
    orderId: string;
    materialId: string;          // Material ID / Lining ID
    materialName: string;
    category: string;
    quantity: number;
    meter: number;
    totalLength: number;         // Calculated: quantity × meter
    laborStaffId: string;        // Auto-filled (NOT editable)
    laborStaffName: string;      // Auto-filled (NOT editable)
    createdAt: Timestamp;
}

// Material with stock status (for display in materials stage)
export interface PlannedMaterialWithStatus extends PlannedMaterial {
    stockStatus: StockStatus;
    availableLength: number;
    shortageLength: number;      // How much more is needed
}

// Order Materials (completed materials stage)
export interface OrderMaterials {
    usedItems: MaterialUsage[];  // Actual materials used
    totalLengthUsed: number;
    completedByStaffId: string;
    completedByStaffName: string;
    completedAt: Timestamp;
}

// ============================================
// PURCHASE SYSTEM
// ============================================

// Purchase type: inventory-based or order-based
export type PurchaseType = "inventory" | "order";

// Purchase status
export type PurchaseStatus = "pending" | "in_progress" | "completed" | "cancelled";

// Purchase Request (for both inventory and order-based purchases)
export interface PurchaseRequest {
    purchaseId: string;
    materialId: string;
    materialName: string;
    colour?: string;
    measurement: number;
    unit: MaterialUnit;
    dueDate: Timestamp;
    // Request metadata
    requestedByStaffId: string;
    requestedByStaffName: string;
    requestedByRole: UserRole;
    purchaseType: PurchaseType;
    sourceStage: "intake" | "materials";  // Where the purchase was requested from
    // Order-based purchase fields (only for purchaseType: "order")
    orderId?: string;
    garmentType?: GarmentType;
    // Status tracking
    status: PurchaseStatus;
    completedByStaffId?: string;
    completedByStaffName?: string;
    completedAt?: Timestamp;
    createdAt: Timestamp;
    // Actual purchase tracking (when completing the purchase)
    actualPurchasedQuantity?: number;  // What was actually purchased
    excessQuantity?: number;           // actualPurchased - measurement (requested)
    excessAddedToInventory?: boolean;  // True if excess auto-added to inventory
    // Leftover tracking (for Materials stage to add to inventory)
    addedToInventory?: boolean;
    addedToInventoryQuantity?: number;
}

// Assignment Target Type
export type AssignmentTarget = "order_item" | "stage_task";

// Assignment Audit Log (tracks all staff assignments - append-only)
export interface AssignmentAuditLog {
    logId: string;
    itemId: string; // Used as task ID for stage tasks
    orderId: string;
    assignmentTarget: AssignmentTarget; // Discriminator
    stage?: string;        // E.g. "marking", "cutting"
    subStage?: string;     // E.g. "front_neck", "lining_cutting"
    assignedFromStaffId?: string;
    assignedFromStaffName?: string;
    assignedToStaffId: string;
    assignedToStaffName: string;
    assignedByStaffId: string;
    assignedByStaffName: string;
    assignedByRole: "admin" | "supervisor";
    timestamp: Timestamp;
}

// ============================================
// MARKING STAGE TYPES
// ============================================

// Marking Task Status
export type MarkingTaskStatus = "not_started" | "in_progress" | "completed" | "needs_rework" | "approved";

// Marking Template Task (definition in template)
export interface MarkingTemplateTask {
    taskName: string;
    taskOrder: number;
    isMandatory: boolean;
}

// Marking Template (defines tasks for a garment type)
export interface MarkingTemplate {
    templateId: string;
    garmentType: GarmentType;
    tasks: MarkingTemplateTask[];
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// Marking Task (order-specific instance of a template task)
export interface MarkingTask {
    taskId: string;
    orderId: string;
    taskName: string;
    taskOrder: number;
    isMandatory: boolean;
    status: MarkingTaskStatus;
    assignedStaffId?: string;
    assignedStaffName?: string;
    createdAt?: Timestamp;
    startedAt?: Timestamp;
    completedAt?: Timestamp;
    approvedBy?: string;
    approvedByName?: string;
    approvedAt?: Timestamp;
    notes?: string;
    // Dynamic sub-stage ID for eligibility/default matching
    subStageId?: string;
}

// ============================================
// CUTTING STAGE TYPES
// ============================================

// Cutting Task Status
export type CuttingTaskStatus = "not_started" | "in_progress" | "completed" | "needs_rework" | "approved";

// Cutting Template Task (definition in template)
export interface CuttingTemplateTask {
    taskName: string;
    taskOrder: number;
    isMandatory: boolean;
}

// Cutting Template (defines tasks for a garment type)
export interface CuttingTemplate {
    templateId: string;
    garmentType: GarmentType;
    tasks: CuttingTemplateTask[];
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// Cutting Task (order-specific instance of a template task)
export interface CuttingTask {
    taskId: string;
    orderId: string;
    taskName: string;
    taskOrder: number;
    isMandatory: boolean;
    status: CuttingTaskStatus;
    assignedStaffId?: string;
    assignedStaffName?: string;
    startedAt?: Timestamp;
    completedAt?: Timestamp;
    approvedBy?: string;
    approvedByName?: string;
    approvedAt?: Timestamp;
    notes?: string;
    // Dynamic sub-stage ID for eligibility/default matching
    subStageId?: string;
}

// ============================================
// STITCHING STAGE TYPES
// ============================================

// Stitching Task Status
export type StitchingTaskStatus = "not_started" | "in_progress" | "completed" | "needs_rework" | "approved";

// Stitching Template Task (definition in template)
export interface StitchingTemplateTask {
    taskName: string;
    taskOrder: number;
    isMandatory: boolean;
}

// Stitching Template (defines tasks for a garment type)
export interface StitchingTemplate {
    templateId: string;
    garmentType: GarmentType;
    tasks: StitchingTemplateTask[];
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// Stitching Task (order-specific instance of a template task)
export interface StitchingTask {
    taskId: string;
    orderId: string;
    taskName: string;
    taskOrder: number;
    isMandatory: boolean;
    status: StitchingTaskStatus;
    assignedStaffId?: string;
    assignedStaffName?: string;
    startedAt?: Timestamp;
    completedAt?: Timestamp;
    approvedBy?: string;
    approvedByName?: string;
    approvedAt?: Timestamp;
    notes?: string;
    // Dynamic sub-stage ID for eligibility/default matching
    subStageId?: string;
}

// ============================================
// MULTI-ITEM WORKFLOW TYPES
// ============================================

// Item status for workflow progression
export type ItemStatus =
    | "intake"
    | "cutting"
    | "stitching"
    | "finishing"
    | "qc"
    | "ready"
    | "delivered";

// Timeline entry for tracking item progress through stages
export interface ItemTimelineEntry {
    stage: string;
    completedBy: string;       // userId
    completedByName?: string;  // Staff name
    completedAt: Timestamp;
}

// Individual item within an order
export interface OrderItem {
    itemId: string;
    itemName: string;           // e.g., "Blouse", "Chudidar", "Lehenga"
    quantity: number;
    measurements: { [key: string]: number | string };
    designNotes: string;
    referenceImages: string[];
    materialCost: number;
    labourCost: number;
    deadline: Timestamp;
    status: ItemStatus;
    handledBy: string;          // Current handler userId
    handledByName?: string;     // Current handler name
    timeline: ItemTimelineEntry[];
    garmentType?: GarmentType;
    // Per-item staff assignment (set by Admin)
    assignedStaffId?: string;
    assignedStaffName?: string;
}

// Overall order status based on item completion
export type OverallOrderStatus = "inProgress" | "partial" | "completed" | "delivered";

export interface Order {
    orderId: string;
    customerId: string;
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    garmentType: GarmentType;
    measurements: { [key: string]: number | string };
    dueDate: Timestamp;
    createdAt: Timestamp;
    confirmedAt: Timestamp | null;
    samplerImages: string[];
    finalProductImages: string[];
    activeStages: string[];
    currentStage: string;
    status: OrderStatus;
    assignedStaff: AssignedStaff;
    materialsCostPlanned: number | null;
    changeHistory: ChangeHistoryEntry[];
    billing?: OrderBilling;
    plannedMaterials?: OrderPlannedMaterials | null;
    materials?: OrderMaterials;
    // Financial fields
    price?: number;
    advanceAmount?: number;
    labourCost?: number;
    materialCost?: number;
    extraExpenses?: number;
    deliveredAt?: Timestamp;
    designNotes?: string;
    clothType?: string;
    // Multi-item fields
    items?: OrderItem[];         // Array of items in this order
    totalItems?: number;         // Computed: items.length
    completedItems?: number;     // Computed: items where status = "ready" or "delivered"
    overallStatus?: OverallOrderStatus;  // Computed from item statuses
    // RE Work workflow
    includeREWork?: boolean;     // For RE categories - includes RE Work stage

    // Embedded Marking Tasks (Parallel Workflow)
    markingTasks?: MarkingTaskMap;
}

export interface SubTask {
    taskId: string;          // e.g. "front_neck"
    taskName: string;        // e.g. "Front Neck"
    status: "not_started" | "in_progress" | "completed" | "approved" | "needs_rework";
    assignedStaffId?: string;
    assignedStaffName?: string;
    completedAt?: Timestamp;
    approvedAt?: Timestamp;
    approvedBy?: string;
    approvedByName?: string;
    notes?: string;
    isMandatory: boolean;
    taskOrder: number;
}

export type MarkingTaskMap = Record<string, SubTask>;

export interface TimelineEntry {
    staffId: string;
    role: string;
    stage: string;
    subStage?: string;
    action: "started" | "completed" | "checked_ok" | "checked_reject";
    timestamp: Timestamp;
}

// Customer Profile (for grouping orders by phone number)
export interface Customer {
    phoneNumber: string;         // Primary key - unique identifier
    name: string;                // Customer name
    address?: string;            // Optional address
    totalOrders: number;         // Count of all orders
    activeOrders: number;        // Count of non-delivered orders
    deliveredOrders: number;     // Count of delivered orders
    totalRevenue: number;        // Sum of all order prices
    totalExpenses: number;       // Sum of labour + material costs
    totalProfit: number;         // Revenue - Expenses
    orderIds: string[];          // Array of order IDs
    lastOrderDate: Timestamp;    // Most recent order date
    createdAt: Timestamp;        // First order date
    updatedAt: Timestamp;        // Last update timestamp
}

export interface StaffWorkLog {
    staffId: string;
    firebaseUid: string;
    email: string;
    role: string;
    orderId: string;
    stage: string;
    subStage?: string;
    action: "completed" | "checked_ok" | "checked_reject";
    timestamp: Timestamp;
}

export interface StaffPayment {
    staffId: string;
    role: string;
    amount: number;
    type: "payment" | "advance" | "deduction";
    date: Timestamp;
    notes?: string;
    relatedOrderId?: string;
    createdByAdminUid: string;
}

export interface StageDefaults {
    materialsDefaultStaffId?: string;
    markingDefaultStaffId?: string;
    cuttingDefaultStaffId?: string;
    stitchingDefaultStaffId?: string;
    hooksDefaultStaffId?: string;
    ironingDefaultStaffId?: string;
    billingDefaultStaffId?: string;
}

// Measurement fields by garment type - matching real tailoring practices
export const MEASUREMENT_FIELDS: Record<GarmentType, string[]> = {
    blouse: [
        "blouseLength",      // BL
        "frontLength",       // FL
        "backNeck",          // BN
        "frontNeck",         // FN
        "chest",             // Chest
        "hip",               // Hip
        "sleeveLength",      // SL
        "sleeveAround",      // SA
        "armHole",           // ARM H
        "pk",                // PK
    ],
    chudi: [
        "topLength",         // Top Length
        "upperChest",        // Upper Chest
        "chest",             // Chest
        "hip",               // Hip
        "seat",              // Seat
        "backNeck",          // Back Neck
        "frontNeck",         // Front Neck
        "sleeveLength",      // Sleeve Length
        "sleeveAround",      // Sleeve Around
        "arm",               // Arm
        "pantLength",        // Pant Length
        "legAround",         // Leg Around
        "pk",                // PK
    ],
    frock: [
        "frockFullLength",   // Frock Full Length
        "frontHeight",       // Front Height
        "frontLoose",        // Front Loose
        "chest",             // Chest
        "backNeck",          // Back Neck
        "frontNeck",         // Front Neck
        "arm",               // Arm
        "sleeveLength",      // Sleeve Length
        "sleeveLoose",       // Sleeve Loose
        "pk",                // PK
    ],
    pavadai_sattai: [
        "pavadaiFullLength", // Pavadai Full Length
        "hipLoose",          // Hip Loose
        "bodyPavadaiLength", // Body Pavadai Length
        "sattaiHeight",      // Sattai Height
        "sattaiLoose",       // Sattai Loose
        "hip",               // Hip
        "chest",             // Chest
        "backNeck",          // Back Neck
        "frontNeck",         // Front Neck
        "arm",               // Arm
        "sleeveLength",      // Sleeve Length
        "sleeveLoose",       // Sleeve Loose
        "pk",                // PK
    ],
    re_blouse: [
        // RE Blouse uses same measurements as regular blouse
        "blouseLength",      // BL
        "frontLength",       // FL
        "backNeck",          // BN
        "frontNeck",         // FN
        "chest",             // Chest
        "hip",               // Hip
        "sleeveLength",      // SL
        "sleeveAround",      // SA
        "armHole",           // ARM H
        "pk",                // PK
    ],
    re_pavada_sattai: [
        // RE Pavada Sattai uses same measurements as regular pavadai_sattai
        "pavadaiFullLength", // Pavadai Full Length
        "hipLoose",          // Hip Loose
        "bodyPavadaiLength", // Body Pavadai Length
        "sattaiHeight",      // Sattai Height
        "sattaiLoose",       // Sattai Loose
        "hip",               // Hip
        "chest",             // Chest
        "backNeck",          // Back Neck
        "frontNeck",         // Front Neck
        "arm",               // Arm
        "sleeveLength",      // Sleeve Length
        "sleeveLoose",       // Sleeve Loose
        "pk",                // PK
    ],
    other: ["customField1", "customField2", "customField3"],
};

// Human-readable labels for measurement fields
export const MEASUREMENT_LABELS: Record<string, string> = {
    // Blouse measurements
    blouseLength: "Blouse Length (BL)",
    frontLength: "Front Length (FL)",
    backNeck: "Back Neck (BN)",
    frontNeck: "Front Neck (FN)",
    chest: "Chest",
    hip: "Hip",
    sleeveLength: "Sleeve Length (SL)",
    sleeveAround: "Sleeve Around (SA)",
    armHole: "Arm Hole (ARM H)",
    pk: "PK",

    // Chudi measurements
    topLength: "Top Length",
    upperChest: "Upper Chest",
    seat: "Seat",
    arm: "Arm",
    pantLength: "Pant Length",
    legAround: "Leg Around",

    // Frock measurements
    frockFullLength: "Frock Full Length",
    frontHeight: "Front Height",
    frontLoose: "Front Loose",
    sleeveLoose: "Sleeve Loose",

    // Pavadai/Sattai measurements
    pavadaiFullLength: "Pavadai Full Length",
    hipLoose: "Hip Loose",
    bodyPavadaiLength: "Body Pavadai Length",
    sattaiHeight: "Sattai Height",
    sattaiLoose: "Sattai Loose",

    // Generic/Other
    customField1: "Custom Field 1",
    customField2: "Custom Field 2",
    customField3: "Custom Field 3",
};

// Stage names for routing and display
export const STAGES = {
    INTAKE: "intake",
    MATERIALS: "materials",
    MARKING: "marking",
    MARKING_CHECK: "marking_checker",
    CUTTING: "cutting",
    CUTTING_CHECK: "cutting_checker",
    STITCHING: "stitching",
    STITCHING_CHECK: "stitching_checker",
    HOOKS: "hooks",
    IRONING: "ironing",
    BILLING: "billing",
    DELIVERY: "delivery",
} as const;

export const STAGE_DISPLAY_NAMES: Record<string, string> = {
    intake: "Intake",
    materials: "Materials",
    marking: "Marking",
    marking_checker: "Marking Check",
    cutting: "Cutting",
    cutting_checker: "Cutting Check",
    stitching: "Stitching",
    stitching_checker: "Stitching Check",
    hooks: "Hooks & Finishing",
    ironing: "Ironing",
    billing: "Billing",
    delivery: "Delivery",
};
