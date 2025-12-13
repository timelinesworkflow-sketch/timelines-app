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

// Measurement fields by garment type
export const MEASUREMENT_FIELDS: Record<GarmentType, string[]> = {
    blouse: [
        "frontLength",
        "backLength",
        "chest",
        "hip",
        "sleeveLength",
        "arm",
        "frontNeckDepth",
        "backNeckDepth",
        "shoulderWidth",
    ],
    chudi: [
        "topLength",
        "chest",
        "waist",
        "hip",
        "sleeveLength",
        "salwarLength",
        "salwarBottom",
    ],
    frock: [
        "length",
        "chest",
        "waist",
        "hip",
        "sleeveLength",
        "arm",
        "neckDepth",
    ],
    pavadai_sattai: [
        "blouseLength",
        "chest",
        "sleeveLength",
        "pavadaiLength",
        "waist",
        "pavadaiBottom",
    ],
    other: ["customField1", "customField2", "customField3"],
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
