/**
 * Staff/Users Utility Functions
 * 
 * IMPORTANT: This module is for STAFF-CENTRIC operations only.
 * It does NOT depend on workflow stages, orders, or stage assignments.
 * Used primarily by Accounts / Payroll module.
 */

import { db } from "@/lib/firebase";
import {
    collection,
    getDocs,
    query,
    where,
    doc,
    getDoc,
    updateDoc,
} from "firebase/firestore";
import { User } from "@/types";

// Staff role categories for salary management
export const STITCHING_ROLES = ["stitching", "stitching_checker"] as const;
export const AARI_ROLES = ["aari"] as const;
export const MONTHLY_SALARY_ROLES = [
    "supervisor",
    "intake",
    "materials",
    "purchase",
    "billing",
    "delivery",
    "accountant",
    "marking",
    "marking_checker",
    "cutting",
    "cutting_checker",
    "hooks",
    "ironing",
] as const;

/**
 * Get all active staff members from the users collection
 * Does NOT depend on any workflow/order logic
 * SIMPLE APPROACH: Just get ALL users, filter client-side
 */
export async function getAllActiveStaff(): Promise<User[]> {
    try {
        // Simple approach: Get ALL users, no Firestore filtering
        // This avoids any index or query issues
        const snapshot = await getDocs(collection(db, "users"));

        console.log("Fetched users count:", snapshot.docs.length);

        if (snapshot.docs.length === 0) {
            console.warn("No users found in Firestore users collection");
            return [];
        }

        // Filter client-side: include if isActive is true OR undefined (not explicitly false)
        const users = snapshot.docs
            .map(d => ({ ...d.data(), staffId: d.id } as User))
            .filter(user => user.isActive !== false);

        console.log("Active users after filter:", users.length);
        return users;

    } catch (error) {
        console.error("Error fetching active staff:", error);
        return [];
    }
}

/**
 * Get staff members by specific roles
 * Used by Accounts page for categorized staff lists
 */
export async function getStaffByRoles(roles: readonly string[]): Promise<User[]> {
    try {
        const allStaff = await getAllActiveStaff();
        return allStaff.filter(user => roles.includes(user.role));
    } catch (error) {
        console.error("Error fetching staff by roles:", error);
        return [];
    }
}

/**
 * Get stitching staff (weekly salary)
 */
export async function getStitchingStaff(): Promise<User[]> {
    return getStaffByRoles(STITCHING_ROLES);
}

/**
 * Get AARI workers (weekly salary)
 */
export async function getAariStaff(): Promise<User[]> {
    return getStaffByRoles(AARI_ROLES);
}

/**
 * Get monthly salary staff
 */
export async function getMonthlyStaff(): Promise<User[]> {
    return getStaffByRoles(MONTHLY_SALARY_ROLES);
}

/**
 * Get a single staff member by ID
 */
export async function getStaffById(staffId: string): Promise<User | null> {
    try {
        const userDoc = await getDoc(doc(db, "users", staffId));
        if (!userDoc.exists()) return null;
        return userDoc.data() as User;
    } catch (error) {
        console.error("Error fetching staff by ID:", error);
        return null;
    }
}

/**
 * Update staff member (admin only)
 */
export async function updateStaff(
    staffId: string,
    updates: Partial<User>
): Promise<void> {
    try {
        await updateDoc(doc(db, "users", staffId), updates);
    } catch (error) {
        console.error("Error updating staff:", error);
        throw error;
    }
}

/**
 * Get staff display info for dropdowns
 */
export async function getStaffForDropdown(
    roles?: readonly string[]
): Promise<{ staffId: string; name: string; role: string }[]> {
    try {
        const staff = roles ? await getStaffByRoles(roles) : await getAllActiveStaff();
        return staff.map(s => ({
            staffId: s.staffId,
            name: s.name,
            role: s.role,
        }));
    } catch (error) {
        console.error("Error fetching staff for dropdown:", error);
        return [];
    }
}
