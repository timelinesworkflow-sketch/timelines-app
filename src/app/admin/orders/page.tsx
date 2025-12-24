"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Order, User } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { bulkAssignItems } from "@/lib/assignments";
import Link from "next/link";
import { Eye, Package, Users, Check, X } from "lucide-react";
import Toast from "@/components/Toast";

export default function AdminOrdersPage() {
    const { userData } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>("all");

    // Bulk assignment state
    const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
    const [staffList, setStaffList] = useState<{ staffId: string; name: string; role: string }[]>([]);
    const [showBulkAssign, setShowBulkAssign] = useState(false);
    const [selectedStaffId, setSelectedStaffId] = useState("");
    const [assigning, setAssigning] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

    useEffect(() => {
        loadOrders();
        loadStaffList();
    }, []);

    const loadOrders = async () => {
        try {
            const ordersRef = collection(db, "orders");
            const q = query(ordersRef, orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            const ordersData = snapshot.docs.map((doc) => doc.data() as Order);
            setOrders(ordersData);
        } catch (error) {
            console.error("Failed to load orders:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadStaffList = async () => {
        try {
            const usersSnapshot = await getDocs(collection(db, "users"));
            const staff = usersSnapshot.docs
                .map((doc) => doc.data() as User)
                .filter((user) => user.isActive)
                .map((user) => ({
                    staffId: user.staffId,
                    name: user.name,
                    role: user.role,
                }));
            setStaffList(staff);
        } catch (error) {
            console.error("Failed to load staff:", error);
        }
    };

    const toggleOrderSelection = (orderId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const newSelected = new Set(selectedOrders);
        if (newSelected.has(orderId)) {
            newSelected.delete(orderId);
        } else {
            newSelected.add(orderId);
        }
        setSelectedOrders(newSelected);
    };

    const handleBulkAssign = async () => {
        if (!selectedStaffId || !userData) return;

        const selectedStaff = staffList.find(s => s.staffId === selectedStaffId);
        if (!selectedStaff) return;

        setAssigning(true);
        try {
            // Create assignment entries for all selected orders (assign to the order itself)
            const assignments = Array.from(selectedOrders).map(orderId => ({
                orderId,
                itemId: orderId, // Using orderId as itemId for order-level assignment
                itemIndex: 0,
                currentStaffId: undefined,
                currentStaffName: undefined,
            }));

            const count = await bulkAssignItems(
                assignments,
                selectedStaff.staffId,
                selectedStaff.name,
                {
                    staffId: userData.staffId,
                    staffName: userData.name,
                    role: "admin",
                }
            );

            setToast({ message: `Assigned ${count} orders to ${selectedStaff.name}`, type: "success" });
            setShowBulkAssign(false);
            setSelectedOrders(new Set());
            setSelectedStaffId("");
            loadOrders();
        } catch (error) {
            console.error("Failed to bulk assign:", error);
            setToast({ message: "Failed to assign orders", type: "error" });
        } finally {
            setAssigning(false);
        }
    };

    const filteredOrders = filter === "all"
        ? orders
        : orders.filter((order) => order.status === filter);

    if (loading) {
        return (
            <ProtectedRoute allowedRoles={["admin"]}>
                <div className="page-container min-h-screen">
                    <TopBar />
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute allowedRoles={["admin"]}>
            <div className="page-container min-h-screen">
                <TopBar />

                <div className="page-content">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                                Orders Management
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400">
                                View and manage all orders
                            </p>
                        </div>

                        {/* Bulk Assign Button */}
                        {selectedOrders.size > 0 && (
                            <button
                                onClick={() => setShowBulkAssign(true)}
                                className="btn btn-primary flex items-center space-x-2"
                            >
                                <Users className="w-4 h-4" />
                                <span>Bulk Assign ({selectedOrders.size})</span>
                            </button>
                        )}
                    </div>

                    {/* Filter */}
                    <div className="card mb-6">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div>
                                <label className="label">Filter by Status</label>
                                <select
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    className="input max-w-xs"
                                >
                                    <option value="all">All Orders</option>
                                    <option value="draft">Draft</option>
                                    <option value="otp_sent">OTP Sent</option>
                                    <option value="confirmed_locked">Confirmed</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                    <option value="delivered">Delivered</option>
                                </select>
                            </div>
                            {selectedOrders.size > 0 && (
                                <button
                                    onClick={() => setSelectedOrders(new Set())}
                                    className="text-sm text-gray-500 hover:text-gray-700"
                                >
                                    Clear Selection
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Orders List */}
                    <div className="space-y-4">
                        {filteredOrders.length === 0 ? (
                            <div className="card text-center py-12">
                                <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                                <p className="text-gray-600 dark:text-gray-400">No orders found</p>
                            </div>
                        ) : (
                            filteredOrders.map((order) => (
                                <div
                                    key={order.orderId}
                                    className={`card hover:shadow-lg transition-shadow ${selectedOrders.has(order.orderId) ? "ring-2 ring-indigo-500" : ""
                                        }`}
                                >
                                    <div className="flex items-start">
                                        {/* Checkbox */}
                                        <div className="mr-4 flex-shrink-0">
                                            <button
                                                onClick={(e) => toggleOrderSelection(order.orderId, e)}
                                                className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${selectedOrders.has(order.orderId)
                                                        ? "bg-indigo-600 border-indigo-600 text-white"
                                                        : "border-gray-300 dark:border-gray-600 hover:border-indigo-400"
                                                    }`}
                                            >
                                                {selectedOrders.has(order.orderId) && <Check className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        <Link
                                            href={`/admin/orders/${order.orderId}`}
                                            className="flex-1"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-2 mb-2">
                                                        <span className="font-semibold text-gray-900 dark:text-white">
                                                            {order.customerName}
                                                        </span>
                                                        <span
                                                            className={`px-2 py-1 rounded-full text-xs font-medium ${order.status === "delivered"
                                                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                                : order.status === "in_progress"
                                                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                                                    : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                                                                }`}
                                                        >
                                                            {order.status.replace(/_/g, " ")}
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-600 dark:text-gray-400">
                                                        <p>{order.customerPhone}</p>
                                                        <p className="capitalize">{order.garmentType.replace(/_/g, " ")}</p>
                                                        <p>Due: {order.dueDate.toDate().toLocaleDateString()}</p>
                                                    </div>

                                                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                                                        Current Stage: <span className="capitalize font-medium">{order.currentStage.replace(/_/g, " ")}</span>
                                                    </p>
                                                </div>

                                                <Eye className="w-5 h-5 text-gray-400 ml-4" />
                                            </div>
                                        </Link>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Bulk Assign Modal */}
                {showBulkAssign && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    Bulk Assign Orders
                                </h3>
                                <button
                                    onClick={() => setShowBulkAssign(false)}
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                Assign {selectedOrders.size} order(s) to a staff member
                            </p>

                            <div className="mb-4">
                                <label className="label">Select Staff</label>
                                <select
                                    value={selectedStaffId}
                                    onChange={(e) => setSelectedStaffId(e.target.value)}
                                    className="input"
                                >
                                    <option value="">-- Select Staff --</option>
                                    {staffList.map((staff) => (
                                        <option key={staff.staffId} value={staff.staffId}>
                                            {staff.name} ({staff.staffId}) - {staff.role}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex space-x-3">
                                <button
                                    onClick={() => setShowBulkAssign(false)}
                                    className="btn btn-outline flex-1"
                                    disabled={assigning}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleBulkAssign}
                                    disabled={!selectedStaffId || assigning}
                                    className="btn btn-primary flex-1"
                                >
                                    {assigning ? "Assigning..." : "Assign"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </div>
        </ProtectedRoute>
    );
}
