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
    | "stitching"
    | "stitching_checker"
    | "hooks"
    | "ironing"
    | "billing"
    | "delivery";

export interface User {
    email: string;
    staffId: string;
    name: string;
    role: UserRole;
    allowedStages: string[];
    isActive: boolean;
    createdAt: Timestamp;
}

export type GarmentType = "blouse" | "chudi" | "frock" | "pavadai_sattai" | "other";

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

export interface OrderBilling {
    markingCharges: number;
    cuttingCharges: number;
    stitchingCharges: number;
    hooksCharges: number;
    ironingCharges: number;
    extraWorkCharges: number;
    materialsCost: number;
    totalAmount: number;
    discountEnabled: boolean;
    discountAmount: number;
    finalAmount: number;
    amountReceived: number;
    balance: number;
    paymentStatus: "paid" | "partially_paid" | "not_paid";
    paymentMode: "cash" | "upi" | "card" | "other";
    billedByStaffId: string;
    billedAt: Timestamp;
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

// Planned Material (at Intake Stage - PLANNING ONLY, no inventory reduction)
export interface PlannedMaterial {
    materialId: string;          // Material ID / Lining ID
    materialName: string;        // Material Name
    category: string;            // Free text category (NOT dropdown)
    quantity: number;            // Quantity required
    meter: number;               // Meter (length per quantity)
    totalLength: number;         // Calculated: quantity × meter
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
    plannedMaterials?: OrderPlannedMaterials;  // Materials planned at intake (no inventory reduction)
    materials?: OrderMaterials;                 // Materials used (after materials stage completion)
}

export interface TimelineEntry {
    staffId: string;
    role: string;
    stage: string;
    subStage?: string;
    action: "started" | "completed" | "checked_ok" | "checked_reject";
    timestamp: Timestamp;
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
