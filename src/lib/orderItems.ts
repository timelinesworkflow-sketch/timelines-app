/**
 * Multi-Item Order Helper Functions
 * Handles item-level operations and order status computation
 */

import { db } from "./firebase";
import { doc, updateDoc, Timestamp, collection, addDoc, getDocs, query, where, orderBy, setDoc } from "firebase/firestore";
import { Order, OrderItem, ItemStatus, OverallOrderStatus, ItemTimelineEntry, GarmentType, WorkflowStage, AssignedStaff, createDefaultDesignSections } from "@/types";
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
export function getNextWorkflowStage(item: OrderItem): WorkflowStage | null {
    const currentIndex = WORKFLOW_STAGES.indexOf(item.currentStage);
    if (currentIndex === -1 || currentIndex >= WORKFLOW_STAGES.length - 1) {
        return null;
    }

    let nextStage = WORKFLOW_STAGES[currentIndex + 1];

    // Conditional Stage Logic: Aari Work
    if (nextStage === "aari_work") {
        // Check if garment type is Aari-related
        const isAariGarment = item.garmentType === "aari_blouse" ||
            item.garmentType === "aari_pavada_sattai" ||
            item.garmentType === "aari_pavadai_sattai" as any; // Type hack if needed or ensure type consistency

        if (!isAariGarment) {
            // Skip Aari Work for non-Aari garments
            // Find appropriate next stage (usually stitching triggers after aari)
            const aariIndex = WORKFLOW_STAGES.indexOf("aari_work");
            if (aariIndex !== -1 && currentIndex + 1 === aariIndex) {
                nextStage = WORKFLOW_STAGES[aariIndex + 1];
            }
        }
    }

    return nextStage || "completed";
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
        designSections: createDefaultDesignSections(), // Initialize with Front/Back/Sleeve
        designNotes: "",
        materialCost: 0,
        labourCost: 0,
        currentStage: "intake",
        status: "intake",
        handledBy: "",
        handledByName: "",
        dueDate: Timestamp.now(),
        timeline: [],
        itemPricing: {
            pricingRows: [
                { materialName: garmentType ? (garmentType.replace(/_/g, " ").toUpperCase()) : "GARMENT", quantity: "", unit: "packet", ratePerUnit: 0, rowTotal: 0, isDefault: true },
                { materialName: "Lining", quantity: "", unit: "meter", ratePerUnit: 0, rowTotal: 0, isDefault: true },
                { materialName: "Sari", quantity: "", unit: "packet", ratePerUnit: 0, rowTotal: 0, isDefault: true },
                { materialName: "Zigzag", quantity: "", unit: "packet", ratePerUnit: 0, rowTotal: 0, isDefault: true },
                { materialName: "False", quantity: "", unit: "packet", ratePerUnit: 0, rowTotal: 0, isDefault: true },
                { materialName: "Others", quantity: "", unit: "packet", ratePerUnit: 0, rowTotal: 0, isDefault: true },
            ],
            itemEstimatedTotal: 0,
            pricingConfirmed: false,
        }
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
 * Get all items for a specific order
 */
export async function getItemsForOrder(orderId: string): Promise<OrderItem[]> {
    const itemsRef = collection(db, "orderItems");
    const q = query(
        itemsRef,
        where("orderId", "==", orderId)
    );
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(doc => ({
        ...doc.data() as OrderItem,
        itemId: doc.id // Ensure ID is present
    }));

    // Sort by name or creation? Let's use name if available, else date
    return items.sort((a, b) => (a.itemName || "").localeCompare(b.itemName || ""));
}

/**
 * Update an item with generic fields
 */
export async function updateItem(itemId: string, updates: Partial<OrderItem>): Promise<void> {
    const itemRef = doc(db, "orderItems", itemId);
    const sanitizedUpdates = sanitizeForFirestore(updates as any);

    // Ensure updatedAt is set
    sanitizedUpdates.updatedAt = Timestamp.now();

    await updateDoc(itemRef, sanitizedUpdates);
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

    // We need to append to timeline. 
    // Using arrayUnion is safer for concurrency but requires exact object match which includes timestamp.
    // Ideally we use a transaction or just read-modify-write.
    // For now, since we need to read the current timeline to append correctly:

    // Use getDoc because the ID is the key
    const { getDoc } = await import("firebase/firestore"); // Dynamic import or assume it's imported (it is not in current imports list fully)
    // Actually getDocs is imported, but getDoc is not imported in the file currently (checking imports).
    // The imports are: doc, updateDoc, Timestamp, collection, addDoc, getDocs, query, where, orderBy, setDoc
    // Missing: getDoc.
    // So I will update imports first or use getDocs with ID query if I must, but doc() reference is available.
    // I can just import getDoc at the top.
    // But since I am replacing this block, I can't easily add top-level imports.
    // I will use updateDoc with arrayUnion if I can trust it, but without getDoc I can't read old timeline.
    // Actually, I can use runTransaction if I import it.

    // For now, I will use getDocs with generic query or assume I can add getDoc to imports in a separate step?
    // No, I'll just use getDocs(query(collection(db, "orderItems"), where("__name__", "==", itemId))) or similar.
    // Or just use the existing inefficient query for now but fix the logic.
    // But wait, the existing code used getDocs with where("itemId" == itemId). This assumes itemId field exists.
    // My createOrderItems sets itemId field. So it works.

    const itemQuery = query(collection(db, "orderItems"), where("itemId", "==", itemId));
    const snapshot = await getDocs(itemQuery);

    if (snapshot.empty) return;

    const docSnap = snapshot.docs[0];
    const currentItem = docSnap.data() as OrderItem;

    const timelineEntry: ItemTimelineEntry = {
        stage: currentItem.currentStage, // Log completion of *current* stage
        completedBy: staffId,
        completedByName: staffName,
        completedAt: Timestamp.now()
    };

    const newTimeline = [...(currentItem.timeline || []), timelineEntry];

    await updateDoc(docSnap.ref, {
        currentStage: newStage,
        status: newStatus,
        timeline: newTimeline,
        updatedAt: Timestamp.now(),
        handledBy: staffId,
        handledByName: staffName
    });
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

/**
 * Aggregate item-level pricing into order-level summary
 */
export function calculateOrderPricingSummary(items: OrderItem[]): {
    materials: { name: string; quantity: number; total: number }[];
    overallTotal: number;
} {
    const materialMap: Record<string, { quantity: number; total: number }> = {};
    let overallTotal = 0;

    items.forEach(item => {
        if (item.itemPricing) {
            overallTotal += item.itemPricing.itemEstimatedTotal || 0;
            item.itemPricing.pricingRows.forEach(m => {
                const key = m.materialName;
                if (!materialMap[key]) {
                    materialMap[key] = { quantity: 0, total: 0 };
                }
                const q = (Number(m.quantity) || 0);
                const t = (Number(m.rowTotal) || 0);
                materialMap[key].quantity += q;
                materialMap[key].total += t;
            });
        }
    });

    const materials = Object.entries(materialMap).map(([name, data]) => ({
        name,
        quantity: data.quantity,
        total: data.total
    })).filter(m => m.quantity > 0 || m.total > 0);

    return {
        materials,
        overallTotal
    };
}

