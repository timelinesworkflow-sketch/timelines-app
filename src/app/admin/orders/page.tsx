"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Order } from "@/types";
import Link from "next/link";
import { Eye, Package } from "lucide-react";

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>("all");

    useEffect(() => {
        loadOrders();
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
                    <div className="mb-6">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Orders Management
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            View and manage all orders
                        </p>
                    </div>

                    {/* Filter */}
                    <div className="card mb-6">
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

                    {/* Orders List */}
                    <div className="space-y-4">
                        {filteredOrders.length === 0 ? (
                            <div className="card text-center py-12">
                                <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                                <p className="text-gray-600 dark:text-gray-400">No orders found</p>
                            </div>
                        ) : (
                            filteredOrders.map((order) => (
                                <Link
                                    key={order.orderId}
                                    href={`/admin/orders/${order.orderId}`}
                                    className="card hover:shadow-lg transition-shadow block"
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
                            ))
                        )}
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
