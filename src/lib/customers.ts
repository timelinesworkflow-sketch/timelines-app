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
        activeOrders: 0,
        deliveredOrders: 0,
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
 * Get all customers - First try customers collection, if empty, build from orders
 */
export async function getAllCustomers(): Promise<Customer[]> {
    // First, try to get from customers collection
    const customersRef = collection(db, "customers");
    const customerSnapshot = await getDocs(customersRef);

    if (customerSnapshot.docs.length > 0) {
        return customerSnapshot.docs.map((doc) => ({
            ...doc.data(),
            phoneNumber: doc.id,
        })) as Customer[];
    }

    // If customers collection is empty, build from orders collection
    return buildCustomersFromOrders();
}

/**
 * Build customer data directly from orders collection
 * This reads ALL orders and groups them by customerPhone
 */
export async function buildCustomersFromOrders(): Promise<Customer[]> {
    const ordersRef = collection(db, "orders");
    const snapshot = await getDocs(ordersRef);

    // Group orders by customerPhone
    const customerMap = new Map<string, {
        name: string;
        address?: string;
        orders: Order[];
        totalRevenue: number;
        totalExpenses: number;
        lastOrderDate: any;
        createdAt: any;
    }>();

    snapshot.docs.forEach((doc) => {
        const order = doc.data() as Order;
        const phone = order.customerPhone;

        if (!phone) return; // Skip if no phone number

        if (!customerMap.has(phone)) {
            customerMap.set(phone, {
                name: order.customerName,
                address: order.customerAddress,
                orders: [],
                totalRevenue: 0,
                totalExpenses: 0,
                lastOrderDate: order.createdAt,
                createdAt: order.createdAt,
            });
        }

        const customer = customerMap.get(phone)!;
        customer.orders.push(order);
        customer.totalRevenue += order.price || 0;
        customer.totalExpenses += (order.labourCost || 0) + (order.materialCost || 0) + (order.extraExpenses || 0);

        // Update name if newer order has different name
        if (order.customerName) {
            customer.name = order.customerName;
        }

        // Track latest order date
        if (order.createdAt && order.createdAt.toMillis() > customer.lastOrderDate?.toMillis()) {
            customer.lastOrderDate = order.createdAt;
        }

        // Track earliest order date
        if (order.createdAt && order.createdAt.toMillis() < customer.createdAt?.toMillis()) {
            customer.createdAt = order.createdAt;
        }
    });

    // Convert map to Customer array
    const customers: Customer[] = [];
    customerMap.forEach((data, phoneNumber) => {
        const deliveredCount = data.orders.filter(o => o.status === "delivered").length;
        const activeCount = data.orders.length - deliveredCount;

        customers.push({
            phoneNumber,
            name: data.name || "Unknown",
            address: data.address,
            totalOrders: data.orders.length,
            activeOrders: activeCount,
            deliveredOrders: deliveredCount,
            totalRevenue: data.totalRevenue,
            totalExpenses: data.totalExpenses,
            totalProfit: data.totalRevenue - data.totalExpenses,
            orderIds: data.orders.map(o => o.orderId),
            lastOrderDate: data.lastOrderDate || Timestamp.now(),
            createdAt: data.createdAt || Timestamp.now(),
            updatedAt: Timestamp.now(),
        });
    });

    // Sort by lastOrderDate descending
    customers.sort((a, b) => b.lastOrderDate.toMillis() - a.lastOrderDate.toMillis());

    return customers;
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
 * Check if order can be edited
 * UPDATED: Allow editing ALL orders regardless of status
 * Only role-based permission matters (handled in UI component)
 */
export function canEditOrder(order: Order): boolean {
    // Allow editing ALL orders - no stage/status restrictions
    // The UI component handles role-based permissions
    return order !== null && order !== undefined;
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
