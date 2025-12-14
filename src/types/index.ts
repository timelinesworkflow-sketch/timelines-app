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

// Material Categories
export type MaterialCategory =
    | "fabric"
    | "thread"
    | "button"
    | "zipper"
    | "lining"
    | "elastic"
    | "hook"
    | "lace"
    | "other";

export const MATERIAL_CATEGORIES: { value: MaterialCategory; label: string }[] = [
    { value: "fabric", label: "Fabric" },
    { value: "thread", label: "Thread" },
    { value: "button", label: "Button" },
    { value: "zipper", label: "Zipper" },
    { value: "lining", label: "Lining" },
    { value: "elastic", label: "Elastic" },
    { value: "hook", label: "Hook" },
    { value: "lace", label: "Lace" },
    { value: "other", label: "Other" },
];

// Corrected Material Interface for centralized materials collection
export interface Material {
    materialId: string;
    materialName: string;
    materialCategory: MaterialCategory;
    colour: string;
    quantity: number;                    // Number of items or rolls
    meter: number;                        // Length per quantity (physical length ONLY)
    totalLength: number;                  // Calculated: quantity × meter
    costPerMeter: number;                 // Currency only (₹)
    totalMaterialCost: number;            // Calculated: totalLength × costPerMeter
    laborStaffId: string;                 // Auto-filled from logged-in user (NOT editable)
    laborStaffName: string;               // Auto-filled from logged-in user (NOT editable)
    linkedOrderId: string;                // Order this material is used for
    createdAt: Timestamp;
    updatedAt?: Timestamp;
}

// Legacy MaterialItem for backward compatibility (order-level materials)
export interface MaterialItem {
    particular: string;
    quantity: number;
    colour: string;
    meter: number;                        // Length (NOT cost)
    costPerMeter: number;                 // Cost per meter (₹)
    totalLength: number;                  // Calculated: quantity × meter
    totalCost: number;                    // Calculated: totalLength × costPerMeter
    laborStaffId: string;                 // Auto-filled
    laborStaffName: string;               // Auto-filled
}

export interface OrderMaterials {
    items: MaterialItem[];
    totalCost: number;
    totalLength: number;
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
    materials?: OrderMaterials;
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
