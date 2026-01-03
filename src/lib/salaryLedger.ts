/**
 * Salary Ledger Library
 * Enterprise-grade salary management for Accounts module
 * Uses staffWorkLogs for work history data (NOT workflow stages)
 */

import { db } from "@/lib/firebase";
import {
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    query,
    where,
    orderBy,
    Timestamp,
    getDoc,
} from "firebase/firestore";
import {
    SalaryLedger,
    StaffSalaryRole,
    PaymentStatus,
    SalaryType,
    WorkSummary,
    StaffWorkLog,
    User,
    calculatePaymentStatus
} from "@/types";

// ============================================
// SALARY LEDGER CRUD
// ============================================

export async function getSalaryLedgerEntries(staffId?: string): Promise<SalaryLedger[]> {
    try {
        // NO WHERE CLAUSE - fetch all, filter client-side to avoid index issues
        const snapshot = await getDocs(collection(db, "salaryLedger"));

        let entries = snapshot.docs.map(doc => ({
            ...doc.data(),
            ledgerId: doc.id,
        })) as SalaryLedger[];

        // Filter by staffId client-side
        if (staffId) {
            entries = entries.filter(e => e.staffId === staffId);
        }

        // Sort client-side (descending by createdAt)
        return entries.sort((a, b) => {
            const aTime = a.createdAt?.toMillis() || 0;
            const bTime = b.createdAt?.toMillis() || 0;
            return bTime - aTime;
        });
    } catch (error) {
        console.error("Error fetching salary ledger entries:", error);
        return [];
    }
}

export async function createSalaryLedgerEntry(params: {
    staffId: string;
    staffName: string;
    staffRole: StaffSalaryRole;
    salaryType: SalaryType;
    workSummary: WorkSummary;
    grossAmount: number;
    advanceAmount: number;
    paidAmount: number;
    creditedByRole: "accountant" | "admin";
    creditedById: string;
    creditedByName: string;
    notes?: string;
}): Promise<string> {
    const netPayable = params.grossAmount - params.advanceAmount;
    const paymentStatus = calculatePaymentStatus(netPayable, params.paidAmount);

    // Build entry without undefined fields (Firestore rejects undefined)
    const entry: Omit<SalaryLedger, "ledgerId"> & { paymentDate?: any } = {
        staffId: params.staffId,
        staffName: params.staffName,
        staffRole: params.staffRole,
        salaryType: params.salaryType,
        workSummary: params.workSummary,
        grossAmount: params.grossAmount,
        advanceAmount: params.advanceAmount,
        netPayable,
        paidAmount: params.paidAmount,
        paymentStatus,
        creditedByRole: params.creditedByRole,
        creditedById: params.creditedById,
        creditedByName: params.creditedByName,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        notes: params.notes || "",
    };

    // Only add paymentDate if paid (avoid undefined in Firestore)
    if (params.paidAmount > 0) {
        entry.paymentDate = Timestamp.now();
    }

    const docRef = await addDoc(collection(db, "salaryLedger"), entry);
    return docRef.id;
}

export async function updateSalaryLedgerEntry(
    ledgerId: string,
    updates: Partial<{
        paidAmount: number;
        notes: string;
        creditedByRole: "accountant" | "admin";
        creditedById: string;
        creditedByName: string;
    }>,
    netPayable: number
): Promise<void> {
    const updateData: Record<string, unknown> = {
        ...updates,
        updatedAt: Timestamp.now(),
    };

    // Recalculate payment status if paidAmount changed
    if (updates.paidAmount !== undefined) {
        updateData.paymentStatus = calculatePaymentStatus(netPayable, updates.paidAmount);
        if (updates.paidAmount > 0) {
            updateData.paymentDate = Timestamp.now();
        }
    }

    await updateDoc(doc(db, "salaryLedger", ledgerId), updateData);
}

// ============================================
// STAFF WORK LOGS (Source of truth for work done)
// ============================================

export async function getStaffWorkLogs(
    staffId: string,
    fromDate?: Date,
    toDate?: Date
): Promise<StaffWorkLog[]> {
    try {
        // NO WHERE CLAUSE - fetch all, filter client-side to avoid index issues
        const snapshot = await getDocs(collection(db, "staffWorkLogs"));

        let logs: StaffWorkLog[] = snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
                ...data,
                logId: docSnap.id,
            } as unknown as StaffWorkLog;
        });

        // Filter by staffId client-side
        logs = logs.filter(log => log.staffId === staffId);

        // Sort client-side (descending by timestamp)
        logs.sort((a, b) => {
            const aTime = a.timestamp?.toMillis() || 0;
            const bTime = b.timestamp?.toMillis() || 0;
            return bTime - aTime;
        });

        // Filter by date range if provided
        if (fromDate && toDate) {
            logs = logs.filter(log => {
                const logDate = log.timestamp?.toDate();
                if (!logDate) return false;
                return logDate >= fromDate && logDate <= toDate;
            });
        }

        return logs;
    } catch (error) {
        console.error("Error fetching staff work logs:", error);
        return [];
    }
}

export async function getStaffWorkSummary(
    staffId: string,
    fromDate: Date,
    toDate: Date
): Promise<WorkSummary> {
    const logs = await getStaffWorkLogs(staffId, fromDate, toDate);

    const stagesWorked = [...new Set(logs.map(log => log.stage))];
    const orderIds = [...new Set(logs.map(log => log.orderId))];

    return {
        totalOrders: orderIds.length,
        stagesWorked,
        fromDate: Timestamp.fromDate(fromDate),
        toDate: Timestamp.fromDate(toDate),
    };
}

// ============================================
// STAFF LIST (re-exported from users.ts for backward compatibility)
// ============================================

// Re-export staff functions from users.ts (single source of truth)
export {
    getStaffByRoles,
    getStitchingStaff,
    getAariStaff,
    getMonthlyStaff,
    getAllActiveStaff,
} from "@/lib/users";

// ============================================
// STAFF SALARY SUMMARY
// ============================================

export interface StaffSalarySummary {
    staffId: string;
    staffName: string;
    staffRole: string;
    totalOrders: number;
    lastPaymentStatus: PaymentStatus | "none";
    lastPaymentDate: Date | null;
    pendingAmount: number;
}

export async function getStaffSalarySummaries(staff: User[]): Promise<StaffSalarySummary[]> {
    const summaries: StaffSalarySummary[] = [];

    for (const user of staff) {
        // Wrap each staff in try/catch - one bad staff shouldn't crash all
        try {
            // Get latest salary ledger entry
            const ledgerEntries = await getSalaryLedgerEntries(user.staffId);
            const latestEntry = ledgerEntries[0];

            // Get work logs for this week
            const now = new Date();
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay() + 1);
            weekStart.setHours(0, 0, 0, 0);

            const workLogs = await getStaffWorkLogs(user.staffId, weekStart, now);
            const orderIds = [...new Set(workLogs.map(log => log.orderId))];

            // Calculate pending amount from ledger
            const pendingAmount = ledgerEntries
                .filter(e => e.paymentStatus !== "paid")
                .reduce((sum, e) => sum + Math.max((e.netPayable - e.paidAmount), 0), 0);

            summaries.push({
                staffId: user.staffId,
                staffName: user.name,
                staffRole: user.role,
                totalOrders: orderIds.length,
                lastPaymentStatus: latestEntry?.paymentStatus ?? "none",
                lastPaymentDate: latestEntry?.paymentDate?.toDate() ?? null,
                pendingAmount,
            });
        } catch (err) {
            console.warn("Skipping staff due to error:", user.staffId, err);
            // Still add staff with zero values so they appear in the list
            summaries.push({
                staffId: user.staffId,
                staffName: user.name,
                staffRole: user.role,
                totalOrders: 0,
                lastPaymentStatus: "none",
                lastPaymentDate: null,
                pendingAmount: 0,
            });
        }
    }

    return summaries;
}

// ============================================
// DATE HELPERS
// ============================================

export function getWeekDateRange(date: Date = new Date()): { start: Date; end: Date } {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(date);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
}

export function getMonthDateRange(date: Date = new Date()): { start: Date; end: Date } {
    const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
}

export function mapRoleToSalaryRole(role: string): StaffSalaryRole {
    if (role === "stitching" || role === "stitching_checker") {
        return "stitching";
    }
    // Handle all AARI variants (aari, aari_worker, aari_staff, etc.)
    if (role.startsWith("aari")) {
        return "aari";
    }
    return "monthly";
}

export function getSalaryTypeForRole(role: string): SalaryType {
    if (role === "stitching" || role === "stitching_checker") {
        return "weekly";
    }
    // Handle all AARI variants
    if (role.startsWith("aari")) {
        return "weekly";
    }
    return "monthly";
}
