import {
    collection,
    doc,
    addDoc,
    updateDoc,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    Timestamp,
    increment,
    setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import {
    InventoryItem,
    MaterialPurchase,
    MaterialUsage,
    PlannedMaterial,
    PlannedMaterialWithStatus,
    StockStatus,
} from "@/types";

const INVENTORY_COLLECTION = "inventory";
const PURCHASES_COLLECTION = "purchases";
const USAGE_COLLECTION = "material_usage";

// ============================================
// INVENTORY MANAGEMENT
// ============================================

// Get all inventory items
export async function getAllInventory(): Promise<InventoryItem[]> {
    const q = query(
        collection(db, INVENTORY_COLLECTION),
        orderBy("materialName", "asc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as InventoryItem);
}

// Get inventory by material ID
export async function getInventoryByMaterialId(materialId: string): Promise<InventoryItem | null> {
    const q = query(
        collection(db, INVENTORY_COLLECTION),
        where("materialId", "==", materialId)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as InventoryItem;
}

// Get or create inventory item
async function getOrCreateInventory(
    materialId: string,
    materialName: string,
    category: string
): Promise<{ docRef: ReturnType<typeof doc>; existing: InventoryItem | null }> {
    const existing = await getInventoryByMaterialId(materialId);

    if (existing) {
        return {
            docRef: doc(db, INVENTORY_COLLECTION, existing.inventoryId),
            existing,
        };
    }

    // Create new inventory item
    const newInventory: Omit<InventoryItem, "inventoryId"> = {
        materialId,
        materialName,
        category,
        totalBoughtLength: 0,
        totalUsedLength: 0,
        availableLength: 0,
        lastUpdatedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
    };

    const docRef = doc(collection(db, INVENTORY_COLLECTION));
    await setDoc(docRef, { ...newInventory, inventoryId: docRef.id });

    return { docRef, existing: null };
}

// Check stock status for planned materials
export async function checkStockStatus(
    plannedMaterials: PlannedMaterial[]
): Promise<PlannedMaterialWithStatus[]> {
    const inventory = await getAllInventory();
    const inventoryMap = new Map(inventory.map((i) => [i.materialId, i]));

    return plannedMaterials.map((planned) => {
        const stock = inventoryMap.get(planned.materialId);
        const availableLength = stock?.availableLength || 0;
        const requiredLength = planned.measurement;

        let stockStatus: StockStatus;
        let shortageLength = 0;

        if (availableLength >= requiredLength) {
            stockStatus = "in_stock";
        } else if (availableLength > 0) {
            stockStatus = "partial_stock";
            shortageLength = requiredLength - availableLength;
        } else {
            stockStatus = "not_in_stock";
            shortageLength = requiredLength;
        }

        return {
            ...planned,
            stockStatus,
            availableLength,
            shortageLength,
        };
    });
}

// Get low stock items (where available < threshold)
export async function getLowStockItems(thresholdMeters: number = 5): Promise<InventoryItem[]> {
    const inventory = await getAllInventory();
    return inventory.filter((item) => item.availableLength < thresholdMeters);
}

// ============================================
// PURCHASE MANAGEMENT (Adds to Inventory)
// ============================================

// Add a bulk purchase
export async function addPurchase(
    purchaseData: Omit<MaterialPurchase, "purchaseId" | "createdAt" | "totalLength" | "totalCost">
): Promise<string> {
    const totalLength = purchaseData.quantity * purchaseData.meter;
    const totalCost = totalLength * purchaseData.costPerMeter;

    // Create purchase record
    const purchaseRef = doc(collection(db, PURCHASES_COLLECTION));
    const purchase: MaterialPurchase = {
        ...purchaseData,
        purchaseId: purchaseRef.id,
        totalLength,
        totalCost,
        createdAt: Timestamp.now(),
    };
    await setDoc(purchaseRef, purchase);

    // Update inventory
    const { docRef } = await getOrCreateInventory(
        purchaseData.materialId,
        purchaseData.materialName,
        purchaseData.category
    );

    await updateDoc(docRef, {
        totalBoughtLength: increment(totalLength),
        availableLength: increment(totalLength),
        lastUpdatedAt: Timestamp.now(),
        materialName: purchaseData.materialName,
        category: purchaseData.category,
    });

    return purchaseRef.id;
}

// Get all purchases
export async function getAllPurchases(): Promise<MaterialPurchase[]> {
    const q = query(
        collection(db, PURCHASES_COLLECTION),
        orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as MaterialPurchase);
}

// Get purchases by date range
export async function getPurchasesByDateRange(
    startDate: Date,
    endDate: Date
): Promise<MaterialPurchase[]> {
    const q = query(
        collection(db, PURCHASES_COLLECTION),
        where("createdAt", ">=", Timestamp.fromDate(startDate)),
        where("createdAt", "<=", Timestamp.fromDate(endDate)),
        orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as MaterialPurchase);
}

// Simple wrapper for recording a purchase from the Purchase stage
export async function recordMaterialPurchase(data: {
    materialId: string;
    materialName: string;
    category: string;
    quantity: number;
    meter: number;
    costPerMeter: number;
    staffId: string;
    staffName: string;
    uid?: string; // Optional for rules
}): Promise<string> {
    return addPurchase({
        materialId: data.materialId,
        materialName: data.materialName,
        category: data.category,
        quantity: data.quantity,
        meter: data.meter,
        costPerMeter: data.costPerMeter,
        laborStaffId: data.staffId,
        laborStaffName: data.staffName,
        laborStaffUid: data.uid,
    } as any);
}

// ============================================
// USAGE MANAGEMENT (Reduces Inventory)
// ============================================

// Record material usage for an order
export async function recordMaterialUsage(
    usageData: Omit<MaterialUsage, "usageId" | "createdAt" | "totalLength"> & { laborStaffUid?: string }
): Promise<string> {
    const totalLength = usageData.quantity * usageData.meter;

    // Create usage record
    const usageRef = doc(collection(db, USAGE_COLLECTION));
    const usage: MaterialUsage = {
        ...usageData,
        itemId: usageData.itemId, // Explicitly include itemId
        usageId: usageRef.id,
        totalLength,
        createdAt: Timestamp.now(),
    } as any;

    await setDoc(usageRef, usage);

    // Update inventory
    const { docRef } = await getOrCreateInventory(
        usageData.materialId,
        usageData.materialName,
        usageData.category
    );

    await updateDoc(docRef, {
        totalUsedLength: increment(totalLength),
        availableLength: increment(-totalLength),
        lastUpdatedAt: Timestamp.now(),
    });

    return usageRef.id;
}

// Get usage by order ID
export async function getUsageByOrderId(orderId: string): Promise<MaterialUsage[]> {
    const q = query(
        collection(db, USAGE_COLLECTION),
        where("orderId", "==", orderId),
        orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as MaterialUsage);
}

// Get usage by staff ID
export async function getUsageByStaffId(staffId: string): Promise<MaterialUsage[]> {
    const q = query(
        collection(db, USAGE_COLLECTION),
        where("laborStaffId", "==", staffId),
        orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as MaterialUsage);
}

// Get all usage records
export async function getAllUsage(): Promise<MaterialUsage[]> {
    const q = query(
        collection(db, USAGE_COLLECTION),
        orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as MaterialUsage);
}

// ============================================
// ANALYTICS & SUMMARIES
// ============================================

export interface InventorySummary {
    totalItems: number;
    totalBoughtLength: number;
    totalUsedLength: number;
    totalAvailableLength: number;
    lowStockCount: number;
    totalPurchaseValue: number;
}

export async function getInventorySummary(): Promise<InventorySummary> {
    const inventory = await getAllInventory();
    const purchases = await getAllPurchases();

    return {
        totalItems: inventory.length,
        totalBoughtLength: inventory.reduce((sum, i) => sum + i.totalBoughtLength, 0),
        totalUsedLength: inventory.reduce((sum, i) => sum + i.totalUsedLength, 0),
        totalAvailableLength: inventory.reduce((sum, i) => sum + i.availableLength, 0),
        lowStockCount: inventory.filter((i) => i.availableLength < 5).length,
        totalPurchaseValue: purchases.reduce((sum, p) => sum + p.totalCost, 0),
    };
}

export interface StaffUsageSummary {
    staffId: string;
    staffName: string;
    totalLength: number;
    usageCount: number;
}

export async function getStaffUsageSummary(): Promise<StaffUsageSummary[]> {
    const usage = await getAllUsage();
    const staffMap = new Map<string, StaffUsageSummary>();

    usage.forEach((u) => {
        if (!staffMap.has(u.laborStaffId)) {
            staffMap.set(u.laborStaffId, {
                staffId: u.laborStaffId,
                staffName: u.laborStaffName,
                totalLength: 0,
                usageCount: 0,
            });
        }
        const entry = staffMap.get(u.laborStaffId)!;
        entry.totalLength += u.totalLength;
        entry.usageCount += 1;
    });

    return Array.from(staffMap.values());
}

// Date range helpers
export function getDateRanges() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
        today: { start: startOfDay, end: now },
        thisWeek: { start: startOfWeek, end: now },
        thisMonth: { start: startOfMonth, end: now },
    };
}
