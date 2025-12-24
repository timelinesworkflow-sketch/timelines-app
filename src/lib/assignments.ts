"use client";

import { db } from "@/lib/firebase";
import {
    collection,
    doc,
    setDoc,
    updateDoc,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp,
} from "firebase/firestore";
import { AssignmentAuditLog } from "@/types";

const ASSIGNMENT_LOGS_COLLECTION = "assignmentLogs";

/**
 * Assign an item to a staff member and create audit log
 */
export async function assignItemToStaff(data: {
    orderId: string;
    itemId: string;
    itemIndex: number;
    currentStaffId?: string;
    currentStaffName?: string;
    newStaffId: string;
    newStaffName: string;
    assignedByStaffId: string;
    assignedByStaffName: string;
    assignedByRole: "admin" | "supervisor";
}): Promise<void> {
    const {
        orderId,
        itemId,
        itemIndex,
        currentStaffId,
        currentStaffName,
        newStaffId,
        newStaffName,
        assignedByStaffId,
        assignedByStaffName,
        assignedByRole,
    } = data;

    // Update the order's item with new assignment
    const orderRef = doc(db, "orders", orderId);
    await updateDoc(orderRef, {
        [`items.${itemIndex}.assignedStaffId`]: newStaffId,
        [`items.${itemIndex}.assignedStaffName`]: newStaffName,
    });

    // Create audit log entry
    const logRef = doc(collection(db, ASSIGNMENT_LOGS_COLLECTION));
    const auditLog: AssignmentAuditLog = {
        logId: logRef.id,
        itemId,
        orderId,
        assignedFromStaffId: currentStaffId,
        assignedFromStaffName: currentStaffName,
        assignedToStaffId: newStaffId,
        assignedToStaffName: newStaffName,
        assignedByStaffId,
        assignedByStaffName,
        assignedByRole,
        timestamp: Timestamp.now(),
    };
    await setDoc(logRef, auditLog);
}

/**
 * Bulk assign multiple items to a staff member
 */
export async function bulkAssignItems(assignments: {
    orderId: string;
    itemId: string;
    itemIndex: number;
    currentStaffId?: string;
    currentStaffName?: string;
}[], newStaffId: string, newStaffName: string, assignedBy: {
    staffId: string;
    staffName: string;
    role: "admin" | "supervisor";
}): Promise<number> {
    let successCount = 0;

    for (const assignment of assignments) {
        try {
            await assignItemToStaff({
                orderId: assignment.orderId,
                itemId: assignment.itemId,
                itemIndex: assignment.itemIndex,
                currentStaffId: assignment.currentStaffId,
                currentStaffName: assignment.currentStaffName,
                newStaffId,
                newStaffName,
                assignedByStaffId: assignedBy.staffId,
                assignedByStaffName: assignedBy.staffName,
                assignedByRole: assignedBy.role,
            });
            successCount++;
        } catch (error) {
            console.error(`Failed to assign item ${assignment.itemId}:`, error);
        }
    }

    return successCount;
}

/**
 * Get assignment logs for an order
 */
export async function getAssignmentLogsForOrder(orderId: string): Promise<AssignmentAuditLog[]> {
    const q = query(
        collection(db, ASSIGNMENT_LOGS_COLLECTION),
        where("orderId", "==", orderId),
        orderBy("timestamp", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as AssignmentAuditLog);
}

/**
 * Get assignment logs for a staff member
 */
export async function getAssignmentLogsForStaff(staffId: string): Promise<AssignmentAuditLog[]> {
    const q = query(
        collection(db, ASSIGNMENT_LOGS_COLLECTION),
        where("assignedToStaffId", "==", staffId),
        orderBy("timestamp", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as AssignmentAuditLog);
}

/**
 * Get all assignment logs (for admin analytics)
 */
export async function getAllAssignmentLogs(): Promise<AssignmentAuditLog[]> {
    const q = query(
        collection(db, ASSIGNMENT_LOGS_COLLECTION),
        orderBy("timestamp", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as AssignmentAuditLog);
}
