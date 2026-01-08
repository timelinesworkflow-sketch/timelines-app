"use client";

import { db } from "@/lib/firebase";
import {
    collection,
    doc,
    setDoc,
    getDocs,
    updateDoc,
    query,
    where,
    Timestamp,
} from "firebase/firestore";
import { GarmentType, StitchingTemplate, StitchingTemplateTask, StitchingTask, User } from "@/types";

const TEMPLATES_COLLECTION = "stitchingTemplates";
const STITCHING_TASKS_COLLECTION = "stitchingTasks";

// ============================================
// UTILITY: Remove undefined fields from objects
// Firestore does NOT accept undefined values
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripUndefined(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
        if (obj[key] !== undefined) {
            result[key] = obj[key];
        }
    }
    return result;
}

// ============================================
// SUB-STAGE ID GENERATION
// ============================================

/**
 * Generate a consistent sub-stage ID from task name
 * e.g., "Body Stitching" -> "body_stitching"
 */
export function generateSubStageId(taskName: string): string {
    return taskName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "_")
        .trim();
}

// ============================================
// DEFAULT STITCHING TEMPLATES (with sub-stage IDs)
// ============================================

export const DEFAULT_STITCHING_TEMPLATES: Record<GarmentType, StitchingTemplateTask[]> = {
    blouse: [
        { taskName: "Body Stitching", taskOrder: 1, isMandatory: true },
        { taskName: "Sleeve Attachment", taskOrder: 2, isMandatory: true },
        { taskName: "Neck Finishing", taskOrder: 3, isMandatory: true },
        { taskName: "Hook & Button", taskOrder: 4, isMandatory: true },
        { taskName: "Stitching Quality Check", taskOrder: 5, isMandatory: true },
    ],
    lining_blouse: [
        { taskName: "Body Stitching", taskOrder: 1, isMandatory: true },
        { taskName: "Sleeve Attachment", taskOrder: 2, isMandatory: true },
        { taskName: "Neck Finishing", taskOrder: 3, isMandatory: true },
        { taskName: "Hook & Button", taskOrder: 4, isMandatory: true },
        { taskName: "Stitching Quality Check", taskOrder: 5, isMandatory: true },
    ],
    sada_blouse: [
        { taskName: "Body Stitching", taskOrder: 1, isMandatory: true },
        { taskName: "Sleeve Attachment", taskOrder: 2, isMandatory: true },
        { taskName: "Hemming/Patti", taskOrder: 3, isMandatory: true },
        { taskName: "Hook & Button", taskOrder: 4, isMandatory: true },
        { taskName: "Stitching Quality Check", taskOrder: 5, isMandatory: true },
    ],
    chudi: [
        { taskName: "Body Stitching", taskOrder: 1, isMandatory: true },
        { taskName: "Sleeve Attachment", taskOrder: 2, isMandatory: true },
        { taskName: "Collar Stitching", taskOrder: 3, isMandatory: false },
        { taskName: "Side Slit Work", taskOrder: 4, isMandatory: false },
        { taskName: "Stitching Quality Check", taskOrder: 5, isMandatory: true },
    ],
    top: [
        { taskName: "Body Stitching", taskOrder: 1, isMandatory: true },
        { taskName: "Sleeve Attachment", taskOrder: 2, isMandatory: true },
        { taskName: "Side Slit Work", taskOrder: 3, isMandatory: false },
        { taskName: "Stitching Quality Check", taskOrder: 4, isMandatory: true },
    ],
    pant: [
        { taskName: "Pant Stitching", taskOrder: 1, isMandatory: true },
        { taskName: "Waist Band/Elastic", taskOrder: 2, isMandatory: true },
        { taskName: "Hemming", taskOrder: 3, isMandatory: false },
        { taskName: "Stitching Quality Check", taskOrder: 4, isMandatory: true },
    ],
    frock: [
        { taskName: "Yoke Stitching", taskOrder: 1, isMandatory: true },
        { taskName: "Skirt Pleating", taskOrder: 2, isMandatory: true },
        { taskName: "Sleeve Attachment", taskOrder: 3, isMandatory: false },
        { taskName: "Trim & Finishing", taskOrder: 4, isMandatory: true },
        { taskName: "Stitching Quality Check", taskOrder: 5, isMandatory: true },
    ],
    lehenga: [
        { taskName: "Lehenga Stitching", taskOrder: 1, isMandatory: true },
        { taskName: "Blouse Stitching", taskOrder: 2, isMandatory: true },
        { taskName: "Waist Band/Dori", taskOrder: 3, isMandatory: true },
        { taskName: "Stitching Quality Check", taskOrder: 4, isMandatory: true },
    ],
    pavadai_sattai: [
        { taskName: "Pavadai Stitching", taskOrder: 1, isMandatory: true },
        { taskName: "Sattai Stitching", taskOrder: 2, isMandatory: true },
        { taskName: "Waist Band", taskOrder: 3, isMandatory: true },
        { taskName: "Stitching Quality Check", taskOrder: 4, isMandatory: true },
    ],
    aari_blouse: [
        { taskName: "Repair Stitching", taskOrder: 1, isMandatory: true },
        { taskName: "Stitching Quality Check", taskOrder: 2, isMandatory: true },
    ],
    aari_pavada_sattai: [
        { taskName: "Repair Stitching", taskOrder: 1, isMandatory: true },
        { taskName: "Stitching Quality Check", taskOrder: 2, isMandatory: true },
    ],
    rework: [
        { taskName: "Repair Stitching", taskOrder: 1, isMandatory: true },
        { taskName: "Stitching Quality Check", taskOrder: 2, isMandatory: true },
    ],
    other: [
        { taskName: "Main Stitching", taskOrder: 1, isMandatory: true },
        { taskName: "Finishing Work", taskOrder: 2, isMandatory: true },
        { taskName: "Stitching Quality Check", taskOrder: 3, isMandatory: true },
    ],
};

// ============================================
// DYNAMIC SUB-STAGE FUNCTIONS
// ============================================

/**
 * Get all unique sub-stages from all stitching templates
 * Returns array of { subStageId, subStageName } for staff management UI
 */
export async function getAllActiveStitchingSubStages(): Promise<{ subStageId: string; subStageName: string }[]> {
    const subStages = new Map<string, string>();

    // First, collect from default templates
    Object.values(DEFAULT_STITCHING_TEMPLATES).forEach(tasks => {
        tasks.forEach(task => {
            const subStageId = generateSubStageId(task.taskName);
            subStages.set(subStageId, task.taskName);
        });
    });

    // Then, collect from Firestore templates (may have custom sub-stages)
    try {
        const snapshot = await getDocs(collection(db, TEMPLATES_COLLECTION));
        snapshot.docs.forEach(doc => {
            const template = doc.data() as StitchingTemplate;
            template.tasks?.forEach(task => {
                const subStageId = generateSubStageId(task.taskName);
                subStages.set(subStageId, task.taskName);
            });
        });
    } catch (error) {
        console.error("Failed to fetch stitching templates:", error);
    }

    return Array.from(subStages.entries())
        .map(([subStageId, subStageName]) => ({ subStageId, subStageName }))
        .sort((a, b) => a.subStageName.localeCompare(b.subStageName));
}

/**
 * Get the default staff for a stitching sub-stage ID (if exactly 1 exists)
 * Returns null if 0 or multiple defaults exist
 */
export async function getDefaultStaffForStitchingSubStage(
    subStageId: string
): Promise<{ staffId: string; name: string } | null> {
    try {
        const q = query(
            collection(db, "users"),
            where("isActive", "==", true)
        );
        const snapshot = await getDocs(q);

        // Filter for staff who have this sub-stage as default
        const defaultStaff = snapshot.docs
            .map(doc => doc.data() as User)
            .filter(user =>
                user.role === "stitching" &&
                user.subStageDefaults?.[subStageId] === true
            );

        // Only assign if EXACTLY 1 default exists
        if (defaultStaff.length === 1) {
            return { staffId: defaultStaff[0].staffId, name: defaultStaff[0].name };
        }
        return null;
    } catch (error) {
        console.error("Failed to get default staff for stitching sub-stage:", error);
        return null;
    }
}

// ============================================
// TEMPLATE CRUD OPERATIONS
// ============================================

/**
 * Get template for a garment type (from Firestore or defaults)
 */
export async function getStitchingTemplateForGarmentType(garmentType: GarmentType): Promise<StitchingTemplate> {
    try {
        const q = query(
            collection(db, TEMPLATES_COLLECTION),
            where("garmentType", "==", garmentType)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            return snapshot.docs[0].data() as StitchingTemplate;
        }
    } catch (error) {
        console.error("Failed to fetch stitching template:", error);
    }

    // Return default template if not found in Firestore
    return {
        templateId: `default_${garmentType}`,
        garmentType,
        tasks: DEFAULT_STITCHING_TEMPLATES[garmentType] || DEFAULT_STITCHING_TEMPLATES.other,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    };
}

/**
 * Get all stitching templates
 */
export async function getAllStitchingTemplates(): Promise<StitchingTemplate[]> {
    const garmentTypes: GarmentType[] = [
        "blouse", "chudi", "frock", "pavadai_sattai", "aari_blouse", "aari_pavada_sattai", "other",
        "lining_blouse", "sada_blouse", "top", "pant", "lehenga", "rework"
    ];

    const templates: StitchingTemplate[] = [];

    for (const garmentType of garmentTypes) {
        const template = await getStitchingTemplateForGarmentType(garmentType);
        templates.push(template);
    }

    return templates;
}

/**
 * Save a stitching template
 */
export async function saveStitchingTemplate(template: StitchingTemplate): Promise<void> {
    const docId = template.templateId.startsWith("default_")
        ? template.garmentType
        : template.templateId;

    await setDoc(doc(db, TEMPLATES_COLLECTION, docId), {
        ...template,
        templateId: docId,
        updatedAt: Timestamp.now(),
    });
}

// ============================================
// TASK GENERATION & MANAGEMENT
// ============================================

/**
 * Generate stitching tasks for an order based on garment type template
 */
export async function generateStitchingTasksForOrder(
    orderId: string,
    garmentType: GarmentType
): Promise<StitchingTask[]> {
    const template = await getStitchingTemplateForGarmentType(garmentType);

    if (!template.tasks || template.tasks.length === 0) {
        throw new Error(`No stitching tasks defined for garment type: ${garmentType}`);
    }

    const tasks: StitchingTask[] = [];

    for (const templateTask of template.tasks) {
        const taskRef = doc(collection(db, STITCHING_TASKS_COLLECTION));

        // Generate sub-stage ID from task name
        const subStageId = generateSubStageId(templateTask.taskName);

        // Check for default staff based on sub-stage ID
        const defaultStaff = await getDefaultStaffForStitchingSubStage(subStageId);

        // Use null for optional fields, never undefined (Firestore rejects undefined)
        const assignedStaffId = defaultStaff?.staffId ?? null;
        const assignedStaffName = defaultStaff?.name ?? null;

        const task: StitchingTask = {
            taskId: taskRef.id,
            orderId,
            taskName: templateTask.taskName,
            taskOrder: templateTask.taskOrder,
            isMandatory: templateTask.isMandatory,
            status: "not_started",
            subStageId,
            assignedStaffId: assignedStaffId ?? undefined,
            assignedStaffName: assignedStaffName ?? undefined,
        };

        // Strip undefined fields before Firestore write
        const cleanTask = stripUndefined(task);
        await setDoc(taskRef, cleanTask);
        tasks.push(task);
    }

    return tasks;
}

/**
 * Get stitching tasks for an order
 */
export async function getStitchingTasksForOrder(orderId: string): Promise<StitchingTask[]> {
    const q = query(
        collection(db, STITCHING_TASKS_COLLECTION),
        where("orderId", "==", orderId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(doc => doc.data() as StitchingTask)
        .sort((a, b) => a.taskOrder - b.taskOrder);
}

/**
 * Get stitching tasks for a staff member
 */
export async function getStitchingTasksForStaff(staffId: string): Promise<StitchingTask[]> {
    const q = query(
        collection(db, STITCHING_TASKS_COLLECTION),
        where("assignedStaffId", "==", staffId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(doc => doc.data() as StitchingTask)
        .sort((a, b) => a.taskOrder - b.taskOrder);
}

/**
 * Start a stitching task
 */
export async function startStitchingTask(taskId: string): Promise<void> {
    await updateDoc(doc(db, STITCHING_TASKS_COLLECTION, taskId), {
        status: "in_progress",
        startedAt: Timestamp.now(),
    });
}

/**
 * Complete a stitching task
 */
export async function completeStitchingTask(taskId: string, notes?: string): Promise<void> {
    const updateData: Record<string, unknown> = {
        status: "completed",
        completedAt: Timestamp.now(),
    };
    if (notes) {
        updateData.notes = notes;
    }
    await updateDoc(doc(db, STITCHING_TASKS_COLLECTION, taskId), updateData);
}

/**
 * Approve a stitching task
 */
export async function approveStitchingTask(
    taskId: string,
    approvedBy: string,
    approvedByName: string
): Promise<void> {
    await updateDoc(doc(db, STITCHING_TASKS_COLLECTION, taskId), {
        status: "approved",
        approvedBy,
        approvedByName,
        approvedAt: Timestamp.now(),
    });
}

/**
 * Reject a stitching task (needs rework)
 */
export async function rejectStitchingTask(taskId: string, notes: string): Promise<void> {
    await updateDoc(doc(db, STITCHING_TASKS_COLLECTION, taskId), {
        status: "needs_rework",
        notes,
    });
}

/**
 * Assign a stitching task to staff
 */
export async function assignStitchingTask(
    taskId: string,
    orderId: string,
    staffId: string,
    staffName: string,
    assignedBy: { staffId: string; staffName: string; role: "admin" | "supervisor" }
): Promise<void> {
    await updateDoc(doc(db, STITCHING_TASKS_COLLECTION, taskId), {
        assignedStaffId: staffId,
        assignedStaffName: staffName,
    });
}

/**
 * Check if all mandatory stitching tasks are approved for an order
 */
export async function areAllStitchingTasksApproved(orderId: string): Promise<boolean> {
    const tasks = await getStitchingTasksForOrder(orderId);

    // Filter mandatory tasks only
    const mandatoryTasks = tasks.filter(t => t.isMandatory);

    if (mandatoryTasks.length === 0) return true;

    // All mandatory tasks must be approved
    return mandatoryTasks.every(t => t.status === "approved");
}

/**
 * Get all pending stitching tasks (not approved yet)
 */
export async function getAllPendingStitchingTasks(): Promise<StitchingTask[]> {
    const q = query(
        collection(db, STITCHING_TASKS_COLLECTION),
        where("status", "in", ["not_started", "in_progress", "completed", "needs_rework"])
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(doc => doc.data() as StitchingTask)
        .sort((a, b) => a.taskOrder - b.taskOrder);
}
