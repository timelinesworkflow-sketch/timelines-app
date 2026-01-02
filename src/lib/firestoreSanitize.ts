/**
 * Firestore Sanitization Utilities
 * 
 * CRITICAL: Firestore does NOT allow undefined values.
 * This utility ensures all data is safe for Firestore writes.
 */

/**
 * Recursively removes undefined values from an object, replacing with null
 * This ensures Firestore writes never fail due to undefined values
 */
export function sanitizeForFirestore<T extends Record<string, unknown>>(
    obj: T
): T {
    const result: Record<string, unknown> = {};

    for (const key of Object.keys(obj)) {
        const value = obj[key];

        // Replace undefined with null
        if (value === undefined) {
            result[key] = null;
            continue;
        }

        // Recursively sanitize nested objects (but not arrays, Timestamps, or Date)
        if (
            value !== null &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            !(value instanceof Date) &&
            !("toMillis" in value) // Firestore Timestamp check
        ) {
            result[key] = sanitizeForFirestore(value as Record<string, unknown>);
            continue;
        }

        // Sanitize arrays
        if (Array.isArray(value)) {
            result[key] = value.map((item) => {
                if (item === undefined) return null;
                if (
                    item !== null &&
                    typeof item === "object" &&
                    !(item instanceof Date) &&
                    !("toMillis" in item)
                ) {
                    return sanitizeForFirestore(item as Record<string, unknown>);
                }
                return item;
            });
            continue;
        }

        // Keep other values as-is
        result[key] = value;
    }

    return result as T;
}

/**
 * Strips all undefined values from object (for cleaner Firestore updates)
 * Use this when you want to remove undefined completely rather than convert to null
 */
export function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
    const result: Record<string, unknown> = {};

    for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (value !== undefined) {
            result[key] = value;
        }
    }

    return result as Partial<T>;
}

/**
 * Ensure numeric fields are properly initialized
 * Returns null for empty/undefined, or the number value
 */
export function sanitizeNumeric(value: unknown): number | null {
    if (value === undefined || value === null || value === "") {
        return null;
    }
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (typeof num === "number" && !isNaN(num)) {
        return num;
    }
    return null;
}

/**
 * Calculate payment status based on balance
 * This is the single source of truth for payment status
 */
export function getPaymentStatus(
    totalAmount: number,
    paidAmount: number
): "pending" | "partially_paid" | "paid" {
    const balance = totalAmount - paidAmount;
    if (balance <= 0) return "paid";
    if (paidAmount > 0) return "partially_paid";
    return "pending";
}

/**
 * Ensure an order has all required fields with proper defaults
 * Use this when loading orders to guarantee data availability
 */
export function ensureOrderDefaults<T extends Record<string, unknown>>(order: T): T {
    return {
        ...order,
        // Core fields with safe defaults
        orderId: order.orderId || "",
        customerName: order.customerName || "Unknown",
        customerPhone: order.customerPhone || "",
        customerAddress: order.customerAddress || "",
        garmentType: order.garmentType || "blouse",
        measurements: order.measurements || {},
        samplerImages: order.samplerImages || [],
        finalProductImages: order.finalProductImages || [],
        activeStages: order.activeStages || [],
        currentStage: order.currentStage || "intake",
        status: order.status || "draft",
        assignedStaff: order.assignedStaff || {},
        changeHistory: order.changeHistory || [],
        // Numeric fields - use null, not 0
        materialsCostPlanned: order.materialsCostPlanned ?? null,
        price: order.price ?? null,
        advanceAmount: order.advanceAmount ?? null,
        labourCost: order.labourCost ?? null,
        materialCost: order.materialCost ?? null,
        extraExpenses: order.extraExpenses ?? null,
    };
}
