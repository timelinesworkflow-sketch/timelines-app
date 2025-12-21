/**
 * Multi-Item Order Helper Functions
 * Handles item-level operations and order status computation
 */

import { db } from "./firebase";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { Order, OrderItem, ItemStatus, OverallOrderStatus, ItemTimelineEntry, GarmentType } from "@/types";

// Item workflow stages in order
export const ITEM_STAGES: ItemStatus[] = [
    "intake",
    "cutting",
    "stitching",
    "finishing",
    "qc",
    "ready",
    "delivered"
];

/**
 * Get the next stage for an item
 */
export function getNextItemStage(currentStage: ItemStatus): ItemStatus | null {
    const currentIndex = ITEM_STAGES.indexOf(currentStage);
    if (currentIndex === -1 || currentIndex >= ITEM_STAGES.length - 1) {
        return null;
    }
    return ITEM_STAGES[currentIndex + 1];
}

/**
 * Create a new empty order item
 * Note: deadline is undefined by default to avoid calling Timestamp.now() during module initialization
 */
export function createEmptyItem(itemNumber: number, garmentType?: GarmentType): Partial<OrderItem> {
    return {
        itemId: `ITEM_${Date.now()}_${itemNumber}`,
        itemName: "",
        quantity: 1,
        measurements: {},
        designNotes: "",
        referenceImages: [],
        materialCost: 0,
        labourCost: 0,
        // deadline is set when the order is actually created
        status: "intake",
        handledBy: "",
        handledByName: "",
        timeline: [],
        garmentType: garmentType,
    };
}

/**
 * Compute order-level status from items
 */
export function computeOverallStatus(items: OrderItem[]): {
    totalItems: number;
    completedItems: number;
    overallStatus: OverallOrderStatus;
} {
    if (!items || items.length === 0) {
        return {
            totalItems: 0,
            completedItems: 0,
            overallStatus: "inProgress"
        };
    }

    const totalItems = items.length;
    const completedItems = items.filter(item =>
        item.status === "ready" || item.status === "delivered"
    ).length;
    const deliveredItems = items.filter(item => item.status === "delivered").length;

    let overallStatus: OverallOrderStatus;

    if (deliveredItems === totalItems) {
        overallStatus = "delivered";
    } else if (completedItems === totalItems) {
        overallStatus = "completed";
    } else if (completedItems > 0) {
        overallStatus = "partial";
    } else {
        overallStatus = "inProgress";
    }

    return { totalItems, completedItems, overallStatus };
}

/**
 * Format order status for display (e.g., "In Progress (0/4 Completed)")
 */
export function formatOrderProgress(order: Order): string {
    const items = order.items || [];
    const { totalItems, completedItems, overallStatus } = computeOverallStatus(items);

    if (totalItems === 0) {
        // Legacy order without items
        return order.status.replace(/_/g, " ");
    }

    switch (overallStatus) {
        case "delivered":
            return `Delivered (${totalItems}/${totalItems})`;
        case "completed":
            return `Completed (${completedItems}/${totalItems})`;
        case "partial":
            return `Partially Completed (${completedItems}/${totalItems})`;
        case "inProgress":
        default:
            return `In Progress (${completedItems}/${totalItems} Completed)`;
    }
}

/**
 * Update an item's status in an order
 */
export async function updateItemStatus(
    orderId: string,
    itemId: string,
    newStatus: ItemStatus,
    staffId: string,
    staffName: string
): Promise<void> {
    const orderRef = doc(db, "orders", orderId);

    // We need to fetch and update the items array
    // This is done in the component that calls this function
    // Here we just prepare the timeline entry
}

/**
 * Create a timeline entry for an item
 */
export function createTimelineEntry(
    stage: string,
    staffId: string,
    staffName: string
): ItemTimelineEntry {
    return {
        stage,
        completedBy: staffId,
        completedByName: staffName,
        completedAt: Timestamp.now(),
    };
}

/**
 * Update order with new item statuses and recompute overall status
 */
export async function updateOrderItems(
    orderId: string,
    items: OrderItem[]
): Promise<void> {
    const { totalItems, completedItems, overallStatus } = computeOverallStatus(items);

    const orderRef = doc(db, "orders", orderId);
    await updateDoc(orderRef, {
        items,
        totalItems,
        completedItems,
        overallStatus,
        updatedAt: Timestamp.now(),
    });
}

/**
 * Move an item to the next stage
 */
export function moveItemToNextStage(
    item: OrderItem,
    staffId: string,
    staffName: string
): OrderItem | null {
    const nextStage = getNextItemStage(item.status);
    if (!nextStage) {
        return null; // Already at final stage
    }

    const timelineEntry = createTimelineEntry(item.status, staffId, staffName);

    return {
        ...item,
        status: nextStage,
        handledBy: staffId,
        handledByName: staffName,
        timeline: [...item.timeline, timelineEntry],
    };
}

/**
 * Get items that are at a specific stage
 */
export function getItemsAtStage(items: OrderItem[], stage: ItemStatus): OrderItem[] {
    return items.filter(item => item.status === stage);
}

/**
 * Calculate total costs from items
 */
export function calculateItemsTotals(items: OrderItem[]): {
    totalMaterialCost: number;
    totalLabourCost: number;
    totalQuantity: number;
} {
    return items.reduce((acc, item) => ({
        totalMaterialCost: acc.totalMaterialCost + (item.materialCost || 0),
        totalLabourCost: acc.totalLabourCost + (item.labourCost || 0),
        totalQuantity: acc.totalQuantity + (item.quantity || 1),
    }), {
        totalMaterialCost: 0,
        totalLabourCost: 0,
        totalQuantity: 0,
    });
}
