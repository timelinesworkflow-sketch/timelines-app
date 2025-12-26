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
import { GarmentType, MarkingTemplate, MarkingTemplateTask, MarkingTask, User, SubStageParentRole } from "@/types";

const TEMPLATES_COLLECTION = "markingTemplates";
const MARKING_TASKS_COLLECTION = "markingTasks";

// ============================================
// SUB-STAGE ID GENERATION
// ============================================

/**
 * Generate a consistent sub-stage ID from task name
 * e.g., "Front Neck Marking" -> "front_neck_marking"
 */
export function generateSubStageId(taskName: string): string {
    return taskName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "_")
        .trim();
}

// ============================================
// DEFAULT MARKING TEMPLATES (with sub-stage IDs)
// ============================================

export const DEFAULT_MARKING_TEMPLATES: Record<GarmentType, MarkingTemplateTask[]> = {
    blouse: [
        { taskName: "Front Neck Marking", taskOrder: 1, isMandatory: true },
        { taskName: "Back Neck Marking", taskOrder: 2, isMandatory: true },
        { taskName: "Sleeve / Putty Marking", taskOrder: 3, isMandatory: true },
        { taskName: "Marking Quality Check", taskOrder: 4, isMandatory: true },
    ],
    chudi: [
        { taskName: "Body Panel Marking", taskOrder: 1, isMandatory: true },
        { taskName: "Sleeve Marking", taskOrder: 2, isMandatory: true },
        { taskName: "Marking Quality Check", taskOrder: 3, isMandatory: true },
    ],
    frock: [
        { taskName: "Yoke Marking", taskOrder: 1, isMandatory: true },
        { taskName: "Flare / Skirt Marking", taskOrder: 2, isMandatory: true },
        { taskName: "Sleeve Marking", taskOrder: 3, isMandatory: false },
        { taskName: "Marking Quality Check", taskOrder: 4, isMandatory: true },
    ],
    pavadai_sattai: [
        { taskName: "Waist Marking", taskOrder: 1, isMandatory: true },
        { taskName: "Length Marking", taskOrder: 2, isMandatory: true },
        { taskName: "Marking Quality Check", taskOrder: 3, isMandatory: true },
    ],
    re_blouse: [
        { taskName: "Repair Area Marking", taskOrder: 1, isMandatory: true },
        { taskName: "Marking Quality Check", taskOrder: 2, isMandatory: true },
    ],
    re_pavada_sattai: [
        { taskName: "Repair Area Marking", taskOrder: 1, isMandatory: true },
        { taskName: "Marking Quality Check", taskOrder: 2, isMandatory: true },
    ],
    other: [
        { taskName: "General Marking", taskOrder: 1, isMandatory: true },
        { taskName: "Marking Quality Check", taskOrder: 2, isMandatory: true },
    ],
};

// ============================================
// DYNAMIC SUB-STAGE FUNCTIONS
// ============================================

/**
 * Get all unique sub-stages from all templates for a stage type
 * Returns array of { subStageId, subStageName } for staff management UI
 */
export async function getAllActiveSubStages(
    stageType: SubStageParentRole = "marking"
): Promise<{ subStageId: string; subStageName: string }[]> {
    const subStages = new Map<string, string>();

    // First, collect from default templates
    if (stageType === "marking") {
        Object.values(DEFAULT_MARKING_TEMPLATES).forEach(tasks => {
            tasks.forEach(task => {
                const subStageId = generateSubStageId(task.taskName);
                subStages.set(subStageId, task.taskName);
            });
        });
    }

    // Then, collect from Firestore templates (may have custom sub-stages)
    try {
        const snapshot = await getDocs(collection(db, TEMPLATES_COLLECTION));
        snapshot.docs.forEach(doc => {
            const template = doc.data() as MarkingTemplate;
            template.tasks?.forEach(task => {
                const subStageId = generateSubStageId(task.taskName);
                subStages.set(subStageId, task.taskName);
            });
        });
    } catch (error) {
        console.error("Failed to fetch templates:", error);
    }

    return Array.from(subStages.entries())
        .map(([subStageId, subStageName]) => ({ subStageId, subStageName }))
        .sort((a, b) => a.subStageName.localeCompare(b.subStageName));
}

/**
 * Get the default staff for a sub-stage ID (if exactly 1 exists)
 * Returns null if 0 or multiple defaults exist
 */
export async function getDefaultStaffForSubStage(
    subStageId: string
): Promise<{ staffId: string; name: string } | null> {
    try {
        // Query all active marking staff (Firestore doesn't support nested field queries well)
        const q = query(
            collection(db, "users"),
            where("isActive", "==", true)
        );
        const snapshot = await getDocs(q);

        // Filter for staff who have this sub-stage as default
        const defaultStaff = snapshot.docs
            .map(doc => doc.data() as User)
            .filter(user =>
                (user.role === "marking" || user.role === "cutting" || user.role === "stitching") &&
                user.subStageDefaults?.[subStageId] === true
            );

        // Only assign if EXACTLY 1 default exists
        if (defaultStaff.length === 1) {
            return { staffId: defaultStaff[0].staffId, name: defaultStaff[0].name };
        }
        return null;
    } catch (error) {
        console.error("Failed to get default staff for sub-stage:", error);
        return null;
    }
}

// ============================================
// TEMPLATE CRUD OPERATIONS
// ============================================

/**
 * Get template for a garment type (from Firestore or defaults)
 */
export async function getTemplateForGarmentType(garmentType: GarmentType): Promise<MarkingTemplate> {
    try {
        const q = query(
            collection(db, TEMPLATES_COLLECTION),
            where("garmentType", "==", garmentType)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            return snapshot.docs[0].data() as MarkingTemplate;
        }
    } catch (error) {
        console.error("Failed to get template:", error);
    }

    // Return default template if none exists
    const now = Timestamp.now();
    return {
        templateId: `default_${garmentType}`,
        garmentType,
        tasks: DEFAULT_MARKING_TEMPLATES[garmentType] || DEFAULT_MARKING_TEMPLATES.other,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Get all templates
 */
export async function getAllTemplates(): Promise<MarkingTemplate[]> {
    const templates: MarkingTemplate[] = [];

    try {
        const snapshot = await getDocs(collection(db, TEMPLATES_COLLECTION));
        snapshot.docs.forEach(doc => {
            templates.push(doc.data() as MarkingTemplate);
        });
    } catch (error) {
        console.error("Failed to get templates:", error);
    }

    // Add defaults for any missing garment types
    const garmentTypes: GarmentType[] = ["blouse", "chudi", "frock", "pavadai_sattai", "re_blouse", "re_pavada_sattai", "other"];
    const now = Timestamp.now();

    garmentTypes.forEach(garmentType => {
        if (!templates.find(t => t.garmentType === garmentType)) {
            templates.push({
                templateId: `default_${garmentType}`,
                garmentType,
                tasks: DEFAULT_MARKING_TEMPLATES[garmentType],
                createdAt: now,
                updatedAt: now,
            });
        }
    });

    return templates;
}

/**
 * Save/update a template
 */
export async function saveTemplate(template: MarkingTemplate): Promise<void> {
    const templateId = template.templateId.startsWith("default_")
        ? doc(collection(db, TEMPLATES_COLLECTION)).id
        : template.templateId;

    const templateData: MarkingTemplate = {
        ...template,
        templateId,
        updatedAt: Timestamp.now(),
    };

    await setDoc(doc(db, TEMPLATES_COLLECTION, templateId), templateData);
}

// ============================================
// MARKING TASK OPERATIONS
// ============================================

/**
 * Generate marking tasks for an order based on garment type
 * Auto-assigns from default staff if exactly 1 default exists for the sub-stage
 */
export async function generateMarkingTasksForOrder(
    orderId: string,
    garmentType: GarmentType
): Promise<MarkingTask[]> {
    const template = await getTemplateForGarmentType(garmentType);
    const tasks: MarkingTask[] = [];

    for (const templateTask of template.tasks) {
        const taskRef = doc(collection(db, MARKING_TASKS_COLLECTION));

        // Generate sub-stage ID from task name
        const subStageId = generateSubStageId(templateTask.taskName);

        // Check for default staff based on sub-stage ID
        let assignedStaffId: string | undefined;
        let assignedStaffName: string | undefined;

        const defaultStaff = await getDefaultStaffForSubStage(subStageId);
        if (defaultStaff) {
            assignedStaffId = defaultStaff.staffId;
            assignedStaffName = defaultStaff.name;
        }

        const task: MarkingTask = {
            taskId: taskRef.id,
            orderId,
            taskName: templateTask.taskName,
            taskOrder: templateTask.taskOrder,
            isMandatory: templateTask.isMandatory,
            status: "not_started",
            assignedStaffId,
            assignedStaffName,
            subStageId, // Store sub-stage ID for lookups
        };

        await setDoc(taskRef, task);
        tasks.push(task);
    }

    return tasks;
}

/**
 * Get marking tasks for an order
 */
export async function getMarkingTasksForOrder(orderId: string): Promise<MarkingTask[]> {
    const q = query(
        collection(db, MARKING_TASKS_COLLECTION),
        where("orderId", "==", orderId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(doc => doc.data() as MarkingTask)
        .sort((a, b) => a.taskOrder - b.taskOrder);
}

/**
 * Get marking tasks for a staff member
 */
export async function getMarkingTasksForStaff(staffId: string): Promise<MarkingTask[]> {
    const q = query(
        collection(db, MARKING_TASKS_COLLECTION),
        where("assignedStaffId", "==", staffId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(doc => doc.data() as MarkingTask)
        .sort((a, b) => a.taskOrder - b.taskOrder);
}

/**
 * Update a marking task
 */
export async function updateMarkingTask(taskId: string, updates: Partial<MarkingTask>): Promise<void> {
    await updateDoc(doc(db, MARKING_TASKS_COLLECTION, taskId), updates);
}

/**
 * Assign a marking task to a staff member
 */
export async function assignMarkingTask(
    taskId: string,
    staffId: string,
    staffName: string
): Promise<void> {
    await updateDoc(doc(db, MARKING_TASKS_COLLECTION, taskId), {
        assignedStaffId: staffId,
        assignedStaffName: staffName,
    });
}

/**
 * Start a marking task
 */
export async function startMarkingTask(taskId: string): Promise<void> {
    await updateDoc(doc(db, MARKING_TASKS_COLLECTION, taskId), {
        status: "in_progress",
        startedAt: Timestamp.now(),
    });
}

/**
 * Complete a marking task
 */
export async function completeMarkingTask(taskId: string, notes?: string): Promise<void> {
    const updates: Partial<MarkingTask> = {
        status: "completed",
        completedAt: Timestamp.now(),
    };
    if (notes) updates.notes = notes;

    await updateDoc(doc(db, MARKING_TASKS_COLLECTION, taskId), updates);
}

/**
 * Approve a marking task (Checker only)
 */
export async function approveMarkingTask(
    taskId: string,
    approverStaffId: string,
    approverName: string
): Promise<void> {
    await updateDoc(doc(db, MARKING_TASKS_COLLECTION, taskId), {
        status: "approved",
        approvedBy: approverStaffId,
        approvedByName: approverName,
        approvedAt: Timestamp.now(),
    });
}

/**
 * Reject a marking task (mark as needs rework)
 */
export async function rejectMarkingTask(taskId: string, notes: string): Promise<void> {
    await updateDoc(doc(db, MARKING_TASKS_COLLECTION, taskId), {
        status: "needs_rework",
        notes,
    });
}

/**
 * Check if all marking tasks for an order are approved
 */
export async function areAllMarkingTasksApproved(orderId: string): Promise<boolean> {
    const tasks = await getMarkingTasksForOrder(orderId);
    return tasks.length > 0 && tasks.every(task => task.status === "approved");
}
