/**
 * Privacy Controls for Role-Based Data Visibility
 * Determines what data each role can see
 */

import { UserRole, Order } from "@/types";

// Roles that can see customer information (name, phone)
const CUSTOMER_VISIBLE_ROLES: UserRole[] = [
    "admin",
    "supervisor",
    "intake",
    "billing",
    "delivery",
];

// Roles that should NOT see customer information
const INTERNAL_STAFF_ROLES: UserRole[] = [
    "materials",
    "marking",
    "marking_checker",
    "cutting",
    "cutting_checker",
    "stitching",
    "stitching_checker",
    "hooks",
    "ironing",
];

/**
 * Check if a role can view customer information
 */
export function canViewCustomerInfo(role: UserRole): boolean {
    return CUSTOMER_VISIBLE_ROLES.includes(role);
}

/**
 * Check if a role is internal staff (cannot see customer info)
 */
export function isInternalStaff(role: UserRole): boolean {
    return INTERNAL_STAFF_ROLES.includes(role);
}

/**
 * Filter order data based on role privacy rules
 * Returns a sanitized version of the order for internal staff
 */
export function getPrivacyFilteredOrder(order: Order, role: UserRole): Partial<Order> {
    if (canViewCustomerInfo(role)) {
        // Return full order data for privileged roles
        return order;
    }

    // For internal staff, hide customer information
    return {
        orderId: order.orderId,
        garmentType: order.garmentType,
        measurements: order.measurements,
        dueDate: order.dueDate,
        createdAt: order.createdAt,
        samplerImages: order.samplerImages,
        currentStage: order.currentStage,
        status: order.status,
        assignedStaff: order.assignedStaff,
        plannedMaterials: order.plannedMaterials,
        designNotes: order.designNotes,
        items: order.items,
        totalItems: order.totalItems,
        completedItems: order.completedItems,
        overallStatus: order.overallStatus,
        // Explicitly exclude:
        // - customerName
        // - customerPhone
        // - customerAddress
        // - customerId
    };
}

/**
 * Get display name for customer based on role
 */
export function getCustomerDisplayName(order: Order, role: UserRole): string {
    if (canViewCustomerInfo(role)) {
        return order.customerName;
    }
    return `Order #${order.orderId.slice(0, 8)}`;
}

/**
 * Get display phone for customer based on role
 */
export function getCustomerDisplayPhone(order: Order, role: UserRole): string | null {
    if (canViewCustomerInfo(role)) {
        return order.customerPhone;
    }
    return null;
}
