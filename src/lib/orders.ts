import { db } from "@/lib/firebase";
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    query,
    where,
    orderBy,
    Timestamp,
    addDoc,
} from "firebase/firestore";
import { Order, TimelineEntry, StaffWorkLog } from "@/types";

/**
 * Create a new order in Firestore
 */
export async function createOrder(orderData: Partial<Order>): Promise<string> {
    const ordersRef = collection(db, "orders");
    const orderDoc = await addDoc(ordersRef, {
        ...orderData,
        createdAt: Timestamp.now(),
    });

    // Update with the generated ID
    await updateDoc(orderDoc, { orderId: orderDoc.id });

    return orderDoc.id;
}

/**
 * Get an order by ID
 */
export async function getOrder(orderId: string): Promise<Order | null> {
    const orderDoc = await getDoc(doc(db, "orders", orderId));
    if (!orderDoc.exists()) return null;
    return orderDoc.data() as Order;
}

/**
 * Update an order
 */
export async function updateOrder(orderId: string, updates: Partial<Order>): Promise<void> {
    await updateDoc(doc(db, "orders", orderId), updates);
}

/**
 * Get orders for a specific stage and staff
 */
export async function getOrdersForStage(
    stage: string,
    staffId?: string
): Promise<Order[]> {
    const ordersRef = collection(db, "orders");
    const q = query(
        ordersRef,
        where("currentStage", "==", stage),
        where("status", "in", ["confirmed_locked", "in_progress"]),
        orderBy("dueDate", "asc"),
        orderBy("confirmedAt", "asc")
    );

    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map((doc) => doc.data() as Order);

    // Filter by assigned staff if provided
    if (staffId) {
        return orders.filter((order) => {
            const assigned = order.assignedStaff[stage as keyof typeof order.assignedStaff];
            return !assigned || assigned === staffId;
        });
    }

    return orders;
}

/**
 * Add a timeline entry for an order
 */
export async function addTimelineEntry(
    orderId: string,
    entry: Omit<TimelineEntry, "timestamp">
): Promise<void> {
    const timelineRef = collection(db, "orders", orderId, "timeline");
    await addDoc(timelineRef, {
        ...entry,
        timestamp: Timestamp.now(),
    });
}

/**
 * Log staff work
 */
export async function logStaffWork(log: Omit<StaffWorkLog, "timestamp">): Promise<void> {
    const logsRef = collection(db, "staffWorkLogs");
    await addDoc(logsRef, {
        ...log,
        timestamp: Timestamp.now(),
    });
}

/**
 * Get next stage in workflow
 */
export function getNextStage(currentStage: string, activeStages: string[]): string | null {
    const stageOrder = [
        "intake",
        "materials",
        "marking",
        "marking_checker",
        "cutting",
        "cutting_checker",
        "stitching",
        "stitching_checker",
        "hooks",
        "ironing",
        "billing",
    ];

    const currentIndex = stageOrder.indexOf(currentStage);
    if (currentIndex === -1) return null;

    for (let i = currentIndex + 1; i < stageOrder.length; i++) {
        if (activeStages.includes(stageOrder[i])) {
            return stageOrder[i];
        }
    }

    return null;
}

/**
 * Get timeline for an order
 */
export async function getOrderTimeline(orderId: string): Promise<TimelineEntry[]> {
    const timelineRef = collection(db, "orders", orderId, "timeline");
    const q = query(timelineRef, orderBy("timestamp", "asc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as TimelineEntry);
}
