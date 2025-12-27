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
import { AssignmentAuditLog, AssignmentTarget } from "@/types";

const ASSIGNMENT_LOGS_COLLECTION = "assignmentLogs";

/**
 * Assign an item or stage task to a staff member and create audit log
 */
export async function assignItemToStaff(data: {
    orderId: string;
    itemId: string; // Creates confusion? this is itemId or taskId
    itemIndex?: number; // Required for order_item
    targetType: AssignmentTarget;
    stage?: string; // Required for stage_task
    subStage?: string; // Optional for stage_task
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
        targetType,
        stage,
        subStage,
        currentStaffId,
        currentStaffName,
        newStaffId,
        newStaffName,
        assignedByStaffId,
        assignedByStaffName,
        assignedByRole,
    } = data;

    // 1. Perform Assignment Update based on Target Type
    if (targetType === "order_item") {
        if (typeof itemIndex !== "number") {
            throw new Error("Item index is required for order item assignment");
        }
        // Update the order's item with new assignment
        // Use computed property names for dynamic path
        const orderRef = doc(db, "orders", orderId);
        await updateDoc(orderRef, {
            [`items.${itemIndex}.assignedStaffId`]: newStaffId,
            [`items.${itemIndex}.assignedStaffName`]: newStaffName,
        });

    } else if (targetType === "stage_task") {
        if (!stage) throw new Error("Stage is required for stage task assignment");

        if (stage === "marking") {
            // New Embedded Logic for Marking
            // Update order document directly: markingTasks.{subTaskId}.assignedStaffId
            const orderRef = doc(db, "orders", orderId);
            await updateDoc(orderRef, {
                [`markingTasks.${itemId}.assignedStaffId`]: newStaffId,
                [`markingTasks.${itemId}.assignedStaffName`]: newStaffName,
            });
        } else {
            // Legacy/Collection Logic for Cutting (and others)
            let collectionName = "";
            if (stage === "cutting") collectionName = "cuttingTasks";
            else throw new Error(`Unsupported stage for task assignment: ${stage}`);

            const taskRef = doc(db, collectionName, itemId);
            await updateDoc(taskRef, {
                assignedStaffId: newStaffId,
                assignedStaffName: newStaffName,
            });
        }
    }

    // 2. Create Audit Log Entry
    const logRef = doc(collection(db, ASSIGNMENT_LOGS_COLLECTION));
    const auditLog: AssignmentAuditLog = {
        logId: logRef.id,
        itemId,
        orderId,
        assignmentTarget: targetType,
        stage,
        subStage,
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
    itemIndex?: number;
    targetType: AssignmentTarget;
    stage?: string;
    subStage?: string;
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
                ...assignment,
                newStaffId,
                newStaffName,
                assignedByStaffId: assignedBy.staffId,
                assignedByStaffName: assignedBy.staffName,
                assignedByRole: assignedBy.role,
            });
            successCount++;
        } catch (error) {
            console.error(`Failed to assign ${assignment.targetType} ${assignment.itemId}:`, error);
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
