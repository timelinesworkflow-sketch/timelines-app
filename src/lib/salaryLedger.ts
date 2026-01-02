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
        let q;
        if (staffId) {
            // Simple query without orderBy to avoid index requirement
            q = query(
                collection(db, "salaryLedger"),
                where("staffId", "==", staffId)
            );
        } else {
            q = query(collection(db, "salaryLedger"));
        }

        const snapshot = await getDocs(q);
        const entries = snapshot.docs.map(doc => ({
            ...doc.data(),
            ledgerId: doc.id,
        })) as SalaryLedger[];

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

    const entry: Omit<SalaryLedger, "ledgerId"> = {
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
        paymentDate: params.paidAmount > 0 ? Timestamp.now() : undefined,
        creditedByRole: params.creditedByRole,
        creditedById: params.creditedById,
        creditedByName: params.creditedByName,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        notes: params.notes || "",
    };

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
        // Simple query without orderBy to avoid index requirement
        const q = query(
            collection(db, "staffWorkLogs"),
            where("staffId", "==", staffId)
        );

        const snapshot = await getDocs(q);
        let logs: StaffWorkLog[] = snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
                ...data,
                logId: docSnap.id,
            } as unknown as StaffWorkLog;
        });

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
// STAFF LIST (from users collection)
// ============================================

export async function getStaffByRoles(roles: string[]): Promise<User[]> {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);

    return snapshot.docs
        .map(doc => doc.data() as User)
        // isActive may be undefined for older users - treat undefined as active
        .filter(user => roles.includes(user.role) && user.isActive !== false);
}

export async function getStitchingStaff(): Promise<User[]> {
    return getStaffByRoles(["stitching", "stitching_checker"]);
}

export async function getAariStaff(): Promise<User[]> {
    return getStaffByRoles(["aari"]);
}

export async function getMonthlyStaff(): Promise<User[]> {
    return getStaffByRoles(["supervisor", "intake", "materials", "purchase", "billing", "delivery", "accountant", "marking", "marking_checker", "cutting", "cutting_checker", "hooks", "ironing"]);
}

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
        const pendingEntries = ledgerEntries.filter(e => e.paymentStatus !== "paid");
        const pendingAmount = pendingEntries.reduce((sum, e) => sum + (e.netPayable - e.paidAmount), 0);

        summaries.push({
            staffId: user.staffId,
            staffName: user.name,
            staffRole: user.role,
            totalOrders: orderIds.length,
            lastPaymentStatus: latestEntry?.paymentStatus || "none",
            lastPaymentDate: latestEntry?.paymentDate?.toDate() || null,
            pendingAmount: Math.max(pendingAmount, 0),
        });
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
        return role as StaffSalaryRole;
    }
    if (role === "aari") {
        return "aari";
    }
    return "monthly";
}

export function getSalaryTypeForRole(role: string): SalaryType {
    if (role === "stitching" || role === "stitching_checker") {
        return "weekly";
    }
    if (role === "aari") {
        return "weekly"; // Can be daily or weekly
    }
    return "monthly";
}
