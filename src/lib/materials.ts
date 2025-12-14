import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    Timestamp,
    DocumentData
} from "firebase/firestore";
import { db } from "./firebase";
import { Material, MaterialCategory } from "@/types";

const MATERIALS_COLLECTION = "materials";

// Create a new material entry
export async function createMaterial(
    materialData: Omit<Material, "materialId" | "createdAt" | "totalLength" | "totalMaterialCost">
): Promise<string> {
    // Auto-calculate derived fields
    const totalLength = materialData.quantity * materialData.meter;
    const totalMaterialCost = totalLength * materialData.costPerMeter;

    const docRef = await addDoc(collection(db, MATERIALS_COLLECTION), {
        ...materialData,
        totalLength,
        totalMaterialCost,
        createdAt: Timestamp.now(),
    });

    // Update with materialId
    await updateDoc(docRef, { materialId: docRef.id });

    return docRef.id;
}

// Update a material entry
export async function updateMaterial(
    materialId: string,
    updates: Partial<Omit<Material, "materialId" | "createdAt" | "laborStaffId" | "laborStaffName">>
): Promise<void> {
    const docRef = doc(db, MATERIALS_COLLECTION, materialId);

    // If quantity or meter is updated, recalculate totals
    const updateData: DocumentData = { ...updates, updatedAt: Timestamp.now() };

    if (updates.quantity !== undefined || updates.meter !== undefined || updates.costPerMeter !== undefined) {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const current = docSnap.data() as Material;
            const quantity = updates.quantity ?? current.quantity;
            const meter = updates.meter ?? current.meter;
            const costPerMeter = updates.costPerMeter ?? current.costPerMeter;

            updateData.totalLength = quantity * meter;
            updateData.totalMaterialCost = updateData.totalLength * costPerMeter;
        }
    }

    await updateDoc(docRef, updateData);
}

// Delete a material entry
export async function deleteMaterial(materialId: string): Promise<void> {
    await deleteDoc(doc(db, MATERIALS_COLLECTION, materialId));
}

// Get all materials (admin view)
export async function getAllMaterials(): Promise<Material[]> {
    const q = query(
        collection(db, MATERIALS_COLLECTION),
        orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Material);
}

// Get materials by staff ID
export async function getMaterialsByStaff(staffId: string): Promise<Material[]> {
    const q = query(
        collection(db, MATERIALS_COLLECTION),
        where("laborStaffId", "==", staffId),
        orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Material);
}

// Get materials by order ID
export async function getMaterialsByOrder(orderId: string): Promise<Material[]> {
    const q = query(
        collection(db, MATERIALS_COLLECTION),
        where("linkedOrderId", "==", orderId),
        orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Material);
}

// Get materials by category
export async function getMaterialsByCategory(category: MaterialCategory): Promise<Material[]> {
    const q = query(
        collection(db, MATERIALS_COLLECTION),
        where("materialCategory", "==", category),
        orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Material);
}

// Get materials within date range
export async function getMaterialsByDateRange(
    startDate: Date,
    endDate: Date
): Promise<Material[]> {
    const q = query(
        collection(db, MATERIALS_COLLECTION),
        where("createdAt", ">=", Timestamp.fromDate(startDate)),
        where("createdAt", "<=", Timestamp.fromDate(endDate)),
        orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Material);
}

// Calculate summary statistics
export interface MaterialsSummary {
    totalMaterialCost: number;
    totalLengthUsed: number;
    mostUsedMaterial: string | null;
    materialCount: number;
    staffWiseUsage: { staffId: string; staffName: string; totalLength: number; totalCost: number }[];
    categoryWiseUsage: { category: MaterialCategory; totalLength: number; totalCost: number }[];
}

export function calculateMaterialsSummary(materials: Material[]): MaterialsSummary {
    const totalMaterialCost = materials.reduce((sum, m) => sum + m.totalMaterialCost, 0);
    const totalLengthUsed = materials.reduce((sum, m) => sum + m.totalLength, 0);

    // Find most used material by length
    const materialUsage: { [name: string]: number } = {};
    materials.forEach(m => {
        materialUsage[m.materialName] = (materialUsage[m.materialName] || 0) + m.totalLength;
    });

    const mostUsedMaterial = Object.keys(materialUsage).length > 0
        ? Object.entries(materialUsage).sort((a, b) => b[1] - a[1])[0][0]
        : null;

    // Staff-wise usage
    const staffUsage: { [staffId: string]: { staffName: string; totalLength: number; totalCost: number } } = {};
    materials.forEach(m => {
        if (!staffUsage[m.laborStaffId]) {
            staffUsage[m.laborStaffId] = { staffName: m.laborStaffName, totalLength: 0, totalCost: 0 };
        }
        staffUsage[m.laborStaffId].totalLength += m.totalLength;
        staffUsage[m.laborStaffId].totalCost += m.totalMaterialCost;
    });

    // Category-wise usage
    const categoryUsage: { [category: string]: { totalLength: number; totalCost: number } } = {};
    materials.forEach(m => {
        if (!categoryUsage[m.materialCategory]) {
            categoryUsage[m.materialCategory] = { totalLength: 0, totalCost: 0 };
        }
        categoryUsage[m.materialCategory].totalLength += m.totalLength;
        categoryUsage[m.materialCategory].totalCost += m.totalMaterialCost;
    });

    return {
        totalMaterialCost,
        totalLengthUsed,
        mostUsedMaterial,
        materialCount: materials.length,
        staffWiseUsage: Object.entries(staffUsage).map(([staffId, data]) => ({
            staffId,
            ...data
        })),
        categoryWiseUsage: Object.entries(categoryUsage).map(([category, data]) => ({
            category: category as MaterialCategory,
            ...data
        })),
    };
}

// Get date ranges for filters
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
