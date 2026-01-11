"use strict";
/**
 * Purchase Management System
 * Handles both inventory-based and order-based purchases
 */

import { db } from "./firebase";
import {
    collection,
    doc,
    addDoc,
    updateDoc,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp,
} from "firebase/firestore";
import { PurchaseRequest, PurchaseType, PurchaseStatus, MaterialUnit, UserRole, GarmentType } from "@/types";

const PURCHASES_COLLECTION = "purchases";

/**
 * Create a new purchase request
 */
export async function createPurchaseRequest(data: {
    materialId: string;
    materialName: string;
    colour?: string;
    measurement: number;
    unit: MaterialUnit;
    dueDate: Date;
    requestedByStaffId: string;
    requestedByStaffName: string;
    requestedByRole: UserRole;
    requestedByUid?: string; // Correctly add UID
    purchaseType: PurchaseType;
    sourceStage: "intake" | "materials";
    orderId?: string;
    itemId?: string;
    garmentType?: GarmentType;
}): Promise<string> {
    const purchaseData: Omit<PurchaseRequest, "purchaseId"> = {
        materialId: data.materialId,
        materialName: data.materialName,
        colour: data.colour,
        measurement: data.measurement,
        unit: data.unit,
        dueDate: Timestamp.fromDate(data.dueDate),
        requestedByStaffId: data.requestedByStaffId,
        requestedByStaffName: data.requestedByStaffName,
        requestedByRole: data.requestedByRole,
        requestedByUid: data.requestedByUid, // Save UID
        purchaseType: data.purchaseType,
        sourceStage: data.sourceStage,
        orderId: data.orderId,
        itemId: data.itemId,
        garmentType: data.garmentType,
        status: "pending",
        createdAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, PURCHASES_COLLECTION), purchaseData);

    // Update with purchaseId
    await updateDoc(docRef, { purchaseId: docRef.id });

    return docRef.id;
}

/**
 * Get all pending purchases (sorted by due date)
 */
export async function getPendingPurchases(): Promise<PurchaseRequest[]> {
    // Query without orderBy to avoid composite index requirement
    const q = query(
        collection(db, PURCHASES_COLLECTION),
        where("status", "in", ["pending", "in_progress"])
    );

    const snapshot = await getDocs(q);
    const purchases = snapshot.docs.map(doc => ({
        ...doc.data(),
        purchaseId: doc.id,
    } as PurchaseRequest));

    // Sort client-side by dueDate
    return purchases.sort((a, b) => {
        const aDate = a.dueDate?.toDate?.() || new Date(0);
        const bDate = b.dueDate?.toDate?.() || new Date(0);
        return aDate.getTime() - bDate.getTime();
    });
}

/**
 * Get purchases by type
 */
export async function getPurchasesByType(purchaseType: PurchaseType): Promise<PurchaseRequest[]> {
    const q = query(
        collection(db, PURCHASES_COLLECTION),
        where("purchaseType", "==", purchaseType),
        orderBy("dueDate", "asc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        ...doc.data(),
        purchaseId: doc.id,
    } as PurchaseRequest));
}

/**
 * Get purchases for a specific order
 */
export async function getPurchasesByOrder(orderId: string): Promise<PurchaseRequest[]> {
    const q = query(
        collection(db, PURCHASES_COLLECTION),
        where("orderId", "==", orderId),
        orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        ...doc.data(),
        purchaseId: doc.id,
    } as PurchaseRequest));
}

/**
 * Get all purchases (for admin view)
 */
export async function getAllPurchases(): Promise<PurchaseRequest[]> {
    const q = query(
        collection(db, PURCHASES_COLLECTION),
        orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        ...doc.data(),
        purchaseId: doc.id,
    } as PurchaseRequest));
}

/**
 * Complete a purchase
 * - For inventory purchases: materials are added to inventory
 * - For order purchases: materials are sent to materials stage for that order
 */
export async function completePurchase(
    purchaseId: string,
    completedByStaffId: string,
    completedByStaffName: string
): Promise<void> {
    const purchaseRef = doc(db, PURCHASES_COLLECTION, purchaseId);

    await updateDoc(purchaseRef, {
        status: "completed" as PurchaseStatus,
        completedByStaffId,
        completedByStaffName,
        completedAt: Timestamp.now(),
    });

    // Note: The actual routing to inventory or materials stage 
    // is handled by the calling component after this function completes
}

/**
 * Complete an order-based purchase with actual quantity tracking
 * - Records actual purchased quantity and excess
 * - Excess is auto-added to inventory by the calling component
 */
export async function completePurchaseWithQuantity(
    purchaseId: string,
    completedByStaffId: string,
    completedByStaffName: string,
    actualPurchasedQuantity: number,
    excessQuantity: number
): Promise<void> {
    const purchaseRef = doc(db, PURCHASES_COLLECTION, purchaseId);

    await updateDoc(purchaseRef, {
        status: "completed" as PurchaseStatus,
        completedByStaffId,
        completedByStaffName,
        completedAt: Timestamp.now(),
        actualPurchasedQuantity,
        excessQuantity,
        excessAddedToInventory: excessQuantity > 0,
    });
}

/**
 * Update purchase status
 */
export async function updatePurchaseStatus(
    purchaseId: string,
    status: PurchaseStatus
): Promise<void> {
    const purchaseRef = doc(db, PURCHASES_COLLECTION, purchaseId);
    await updateDoc(purchaseRef, { status });
}

/**
 * Cancel a purchase
 */
export async function cancelPurchase(purchaseId: string): Promise<void> {
    const purchaseRef = doc(db, PURCHASES_COLLECTION, purchaseId);
    await updateDoc(purchaseRef, { status: "cancelled" as PurchaseStatus });
}

/**
 * Get completed purchases for a specific order (for Materials stage)
 */
export async function getCompletedOrderPurchases(orderId: string): Promise<PurchaseRequest[]> {
    // Use simpler query to avoid composite index requirement
    const q = query(
        collection(db, PURCHASES_COLLECTION),
        where("orderId", "==", orderId)
    );

    const snapshot = await getDocs(q);
    const purchases = snapshot.docs
        .map(doc => ({
            ...doc.data(),
            purchaseId: doc.id,
        } as PurchaseRequest))
        .filter(p => p.purchaseType === "order" && p.status === "completed");

    // Sort by completedAt descending
    return purchases.sort((a, b) => {
        const aDate = a.completedAt?.toDate?.() || new Date(0);
        const bDate = b.completedAt?.toDate?.() || new Date(0);
        return bDate.getTime() - aDate.getTime();
    });
}

/**
 * Add leftover purchased material to inventory (Materials staff only)
 * This is a manual action - not automatic
 */
export async function addPurchasedMaterialToInventory(
    purchaseId: string,
    quantity: number,
    staffId: string,
    staffName: string
): Promise<void> {
    const purchaseRef = doc(db, PURCHASES_COLLECTION, purchaseId);

    await updateDoc(purchaseRef, {
        addedToInventory: true,
        addedToInventoryQuantity: quantity,
        addedToInventoryByStaffId: staffId,
        addedToInventoryByStaffName: staffName,
        addedToInventoryAt: Timestamp.now(),
    });
}
