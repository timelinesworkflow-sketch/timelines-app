/**
 * Multi-Item Order Helper Functions
 * Handles item-level operations and order status computation
 */

import { db } from "./firebase";
import { doc, updateDoc, Timestamp, collection, addDoc, getDocs, query, where, orderBy, setDoc } from "firebase/firestore";
import { Order, OrderItem, ItemStatus, OverallOrderStatus, ItemTimelineEntry, GarmentType, WorkflowStage, AssignedStaff } from "@/types";
import { sanitizeForFirestore } from "./firestoreSanitize";

// Item workflow stages in order
export const WORKFLOW_STAGES: WorkflowStage[] = [
    "intake",
    "materials",
    "marking",
    "marking_checker",
    "cutting",
    "cutting_checker",
    "aari_work",
    "stitching",
    "stitching_checker",
    "hooks",
    "ironing",
    "billing",
    "delivery",
    "completed"
];

/**
 * Get the next stage for an item based on its workflow
 */
export function getNextWorkflowStage(currentStage: WorkflowStage, activeStages?: string[]): WorkflowStage | null {
    const currentIndex = WORKFLOW_STAGES.indexOf(currentStage);
    if (currentIndex === -1 || currentIndex >= WORKFLOW_STAGES.length - 1) {
        return null;
    }

    // If activeStages is provided, find the next stage that is active
    if (activeStages && activeStages.length > 0) {
        for (let i = currentIndex + 1; i < WORKFLOW_STAGES.length; i++) {
            const stage = WORKFLOW_STAGES[i];
            // Always include mandatory stages or checked stages
            if (activeStages.includes(stage) || stage === 'completed' || stage === 'delivery' || stage === 'billing') {
                return stage;
            }
        }
        return "completed";
    }

    return WORKFLOW_STAGES[currentIndex + 1];
}


/**
 * Create a new empty order item
 */
export function createEmptyItem(itemNumber: number, garmentType?: GarmentType): Partial<OrderItem> {
    return {
        itemId: `ITEM_${Date.now()}_${itemNumber}`,
        itemName: "",
        quantity: 1,
        garmentType: garmentType || "blouse",
        measurementType: "measurements", // Default to manual measurements
        measurements: {},
        referenceImages: [],
        designNotes: "",
        materialCost: 0,
        labourCost: 0,
        currentStage: "intake",
        status: "intake",
        handledBy: "",
        handledByName: "",
        timeline: [],
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
        item.status === "completed" || item.status === "delivered"
    ).length;

    // Delivered count
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
 * Create new OrderItem documents in Firestore
 */
export async function createOrderItems(orderId: string, items: OrderItem[]): Promise<void> {
    const batch = []; // In a real app we'd use a write batch, but for simplicity/safety with mixed ops we iterate
    // Actually, let's just use parallel promises

    const promises = items.map(async (item) => {
        const itemRef = doc(db, "orderItems", item.itemId);
        // Ensure critical fields are set
        const itemData: OrderItem = {
            ...item,
            orderId,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };
        await setDoc(itemRef, sanitizeForFirestore(itemData as any));
    });

    await Promise.all(promises);
}

/**
 * Copy of getOrdersForStage but for ITEMS
 */
export async function getItemsForStage(
    stage: string,
    staffId?: string
): Promise<OrderItem[]> {
    const itemsRef = collection(db, "orderItems");
    let q = query(
        itemsRef,
        where("currentStage", "==", stage),
        // orderBy("dueDate", "asc") // Requires composite index, careful
    );

    // If not "completed", filter out delivered/completed status if overlap
    if (stage !== "completed" && stage !== "delivery") {
        // Usually we trust currentStage property
    }

    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(d => d.data() as OrderItem);

    // Client-side sort by due date to avoid index error during dev
    items.sort((a, b) => {
        const dateA = a.dueDate?.toMillis() || 0;
        const dateB = b.dueDate?.toMillis() || 0;
        return dateA - dateB;
    });

    if (staffId) {
        return items.filter(item => {
            // Check generic assignment or stage specific assignment
            // item.assignedStaff is AssignedStaff object
            if (!item.assignedStaff) return true; // No explicit assignment means open queue
            const assigned = item.assignedStaff[stage as keyof AssignedStaff];
            return !assigned || assigned === staffId;
        });
    }

    return items;
}

/**
 * Update an item's status and stage
 */
export async function updateItemStage(
    itemId: string,
    newStage: WorkflowStage,
    newStatus: ItemStatus,
    staffId: string,
    staffName: string
): Promise<void> {
    const itemRef = doc(db, "orderItems", itemId);

    const timelineEntry: ItemTimelineEntry = {
        stage: newStage,
        completedBy: staffId,
        completedByName: staffName,
        completedAt: Timestamp.now()
    };

    // We can't use arrayUnion easily with complex objects if we want append-only, 
    // but reading first is safer for timeline integrity or just accepting overwrite if concurrent
    // For now simple update:

    // We need to read current timeline to append? Firestore requires reading.
    // Or we store timeline as subcollection? 
    // For now, let's assume we can just update. But `timeline` is array.
    // Let's use arrayUnion if possible, but object equality is tricky.
    // Instead, let's read-modify-write for timeline.

    const itemDoc = await getDocs(query(collection(db, "orderItems"), where("itemId", "==", itemId)));
    if (itemDoc.empty) return;

    const currentItem = itemDoc.docs[0].data() as OrderItem;
    const newTimeline = [...(currentItem.timeline || []), timelineEntry];

    await updateDoc(itemDoc.docs[0].ref, {
        currentStage: newStage,
        status: newStatus,
        timeline: newTimeline,
        updatedAt: Timestamp.now(),
        handledBy: staffId,
        handledByName: staffName
    });

    // Also sync to parent order?
    // This is optional but good for consistency. We can leave it for now.
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

