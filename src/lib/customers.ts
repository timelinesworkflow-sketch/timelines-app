/**
 * Customer Management Library
 * Handles customer CRUD operations and order grouping by phone number
 */

import { db } from "./firebase";
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp,
    updateDoc,
    increment,
    arrayUnion,
} from "firebase/firestore";
import { Customer, Order } from "@/types";

// ============================================
// CUSTOMER CRUD OPERATIONS
// ============================================

/**
 * Get or create customer by phone number
 */
export async function getOrCreateCustomer(
    phoneNumber: string,
    customerName: string,
    customerAddress?: string
): Promise<Customer> {
    const customerRef = doc(db, "customers", phoneNumber);
    const customerSnap = await getDoc(customerRef);

    if (customerSnap.exists()) {
        // Update name if different
        const existing = customerSnap.data() as Customer;
        if (existing.name !== customerName) {
            await updateDoc(customerRef, {
                name: customerName,
                address: customerAddress || existing.address,
                updatedAt: Timestamp.now(),
            });
        }
        return { ...existing, phoneNumber };
    }

    // Create new customer
    const newCustomer: Customer = {
        phoneNumber,
        name: customerName,
        address: customerAddress,
        totalOrders: 0,
        totalRevenue: 0,
        totalExpenses: 0,
        totalProfit: 0,
        orderIds: [],
        lastOrderDate: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    };

    await setDoc(customerRef, newCustomer);
    return newCustomer;
}

/**
 * Get customer by phone number
 */
export async function getCustomerByPhone(phoneNumber: string): Promise<Customer | null> {
    const customerRef = doc(db, "customers", phoneNumber);
    const customerSnap = await getDoc(customerRef);

    if (customerSnap.exists()) {
        return { ...customerSnap.data(), phoneNumber } as Customer;
    }
    return null;
}

/**
 * Get all customers
 */
export async function getAllCustomers(): Promise<Customer[]> {
    const customersRef = collection(db, "customers");
    const q = query(customersRef, orderBy("lastOrderDate", "desc"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
        ...doc.data(),
        phoneNumber: doc.id,
    })) as Customer[];
}

/**
 * Update customer stats when an order is placed
 */
export async function updateCustomerOnNewOrder(
    phoneNumber: string,
    orderId: string,
    price: number = 0,
    labourCost: number = 0,
    materialCost: number = 0,
    extraExpenses: number = 0
): Promise<void> {
    const customerRef = doc(db, "customers", phoneNumber);
    const expenses = labourCost + materialCost + extraExpenses;
    const profit = price - expenses;

    await updateDoc(customerRef, {
        totalOrders: increment(1),
        totalRevenue: increment(price),
        totalExpenses: increment(expenses),
        totalProfit: increment(profit),
        orderIds: arrayUnion(orderId),
        lastOrderDate: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
}

/**
 * Update customer stats when order is edited
 */
export async function updateCustomerOnOrderEdit(
    phoneNumber: string,
    oldPrice: number,
    newPrice: number,
    oldLabourCost: number,
    newLabourCost: number,
    oldMaterialCost: number,
    newMaterialCost: number,
    oldExtraExpenses: number,
    newExtraExpenses: number
): Promise<void> {
    const customerRef = doc(db, "customers", phoneNumber);

    const revenueDiff = newPrice - oldPrice;
    const expensesDiff = (newLabourCost + newMaterialCost + newExtraExpenses) -
        (oldLabourCost + oldMaterialCost + oldExtraExpenses);
    const profitDiff = revenueDiff - expensesDiff;

    await updateDoc(customerRef, {
        totalRevenue: increment(revenueDiff),
        totalExpenses: increment(expensesDiff),
        totalProfit: increment(profitDiff),
        updatedAt: Timestamp.now(),
    });
}

/**
 * Recalculate customer totals from all orders
 */
export async function recalculateCustomerTotals(phoneNumber: string): Promise<void> {
    const customerRef = doc(db, "customers", phoneNumber);

    // Get all orders for this customer
    const ordersRef = collection(db, "orders");
    const q = query(ordersRef, where("customerPhone", "==", phoneNumber));
    const snapshot = await getDocs(q);

    let totalOrders = 0;
    let totalRevenue = 0;
    let totalExpenses = 0;
    const orderIds: string[] = [];

    snapshot.docs.forEach((doc) => {
        const order = doc.data() as Order;
        totalOrders++;
        orderIds.push(order.orderId);
        totalRevenue += order.price || 0;
        totalExpenses += (order.labourCost || 0) + (order.materialCost || 0) + (order.extraExpenses || 0);
    });

    await updateDoc(customerRef, {
        totalOrders,
        totalRevenue,
        totalExpenses,
        totalProfit: totalRevenue - totalExpenses,
        orderIds,
        updatedAt: Timestamp.now(),
    });
}

// ============================================
// ORDER QUERIES BY CUSTOMER
// ============================================

/**
 * Get all orders for a customer by phone number
 */
export async function getOrdersByCustomerPhone(phoneNumber: string): Promise<Order[]> {
    const ordersRef = collection(db, "orders");
    const q = query(
        ordersRef,
        where("customerPhone", "==", phoneNumber),
        orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => doc.data() as Order);
}

/**
 * Check if order can be edited (only in intake stage)
 */
export function canEditOrder(order: Order): boolean {
    // Order can only be edited if it's still in intake or draft stage
    const editableStages = ["intake", "draft"];
    const editableStatuses = ["draft", "in_progress"];

    return (
        editableStages.includes(order.currentStage) &&
        editableStatuses.includes(order.status) &&
        order.currentStage !== "cutting" &&
        order.currentStage !== "materials"
    );
}

// ============================================
// CUSTOMER SEARCH & FILTERING
// ============================================

/**
 * Search customers by name or phone
 */
export async function searchCustomers(searchTerm: string): Promise<Customer[]> {
    const allCustomers = await getAllCustomers();
    const term = searchTerm.toLowerCase().trim();

    return allCustomers.filter((customer) =>
        customer.name.toLowerCase().includes(term) ||
        customer.phoneNumber.includes(term)
    );
}

/**
 * Get customers sorted by various criteria
 */
export async function getCustomersSorted(
    sortBy: "orders" | "revenue" | "recent" = "recent"
): Promise<Customer[]> {
    const customers = await getAllCustomers();

    switch (sortBy) {
        case "orders":
            return customers.sort((a, b) => b.totalOrders - a.totalOrders);
        case "revenue":
            return customers.sort((a, b) => b.totalRevenue - a.totalRevenue);
        case "recent":
        default:
            return customers.sort((a, b) =>
                b.lastOrderDate.toMillis() - a.lastOrderDate.toMillis()
            );
    }
}

/**
 * Get customer summary statistics
 */
export interface CustomerSummary {
    totalCustomers: number;
    totalOrders: number;
    totalRevenue: number;
    totalExpenses: number;
    totalProfit: number;
    averageOrderValue: number;
    topCustomers: Customer[];
}

export async function getCustomerSummary(): Promise<CustomerSummary> {
    const customers = await getAllCustomers();

    const totalCustomers = customers.length;
    const totalOrders = customers.reduce((sum, c) => sum + c.totalOrders, 0);
    const totalRevenue = customers.reduce((sum, c) => sum + c.totalRevenue, 0);
    const totalExpenses = customers.reduce((sum, c) => sum + c.totalExpenses, 0);
    const totalProfit = totalRevenue - totalExpenses;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const topCustomers = [...customers]
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 5);

    return {
        totalCustomers,
        totalOrders,
        totalRevenue,
        totalExpenses,
        totalProfit,
        averageOrderValue,
        topCustomers,
    };
}
