"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { Order } from "@/types";
import { getOrdersForStage, updateOrder, addTimelineEntry, logStaffWork, getNextStage } from "@/lib/orders";
import { Timestamp } from "firebase/firestore";
import {
    Palette,
    ArrowLeft,
    ArrowRight,
    Check,
    Clock,
    User,
    Phone,
    Ruler,
    Eye,
    Shirt
} from "lucide-react";
import Toast from "@/components/Toast";

export default function AariPage() {
    const { userData } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
    const [showOrderDetails, setShowOrderDetails] = useState(false);

    useEffect(() => {
        loadOrders();
    }, []);

    const loadOrders = async () => {
        try {
            const ordersData = await getOrdersForStage("aari_work");
            setOrders(ordersData);
        } catch (error) {
            console.error("Failed to load orders:", error);
            setToast({ message: "Failed to load orders", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const currentOrder = orders[currentIndex];

    const handleCompleteStage = async () => {
        if (!currentOrder || !userData) return;

        setActionLoading(true);
        try {
            const nextStage = getNextStage("aari_work", currentOrder.activeStages);
            if (!nextStage) {
                setToast({ message: "No next stage configured", type: "error" });
                setActionLoading(false);
                return;
            }

            await updateOrder(currentOrder.orderId, {
                currentStage: nextStage,
            });

            await addTimelineEntry(currentOrder.orderId, {
                staffId: userData.staffId,
                role: userData.role,
                stage: "aari_work",
                action: "completed"
            });

            await logStaffWork({
                staffId: userData.staffId,
                firebaseUid: userData.staffId,
                email: userData.email || "",
                role: "aari",
                orderId: currentOrder.orderId,
                stage: "aari_work",
                action: "completed"
            });

            setToast({ message: `Aari work completed! Order moved to ${nextStage}`, type: "success" });

            // Reload orders
            await loadOrders();
            if (currentIndex >= orders.length - 1) {
                setCurrentIndex(Math.max(0, orders.length - 2));
            }
        } catch (error) {
            console.error("Failed to complete stage:", error);
            setToast({ message: "Failed to complete stage", type: "error" });
        } finally {
            setActionLoading(false);
        }
    };

    const navigateOrder = (direction: "prev" | "next") => {
        if (direction === "prev" && currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        } else if (direction === "next" && currentIndex < orders.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    };

    if (loading) {
        return (
            <ProtectedRoute allowedRoles={["aari", "supervisor", "admin"]}>
                <div className="page-container min-h-screen">
                    <TopBar />
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute allowedRoles={["aari", "supervisor", "admin"]}>
            <div className="page-container min-h-screen">
                <TopBar />
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

                <div className="page-content">
                    {/* Header */}
                    <div className="mb-6">
                        <div className="flex items-center gap-3 mb-2">
                            <Palette className="w-8 h-8 text-purple-600" />
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                                Aari Work
                            </h1>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400">
                            Special embroidery and design work for Aari garments
                        </p>
                    </div>

                    {/* Order Counter */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Orders:</span>
                            <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full font-medium">
                                {orders.length}
                            </span>
                        </div>
                        {orders.length > 1 && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => navigateOrder("prev")}
                                    disabled={currentIndex === 0}
                                    className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700 disabled:opacity-50"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {currentIndex + 1} / {orders.length}
                                </span>
                                <button
                                    onClick={() => navigateOrder("next")}
                                    disabled={currentIndex === orders.length - 1}
                                    className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700 disabled:opacity-50"
                                >
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                    </div>

                    {orders.length === 0 ? (
                        <div className="card text-center py-12">
                            <Palette className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                            <p className="text-gray-600 dark:text-gray-400">No orders waiting for Aari work</p>
                            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                                Aari Blouse and Aari Pavada Sattai orders will appear here after cutting
                            </p>
                        </div>
                    ) : currentOrder && (
                        <div className="space-y-6">
                            {/* Customer Info Card */}
                            <div className="card">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <User className="w-5 h-5 text-purple-600" />
                                        Customer Details
                                    </h2>
                                    <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg text-sm font-medium capitalize">
                                        {currentOrder.garmentType.replace(/_/g, " ")}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Name</p>
                                        <p className="font-semibold text-gray-900 dark:text-white">{currentOrder.customerName}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Phone</p>
                                        <p className="font-semibold text-gray-900 dark:text-white">{currentOrder.customerPhone}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Due Date</p>
                                        <p className="font-semibold text-gray-900 dark:text-white">
                                            {currentOrder.dueDate?.toDate().toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Order ID</p>
                                        <p className="font-semibold text-gray-900 dark:text-white text-xs">
                                            {currentOrder.orderId.slice(-8)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Garment Info */}
                            <div className="card">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <Shirt className="w-5 h-5 text-purple-600" />
                                        Garment Details
                                    </h2>
                                    <button
                                        onClick={() => setShowOrderDetails(!showOrderDetails)}
                                        className="text-sm text-purple-600 dark:text-purple-400 flex items-center gap-1"
                                    >
                                        <Eye className="w-4 h-4" />
                                        {showOrderDetails ? "Hide" : "View"} Details
                                    </button>
                                </div>

                                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg mb-4">
                                    <p className="text-purple-800 dark:text-purple-300 font-medium">
                                        ✨ This is a <span className="font-bold capitalize">{currentOrder.garmentType.replace(/_/g, " ")}</span> order
                                        requiring special Aari work/embroidery.
                                    </p>
                                </div>

                                {showOrderDetails && currentOrder.measurements && (
                                    <div className="mt-4">
                                        <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                            <Ruler className="w-4 h-4" />
                                            Measurements
                                        </h3>
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                            {Object.entries(currentOrder.measurements).map(([key, value]) => (
                                                <div key={key} className="bg-gray-50 dark:bg-slate-700 px-3 py-2 rounded-lg">
                                                    <p className="text-xs text-gray-500 capitalize">{key.replace(/_/g, " ")}</p>
                                                    <p className="font-semibold text-gray-900 dark:text-white">{value || "-"}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Sampler Images */}
                                {currentOrder.samplerImages && currentOrder.samplerImages.length > 0 && (
                                    <div className="mt-4">
                                        <h3 className="font-medium text-gray-900 dark:text-white mb-3">Reference Images</h3>
                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                            {currentOrder.samplerImages.map((img, idx) => (
                                                <img
                                                    key={idx}
                                                    src={img}
                                                    alt={`Reference ${idx + 1}`}
                                                    className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200 dark:border-slate-600"
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Complete Button */}
                            <div className="card">
                                <button
                                    onClick={handleCompleteStage}
                                    disabled={actionLoading}
                                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 flex items-center justify-center gap-3 text-lg shadow-lg"
                                >
                                    {actionLoading ? (
                                        <>
                                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                                            Completing...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-6 h-6" />
                                            Complete Aari Work → Send to Stitching
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
