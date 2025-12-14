"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Order, MaterialItem } from "@/types";
import { getOrdersForStage, updateOrder, addTimelineEntry, logStaffWork, getNextStage } from "@/lib/orders";
import { ArrowLeft, ArrowRight, Check, Eye, X as XIcon } from "lucide-react";
import Toast from "@/components/Toast";
import { Timestamp } from "firebase/firestore";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import MaterialsInput from "@/components/MaterialsInput";
import { MEASUREMENT_LABELS } from "@/types";

export default function MaterialsPage() {
    const { userData } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
    const [showImageModal, setShowImageModal] = useState<string | null>(null);

    useEffect(() => {
        loadOrders();
    }, []);

    const loadOrders = async () => {
        try {
            const ordersData = await getOrdersForStage("materials", userData?.staffId);
            setOrders(ordersData);
        } catch (error) {
            console.error("Failed to load orders:", error);
            setToast({ message: "Failed to load orders", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const currentOrder = orders[currentIndex];

    const handleCompleteMaterials = async (items: MaterialItem[], totalCost: number, totalLength: number) => {
        if (!currentOrder || !userData) return;

        setActionLoading(true);

        try {
            const nextStage = getNextStage("materials", currentOrder.activeStages);

            // Update order with materials data
            await updateOrder(currentOrder.orderId, {
                currentStage: nextStage || "completed",
                status: nextStage ? "in_progress" : "completed",
                materials: {
                    items,
                    totalCost,
                    totalLength,
                    completedByStaffId: userData.staffId,
                    completedByStaffName: userData.name,
                    completedAt: Timestamp.now(),
                },
            });

            // Add timeline entry
            await addTimelineEntry(currentOrder.orderId, {
                staffId: userData.staffId,
                role: userData.role,
                stage: "materials",
                action: "completed",
            });

            // Log staff work
            await logStaffWork({
                staffId: userData.staffId,
                firebaseUid: userData.email,
                email: userData.email,
                role: userData.role,
                orderId: currentOrder.orderId,
                stage: "materials",
                action: "completed",
            });

            setToast({ message: "Materials stage completed successfully!", type: "success" });

            // Move to next order
            const newOrders = orders.filter((_, idx) => idx !== currentIndex);
            setOrders(newOrders);
            if (currentIndex >= newOrders.length && currentIndex > 0) {
                setCurrentIndex(currentIndex - 1);
            }
        } catch (error) {
            console.error(error);
            setToast({ message: "Failed to complete materials stage", type: "error" });
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <ProtectedRoute allowedRoles={["materials", "supervisor", "admin"]}>
                <div className="page-container min-h-screen">
                    <TopBar />
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    if (orders.length === 0) {
        return (
            <ProtectedRoute allowedRoles={["materials", "supervisor", "admin"]}>
                <div className="page-container min-h-screen">
                    <TopBar />
                    <div className="page-content">
                        <div className="mb-6">
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                                Materials
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400">
                                Manage materials for pending orders
                            </p>
                        </div>
                        <div className="card text-center py-12">
                            <Check className="w-16 h-16 mx-auto text-green-500 mb-4" />
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                All Caught Up!
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                No pending orders for Materials
                            </p>
                        </div>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute allowedRoles={["materials", "supervisor", "admin"]}>
            <div className="page-container min-h-screen">
                <TopBar />

                <div className="page-content">
                    <div className="mb-6">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Materials
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Enter material requirements and costs
                        </p>
                    </div>

                    <div className="space-y-6">
                        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

                        {/* Image Modal */}
                        {showImageModal && (
                            <div
                                className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                                onClick={() => setShowImageModal(null)}
                            >
                                <div className="relative max-w-4xl w-full">
                                    <button
                                        className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 rounded-full p-2"
                                        onClick={() => setShowImageModal(null)}
                                    >
                                        <XIcon className="w-6 h-6 text-white" />
                                    </button>
                                    <img
                                        src={showImageModal}
                                        alt="Full size"
                                        className="w-full h-auto rounded-lg"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Order Info Card */}
                        <div className="card">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                        Order #{currentOrder.customerId}
                                    </h2>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {currentIndex + 1} of {orders.length} orders
                                    </p>
                                </div>
                                <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full text-sm font-medium capitalize">
                                    {currentOrder.garmentType.replace(/_/g, " ")}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">Due Date</p>
                                    <p className="font-semibold text-gray-900 dark:text-white">
                                        {currentOrder.dueDate.toDate().toLocaleDateString()}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">Order ID</p>
                                    <p className="font-semibold text-gray-900 dark:text-white text-sm">
                                        {currentOrder.orderId.slice(0, 8)}...
                                    </p>
                                </div>
                            </div>

                            {/* Reference Images */}
                            {currentOrder.samplerImages.length > 0 && (
                                <div className="mb-4">
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Reference Images
                                    </p>
                                    <div className="flex space-x-2 overflow-x-auto">
                                        {currentOrder.samplerImages.map((url, idx) => (
                                            <div
                                                key={idx}
                                                className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden cursor-pointer hover:opacity-75 transition-opacity"
                                                onClick={() => setShowImageModal(url)}
                                            >
                                                <img
                                                    src={url}
                                                    alt={`Reference ${idx + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                                    <Eye className="w-5 h-5 text-white" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Measurements (Read-only) */}
                            <div>
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Measurements
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                                    {Object.entries(currentOrder.measurements).map(([key, value]) => (
                                        <div key={key} className="bg-gray-50 dark:bg-gray-800 rounded p-2">
                                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                                {MEASUREMENT_LABELS[key] || key}
                                            </p>
                                            <p className="font-semibold text-gray-900 dark:text-white">{value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Materials Input Section */}
                            <MaterialsInput
                                order={currentOrder}
                                onComplete={handleCompleteMaterials}
                                loading={actionLoading}
                            />
                        </div>

                        {/* Navigation */}
                        <div className="flex items-center justify-between space-x-4">
                            <button
                                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                                disabled={currentIndex === 0}
                                className="btn btn-outline disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span>Previous</span>
                            </button>

                            <button
                                onClick={() => setCurrentIndex(Math.min(orders.length - 1, currentIndex + 1))}
                                disabled={currentIndex === orders.length - 1}
                                className="btn btn-outline disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                            >
                                <span>Next</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
