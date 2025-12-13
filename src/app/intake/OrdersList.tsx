"use client";

import { useState, useEffect } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Order } from "@/types";
import { Package, Calendar, User } from "lucide-react";

export default function OrdersList() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadOrders();
    }, []);

    const loadOrders = async () => {
        try {
            const ordersRef = collection(db, "orders");
            const q = query(
                ordersRef,
                where("status", "in", ["draft", "otp_sent", "confirmed_locked", "in_progress"]),
                orderBy("createdAt", "desc")
            );

            const snapshot = await getDocs(q);
            const ordersData = snapshot.docs.map((doc) => doc.data() as Order);
            setOrders(ordersData);
        } catch (error) {
            console.error("Failed to load orders:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <div className="card text-center py-12">
                <Package className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600 dark:text-gray-400">No orders yet</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {orders.map((order) => (
                <div key={order.orderId} className="card hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {order.customerName}
                                </span>
                                <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${order.status === "confirmed_locked"
                                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                        : order.status === "otp_sent"
                                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                            : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                                        }`}
                                >
                                    {order.status.replace(/_/g, " ")}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <div className="flex items-center space-x-1">
                                    <User className="w-4 h-4" />
                                    <span>{order.customerPhone}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <Package className="w-4 h-4" />
                                    <span className="capitalize">{order.garmentType.replace(/_/g, " ")}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <Calendar className="w-4 h-4" />
                                    <span>Due: {order.dueDate.toDate().toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
