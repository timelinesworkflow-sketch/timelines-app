/**
 * Salary Management Library
 * Handles salary logs, advances, and daily wage tracking for Accounts module
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
import { SalaryLog, AdvanceLog, DailyWageLog, UserRole } from "@/types";

// ============================================
// SALARY LOGS
// ============================================

export async function getSalaryLogs(staffId?: string): Promise<SalaryLog[]> {
    try {
        // NO COMPOUND QUERY - fetch all, filter client-side to avoid index issues
        const snapshot = await getDocs(collection(db, "salaryLogs"));

        let logs = snapshot.docs.map(doc => ({
            ...doc.data(),
            salaryLogId: doc.id,
        })) as SalaryLog[];

        // Filter by staffId client-side
        if (staffId) {
            logs = logs.filter(l => l.staffId === staffId);
        }

        // Sort client-side (descending by creditedAt)
        return logs.sort((a, b) => {
            const aTime = a.creditedAt?.toMillis() || 0;
            const bTime = b.creditedAt?.toMillis() || 0;
            return bTime - aTime;
        });
    } catch (error) {
        console.error("Error fetching salary logs:", error);
        return [];
    }
}

export async function createSalaryLog(
    data: Omit<SalaryLog, "salaryLogId">
): Promise<string> {
    const docRef = await addDoc(collection(db, "salaryLogs"), data);
    return docRef.id;
}

export async function creditSalary(params: {
    staffId: string;
    staffName: string;
    role: UserRole;
    salaryType: "daily" | "weekly" | "monthly";
    periodStart: Date;
    periodEnd: Date;
    totalWage: number;
    advanceAmount: number;
    creditedById: string;
    creditedByName: string;
    creditedByRole: "accountant" | "admin";
    notes?: string;
}): Promise<string> {
    const netPaid = params.totalWage - params.advanceAmount;

    const salaryLog: Omit<SalaryLog, "salaryLogId"> = {
        staffId: params.staffId,
        staffName: params.staffName,
        role: params.role,
        salaryType: params.salaryType,
        periodStart: Timestamp.fromDate(params.periodStart),
        periodEnd: Timestamp.fromDate(params.periodEnd),
        totalWage: params.totalWage,
        advanceAmount: params.advanceAmount,
        netPaid,
        creditedByRole: params.creditedByRole,
        creditedById: params.creditedById,
        creditedByName: params.creditedByName,
        creditedAt: Timestamp.now(),
        status: "credited",
        notes: params.notes || "",
    };

    return await createSalaryLog(salaryLog);
}

// ============================================
// ADVANCE LOGS
// ============================================

export async function getAdvanceLogs(
    staffId?: string,
    startDate?: Date,
    endDate?: Date
): Promise<AdvanceLog[]> {
    try {
        // NO COMPOUND QUERY - fetch all, filter client-side to avoid index issues
        const snapshot = await getDocs(collection(db, "advanceLogs"));

        let logs = snapshot.docs.map(doc => ({
            ...doc.data(),
            advanceId: doc.id,
        })) as AdvanceLog[];

        // Filter by staffId client-side
        if (staffId) {
            logs = logs.filter(l => l.staffId === staffId);
        }

        // Filter by date range if provided
        if (startDate && endDate) {
            logs = logs.filter(log => {
                const logDate = log.date?.toDate();
                if (!logDate) return false;
                return logDate >= startDate && logDate <= endDate;
            });
        }

        // Sort client-side (descending by date)
        return logs.sort((a, b) => {
            const aTime = a.date?.toMillis() || 0;
            const bTime = b.date?.toMillis() || 0;
            return bTime - aTime;
        });
    } catch (error) {
        console.error("Error fetching advance logs:", error);
        return [];
    }
}

export async function createAdvanceLog(params: {
    staffId: string;
    staffName: string;
    amount: number;
    givenById: string;
    givenByName: string;
    givenByRole: "accountant" | "admin";
    notes?: string;
}): Promise<string> {
    const advanceLog: Omit<AdvanceLog, "advanceId"> = {
        staffId: params.staffId,
        staffName: params.staffName,
        amount: params.amount,
        date: Timestamp.now(),
        givenById: params.givenById,
        givenByName: params.givenByName,
        givenByRole: params.givenByRole,
        notes: params.notes || "",
        createdAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, "advanceLogs"), advanceLog);
    return docRef.id;
}

export async function getTotalAdvances(
    staffId: string,
    startDate: Date,
    endDate: Date
): Promise<number> {
    const advances = await getAdvanceLogs(staffId, startDate, endDate);
    return advances.reduce((sum, adv) => sum + adv.amount, 0);
}

// ============================================
// DAILY WAGE LOGS
// ============================================

export async function getDailyWageLogs(
    staffId?: string,
    startDate?: Date,
    endDate?: Date
): Promise<DailyWageLog[]> {
    try {
        // NO COMPOUND QUERY - fetch all, filter client-side to avoid index issues
        const snapshot = await getDocs(collection(db, "dailyWageLogs"));

        let logs = snapshot.docs.map(doc => ({
            ...doc.data(),
            wageLogId: doc.id,
        })) as DailyWageLog[];

        // Filter by staffId client-side
        if (staffId) {
            logs = logs.filter(l => l.staffId === staffId);
        }

        // Filter by date range if provided
        if (startDate && endDate) {
            logs = logs.filter(log => {
                const logDate = log.date?.toDate();
                if (!logDate) return false;
                return logDate >= startDate && logDate <= endDate;
            });
        }

        // Sort client-side (descending by date)
        return logs.sort((a, b) => {
            const aTime = a.date?.toMillis() || 0;
            const bTime = b.date?.toMillis() || 0;
            return bTime - aTime;
        });
    } catch (error) {
        console.error("Error fetching daily wage logs:", error);
        return [];
    }
}

export async function createDailyWageLog(params: {
    staffId: string;
    staffName: string;
    date: Date;
    ordersWorked: string[];
    wageAmount: number;
    loggedById: string;
    loggedByName: string;
    notes?: string;
}): Promise<string> {
    const wageLog: Omit<DailyWageLog, "wageLogId"> = {
        staffId: params.staffId,
        staffName: params.staffName,
        date: Timestamp.fromDate(params.date),
        ordersWorked: params.ordersWorked,
        wageAmount: params.wageAmount,
        loggedById: params.loggedById,
        loggedByName: params.loggedByName,
        loggedAt: Timestamp.now(),
        notes: params.notes || "",
    };

    const docRef = await addDoc(collection(db, "dailyWageLogs"), wageLog);
    return docRef.id;
}

export async function getTotalWages(
    staffId: string,
    startDate: Date,
    endDate: Date
): Promise<number> {
    const wages = await getDailyWageLogs(staffId, startDate, endDate);
    return wages.reduce((sum, wage) => sum + wage.wageAmount, 0);
}

// ============================================
// STAFF WORK SUMMARY
// ============================================

export async function getStaffWorkSummary(
    staffId: string,
    startDate: Date,
    endDate: Date
) {
    const [wages, advances, salaryLogs] = await Promise.all([
        getDailyWageLogs(staffId, startDate, endDate),
        getAdvanceLogs(staffId, startDate, endDate),
        getSalaryLogs(staffId),
    ]);

    const totalWages = wages.reduce((sum, w) => sum + w.wageAmount, 0);
    const totalAdvances = advances.reduce((sum, a) => sum + a.amount, 0);
    const netPayable = totalWages - totalAdvances;

    // Check if period is already credited
    const periodSalary = salaryLogs.find(log => {
        const start = log.periodStart.toDate();
        const end = log.periodEnd.toDate();
        return start.getTime() === startDate.getTime() && end.getTime() === endDate.getTime();
    });

    return {
        wages,
        advances,
        totalWages,
        totalAdvances,
        netPayable,
        isCredited: !!periodSalary,
        salaryLog: periodSalary || null,
    };
}

// ============================================
// WEEK HELPERS
// ============================================

export function getWeekDateRange(date: Date = new Date()): { start: Date; end: Date } {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    const start = new Date(date);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6); // Saturday end
    end.setHours(23, 59, 59, 999);

    return { start, end };
}

export function getMonthDateRange(date: Date = new Date()): { start: Date; end: Date } {
    const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
}
