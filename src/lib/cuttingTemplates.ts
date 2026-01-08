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
import { GarmentType, CuttingTemplate, CuttingTemplateTask, CuttingTask, User, SubStageParentRole } from "@/types";

const TEMPLATES_COLLECTION = "cuttingTemplates";
const CUTTING_TASKS_COLLECTION = "cuttingTasks";

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
 * e.g., "Lining Cutting" -> "lining_cutting"
 */
export function generateSubStageId(taskName: string): string {
    return taskName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "_")
        .trim();
}

// ============================================
// DEFAULT CUTTING TEMPLATES (with sub-stage IDs)
// ============================================

export const DEFAULT_CUTTING_TEMPLATES: Record<GarmentType, CuttingTemplateTask[]> = {
    blouse: [
        // Legacy fallback (same as lining)
        { taskName: "Lining Cutting", taskOrder: 1, isMandatory: true },
        { taskName: "Main Fabric Cutting", taskOrder: 2, isMandatory: true },
        { taskName: "Sleeve Cutting", taskOrder: 3, isMandatory: true },
        { taskName: "Cutting Quality Check", taskOrder: 4, isMandatory: true },
    ],
    lining_blouse: [
        { taskName: "Lining Cutting", taskOrder: 1, isMandatory: true },
        { taskName: "Main Fabric Cutting", taskOrder: 2, isMandatory: true },
        { taskName: "Sleeve Cutting", taskOrder: 3, isMandatory: true },
        { taskName: "Cutting Quality Check", taskOrder: 4, isMandatory: true },
    ],
    sada_blouse: [
        { taskName: "Main Fabric Cutting", taskOrder: 1, isMandatory: true },
        { taskName: "Sleeve Cutting", taskOrder: 2, isMandatory: true },
        { taskName: "Hem/Patti Cutting", taskOrder: 3, isMandatory: true },
        { taskName: "Cutting Quality Check", taskOrder: 4, isMandatory: true },
    ],
    chudi: [
        { taskName: "Body Panel Cutting", taskOrder: 1, isMandatory: true },
        { taskName: "Sleeve Cutting", taskOrder: 2, isMandatory: true },
        { taskName: "Collar Cutting", taskOrder: 3, isMandatory: false },
        { taskName: "Cutting Quality Check", taskOrder: 4, isMandatory: true },
    ],
    top: [
        { taskName: "Body Panel Cutting", taskOrder: 1, isMandatory: true },
        { taskName: "Sleeve Cutting", taskOrder: 2, isMandatory: true },
        { taskName: "Cutting Quality Check", taskOrder: 3, isMandatory: true },
    ],
    pant: [
        { taskName: "Pant Panel Cutting", taskOrder: 1, isMandatory: true },
        { taskName: "Waist Band Cutting", taskOrder: 2, isMandatory: true },
        { taskName: "Pocket Cutting", taskOrder: 3, isMandatory: false },
        { taskName: "Cutting Quality Check", taskOrder: 4, isMandatory: true },
    ],
    frock: [
        { taskName: "Yoke Cutting", taskOrder: 1, isMandatory: true },
        { taskName: "Skirt Cutting", taskOrder: 2, isMandatory: true },
        { taskName: "Sleeve Cutting", taskOrder: 3, isMandatory: false },
        { taskName: "Cutting Quality Check", taskOrder: 4, isMandatory: true },
    ],
    lehenga: [
        { taskName: "Lehenga Panel Cutting", taskOrder: 1, isMandatory: true },
        { taskName: "Waist Band Cutting", taskOrder: 2, isMandatory: true },
        { taskName: "Blouse/Top Cutting", taskOrder: 3, isMandatory: true },
        { taskName: "Cutting Quality Check", taskOrder: 4, isMandatory: true },
    ],
    pavadai_sattai: [
        { taskName: "Pavadai Cutting", taskOrder: 1, isMandatory: true },
        { taskName: "Sattai Cutting", taskOrder: 2, isMandatory: true },
        { taskName: "Cutting Quality Check", taskOrder: 3, isMandatory: true },
    ],
    aari_blouse: [
        { taskName: "Repair Piece Cutting", taskOrder: 1, isMandatory: true },
        { taskName: "Cutting Quality Check", taskOrder: 2, isMandatory: true },
    ],
    aari_pavada_sattai: [
        { taskName: "Repair Piece Cutting", taskOrder: 1, isMandatory: true },
        { taskName: "Cutting Quality Check", taskOrder: 2, isMandatory: true },
    ],
    rework: [
        { taskName: "Assessment", taskOrder: 1, isMandatory: true },
        { taskName: "Opening/Cutting", taskOrder: 2, isMandatory: true },
        { taskName: "Cutting Quality Check", taskOrder: 3, isMandatory: true },
    ],
    other: [
        { taskName: "General Cutting", taskOrder: 1, isMandatory: true },
        { taskName: "Cutting Quality Check", taskOrder: 2, isMandatory: true },
    ],
};

// ============================================
// DYNAMIC SUB-STAGE FUNCTIONS
// ============================================

/**
 * Get all unique sub-stages from all cutting templates
 * Returns array of { subStageId, subStageName } for staff management UI
 */
export async function getAllActiveCuttingSubStages(): Promise<{ subStageId: string; subStageName: string }[]> {
    const subStages = new Map<string, string>();

    // First, collect from default templates
    Object.values(DEFAULT_CUTTING_TEMPLATES).forEach(tasks => {
        tasks.forEach(task => {
            const subStageId = generateSubStageId(task.taskName);
            subStages.set(subStageId, task.taskName);
        });
    });

    // Then, collect from Firestore templates (may have custom sub-stages)
    try {
        const snapshot = await getDocs(collection(db, TEMPLATES_COLLECTION));
        snapshot.docs.forEach(doc => {
            const template = doc.data() as CuttingTemplate;
            template.tasks?.forEach(task => {
                const subStageId = generateSubStageId(task.taskName);
                subStages.set(subStageId, task.taskName);
            });
        });
    } catch (error) {
        console.error("Failed to fetch cutting templates:", error);
    }

    return Array.from(subStages.entries())
        .map(([subStageId, subStageName]) => ({ subStageId, subStageName }))
        .sort((a, b) => a.subStageName.localeCompare(b.subStageName));
}

/**
 * Get the default staff for a cutting sub-stage ID (if exactly 1 exists)
 * Returns null if 0 or multiple defaults exist
 */
export async function getDefaultStaffForCuttingSubStage(
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
                user.role === "cutting" &&
                user.subStageDefaults?.[subStageId] === true
            );

        // Only assign if EXACTLY 1 default exists
        if (defaultStaff.length === 1) {
            return { staffId: defaultStaff[0].staffId, name: defaultStaff[0].name };
        }
        return null;
    } catch (error) {
        console.error("Failed to get default staff for cutting sub-stage:", error);
        return null;
    }
}

// ============================================
// TEMPLATE CRUD OPERATIONS
// ============================================

/**
 * Get template for a garment type (from Firestore or defaults)
 */
export async function getCuttingTemplateForGarmentType(garmentType: GarmentType): Promise<CuttingTemplate> {
    try {
        const q = query(
            collection(db, TEMPLATES_COLLECTION),
            where("garmentType", "==", garmentType)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            return snapshot.docs[0].data() as CuttingTemplate;
        }
    } catch (error) {
        console.error("Failed to get cutting template:", error);
    }

    // Return default template if none exists
    const now = Timestamp.now();
    return {
        templateId: `default_${garmentType}`,
        garmentType,
        tasks: DEFAULT_CUTTING_TEMPLATES[garmentType] || DEFAULT_CUTTING_TEMPLATES.other,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Get all cutting templates
 */
export async function getAllCuttingTemplates(): Promise<CuttingTemplate[]> {
    const templates: CuttingTemplate[] = [];

    try {
        const snapshot = await getDocs(collection(db, TEMPLATES_COLLECTION));
        snapshot.docs.forEach(doc => {
            templates.push(doc.data() as CuttingTemplate);
        });
    } catch (error) {
        console.error("Failed to get cutting templates:", error);
    }

    // Add defaults for any missing garment types
    const garmentTypes: GarmentType[] = ["blouse", "chudi", "frock", "pavadai_sattai", "aari_blouse", "aari_pavada_sattai", "other", "lining_blouse", "sada_blouse", "top", "pant", "lehenga", "rework"];
    const now = Timestamp.now();

    garmentTypes.forEach(garmentType => {
        if (!templates.find(t => t.garmentType === garmentType)) {
            templates.push({
                templateId: `default_${garmentType}`,
                garmentType,
                tasks: DEFAULT_CUTTING_TEMPLATES[garmentType],
                createdAt: now,
                updatedAt: now,
            });
        }
    });

    return templates;
}

/**
 * Save/update a cutting template
 */
export async function saveCuttingTemplate(template: CuttingTemplate): Promise<void> {
    const templateId = template.templateId.startsWith("default_")
        ? doc(collection(db, TEMPLATES_COLLECTION)).id
        : template.templateId;

    const templateData: CuttingTemplate = {
        ...template,
        templateId,
        updatedAt: Timestamp.now(),
    };

    await setDoc(doc(db, TEMPLATES_COLLECTION, templateId), templateData);
}

// ============================================
// CUTTING TASK OPERATIONS
// ============================================

/**
 * Generate cutting tasks for an order based on garment type
 * Auto-assigns from default staff if exactly 1 default exists for the sub-stage
 */
export async function generateCuttingTasksForOrder(
    orderId: string,
    garmentType: GarmentType
): Promise<CuttingTask[]> {
    const template = await getCuttingTemplateForGarmentType(garmentType);

    if (!template.tasks || template.tasks.length === 0) {
        throw new Error(`No cutting tasks defined for garment type: ${garmentType}`);
    }

    const tasks: CuttingTask[] = [];

    for (const templateTask of template.tasks) {
        const taskRef = doc(collection(db, CUTTING_TASKS_COLLECTION));

        // Generate sub-stage ID from task name
        const subStageId = generateSubStageId(templateTask.taskName);

        // Check for default staff based on sub-stage ID
        const defaultStaff = await getDefaultStaffForCuttingSubStage(subStageId);

        // Use null for optional fields, never undefined (Firestore rejects undefined)
        const assignedStaffId = defaultStaff?.staffId ?? null;
        const assignedStaffName = defaultStaff?.name ?? null;

        const task: CuttingTask = {
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
 * Get cutting tasks for an order
 */
export async function getCuttingTasksForOrder(orderId: string): Promise<CuttingTask[]> {
    const q = query(
        collection(db, CUTTING_TASKS_COLLECTION),
        where("orderId", "==", orderId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(doc => doc.data() as CuttingTask)
        .sort((a, b) => a.taskOrder - b.taskOrder);
}

/**
 * Get cutting tasks for a staff member
 */
export async function getCuttingTasksForStaff(staffId: string): Promise<CuttingTask[]> {
    const q = query(
        collection(db, CUTTING_TASKS_COLLECTION),
        where("assignedStaffId", "==", staffId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(doc => doc.data() as CuttingTask)
        .sort((a, b) => a.taskOrder - b.taskOrder);
}

/**
 * Update a cutting task
 */
export async function updateCuttingTask(taskId: string, updates: Partial<CuttingTask>): Promise<void> {
    await updateDoc(doc(db, CUTTING_TASKS_COLLECTION, taskId), updates);
}

/**
 * Assign a cutting task to a staff member
 */
import { assignItemToStaff } from "@/lib/assignments";

/**
 * Assign a cutting task to a staff member
 */
export async function assignCuttingTask(
    taskId: string,
    orderId: string, // Needed for audit log
    staffId: string,
    staffName: string,
    assignedBy: {
        staffId: string;
        staffName: string;
        role: "admin" | "supervisor";
    }
): Promise<void> {
    await assignItemToStaff({
        orderId,
        itemId: taskId,
        targetType: "stage_task",
        stage: "cutting",
        newStaffId: staffId,
        newStaffName: staffName,
        assignedByStaffId: assignedBy.staffId,
        assignedByStaffName: assignedBy.staffName,
        assignedByRole: assignedBy.role,
    });
}

/**
 * Start a cutting task
 */
export async function startCuttingTask(taskId: string): Promise<void> {
    await updateDoc(doc(db, CUTTING_TASKS_COLLECTION, taskId), {
        status: "in_progress",
        startedAt: Timestamp.now(),
    });
}

/**
 * Complete a cutting task
 */
export async function completeCuttingTask(taskId: string, notes?: string): Promise<void> {
    const updates: Partial<CuttingTask> = {
        status: "completed",
        completedAt: Timestamp.now(),
    };
    if (notes) updates.notes = notes;

    await updateDoc(doc(db, CUTTING_TASKS_COLLECTION, taskId), updates);
}

/**
 * Approve a cutting task (Checker only)
 */
export async function approveCuttingTask(
    taskId: string,
    approverStaffId: string,
    approverName: string
): Promise<void> {
    await updateDoc(doc(db, CUTTING_TASKS_COLLECTION, taskId), {
        status: "approved",
        approvedBy: approverStaffId,
        approvedByName: approverName,
        approvedAt: Timestamp.now(),
    });
}

/**
 * Reject a cutting task (mark as needs rework)
 */
export async function rejectCuttingTask(taskId: string, notes: string): Promise<void> {
    await updateDoc(doc(db, CUTTING_TASKS_COLLECTION, taskId), {
        status: "needs_rework",
        notes,
    });
}

/**
 * Check if all cutting tasks for an order are approved
 */
export async function areAllCuttingTasksApproved(orderId: string): Promise<boolean> {
    const tasks = await getCuttingTasksForOrder(orderId);
    return tasks.length > 0 && tasks.every(task => task.status === "approved");
}
