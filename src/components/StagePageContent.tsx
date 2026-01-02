"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Order, OrderItem, MEASUREMENT_LABELS, getSamplerImageUrl } from "@/types";
import { getOrdersForStage, updateOrder, addTimelineEntry, logStaffWork, getNextStage } from "@/lib/orders";
import { canViewCustomerInfo, getCustomerDisplayName } from "@/lib/privacy";
import { formatOrderProgress, ITEM_STAGES } from "@/lib/orderItems";
import { ArrowLeft, ArrowRight, Check, X as XIcon, Eye, Package, ChevronDown, ChevronUp } from "lucide-react";
import Toast from "@/components/Toast";
import { Timestamp } from "firebase/firestore";
import Image from "next/image";
import MaterialsView from "@/components/MaterialsView";

interface StagePageContentProps {
    stageName: string;
    stageDisplayName: string;
    /**
     * Custom content to render for the stage
     */
    renderStageContent?: (order: Order) => React.ReactNode;
    /**
     * Whether this is a checker stage (shows Approve/Reject instead of Complete)
     */
    isChecker?: boolean;
    /**
     * Previous stage to send back to if rejected
     */
    previousStage?: string;
}

export default function StagePageContent({
    stageName,
    stageDisplayName,
    renderStageContent,
    isChecker = false,
    previousStage,
}: StagePageContentProps) {
    const { userData } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
    const [showImageModal, setShowImageModal] = useState<string | null>(null);
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set([0]));

    // Privacy control - check if user can see customer info
    const canSeeCustomer = userData ? canViewCustomerInfo(userData.role) : false;

    useEffect(() => {
        loadOrders();
    }, []);

    const loadOrders = async () => {
        try {
            const ordersData = await getOrdersForStage(stageName, userData?.staffId);
            setOrders(ordersData);
        } catch (error) {
            console.error("Failed to load orders:", error);
            setToast({ message: "Failed to load orders", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const currentOrder = orders[currentIndex];

    const handleComplete = async () => {
        if (!currentOrder || !userData) return;

        setActionLoading(true);

        try {
            const nextStage = getNextStage(stageName, currentOrder.activeStages);

            await updateOrder(currentOrder.orderId, {
                currentStage: nextStage || "completed",
                status: nextStage ? "in_progress" : "completed",
            });

            await addTimelineEntry(currentOrder.orderId, {
                staffId: userData.staffId,
                role: userData.role,
                stage: stageName,
                action: "completed",
            });

            await logStaffWork({
                staffId: userData.staffId,
                firebaseUid: userData.email,
                email: userData.email,
                role: userData.role,
                orderId: currentOrder.orderId,
                stage: stageName,
                action: "completed",
            });

            setToast({ message: "Stage completed successfully!", type: "success" });

            // Move to next order
            const newOrders = orders.filter((_, idx) => idx !== currentIndex);
            setOrders(newOrders);
            if (currentIndex >= newOrders.length && currentIndex > 0) {
                setCurrentIndex(currentIndex - 1);
            }
        } catch (error) {
            console.error(error);
            setToast({ message: "Failed to complete stage", type: "error" });
        } finally {
            setActionLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!currentOrder || !userData) return;

        setActionLoading(true);

        try {
            const nextStage = getNextStage(stageName, currentOrder.activeStages);

            await updateOrder(currentOrder.orderId, {
                currentStage: nextStage || "completed",
                status: nextStage ? "in_progress" : "completed",
            });

            await addTimelineEntry(currentOrder.orderId, {
                staffId: userData.staffId,
                role: userData.role,
                stage: stageName,
                action: "checked_ok",
            });

            await logStaffWork({
                staffId: userData.staffId,
                firebaseUid: userData.email,
                email: userData.email,
                role: userData.role,
                orderId: currentOrder.orderId,
                stage: stageName,
                action: "checked_ok",
            });

            setToast({ message: "Approved successfully!", type: "success" });

            const newOrders = orders.filter((_, idx) => idx !== currentIndex);
            setOrders(newOrders);
            if (currentIndex >= newOrders.length && currentIndex > 0) {
                setCurrentIndex(currentIndex - 1);
            }
        } catch (error) {
            console.error(error);
            setToast({ message: "Failed to approve", type: "error" });
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!currentOrder || !userData || !previousStage) return;

        setActionLoading(true);

        try {
            await updateOrder(currentOrder.orderId, {
                currentStage: previousStage,
            });

            await addTimelineEntry(currentOrder.orderId, {
                staffId: userData.staffId,
                role: userData.role,
                stage: stageName,
                action: "checked_reject",
            });

            await logStaffWork({
                staffId: userData.staffId,
                firebaseUid: userData.email,
                email: userData.email,
                role: userData.role,
                orderId: currentOrder.orderId,
                stage: stageName,
                action: "checked_reject",
            });

            setToast({ message: "Sent back for rework", type: "info" });

            const newOrders = orders.filter((_, idx) => idx !== currentIndex);
            setOrders(newOrders);
            if (currentIndex >= newOrders.length && currentIndex > 0) {
                setCurrentIndex(currentIndex - 1);
            }
        } catch (error) {
            console.error(error);
            setToast({ message: "Failed to reject", type: "error" });
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <div className="card text-center py-12">
                <Check className="w-16 h-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    All Caught Up!
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                    No pending orders for {stageDisplayName}
                </p>
            </div>
        );
    }

    return (
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
                            {canSeeCustomer
                                ? `Order - ${currentOrder.customerName}`
                                : `Order #${currentOrder.orderId.slice(0, 8)}`}
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {currentIndex + 1} of {orders.length} orders
                            {currentOrder.items && currentOrder.items.length > 0 && (
                                <span className="ml-2 text-indigo-600">
                                    • {formatOrderProgress(currentOrder)}
                                </span>
                            )}
                        </p>
                    </div>
                    <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full text-sm font-medium capitalize">
                        {currentOrder.garmentType.replace(/_/g, " ")}
                    </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
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
                    {currentOrder.items && currentOrder.items.length > 0 && (
                        <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Items</p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                                {currentOrder.totalItems || currentOrder.items.length} items
                            </p>
                        </div>
                    )}
                </div>

                {/* Reference Images */}
                {currentOrder.samplerImages.length > 0 && (
                    <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Reference Images
                        </p>
                        <div className="flex space-x-2 overflow-x-auto">
                            {currentOrder.samplerImages.map((url, idx) => {
                                const imageUrl = getSamplerImageUrl(url);
                                return (
                                    <div
                                        key={idx}
                                        className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden cursor-pointer hover:opacity-75 transition-opacity"
                                        onClick={() => setShowImageModal(imageUrl)}
                                    >
                                        <img
                                            src={imageUrl}
                                            alt={`Reference ${idx + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                            <Eye className="w-5 h-5 text-white" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Measurements */}
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

                {/* Multi-Item Section */}
                {currentOrder.items && currentOrder.items.length > 0 && (
                    <div className="mt-4 border-t pt-4">
                        <div className="flex items-center space-x-2 mb-3">
                            <Package className="w-5 h-5 text-indigo-600" />
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Order Items ({currentOrder.items.length})
                            </p>
                        </div>
                        <div className="space-y-2">
                            {currentOrder.items.map((item: OrderItem, idx: number) => (
                                <div
                                    key={item.itemId}
                                    className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <span className="w-7 h-7 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">
                                                {idx + 1}
                                            </span>
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white text-sm">
                                                    {item.itemName || `Item ${idx + 1}`}
                                                </p>
                                                <div className="flex items-center space-x-2 text-xs text-gray-500">
                                                    <span className="capitalize">{item.garmentType?.replace(/_/g, " ")}</span>
                                                    <span>•</span>
                                                    <span>Qty: {item.quantity}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${item.status === 'delivered' ? 'bg-blue-100 text-blue-700' :
                                                item.status === 'ready' ? 'bg-green-100 text-green-700' :
                                                    item.status === 'qc' ? 'bg-purple-100 text-purple-700' :
                                                        'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {item.status}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Item measurements preview */}
                                    {item.measurements && Object.keys(item.measurements).length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                            {Object.entries(item.measurements).slice(0, 4).map(([key, value]) => (
                                                <span key={key} className="bg-white dark:bg-gray-700 px-2 py-1 rounded">
                                                    {MEASUREMENT_LABELS[key] || key}: {value}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Design notes */}
                                    {item.designNotes && (
                                        <p className="mt-2 text-xs text-gray-500 italic">
                                            Note: {item.designNotes}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Materials View (Read-only for non-materials stages) */}
                {currentOrder.materials && (
                    <MaterialsView order={currentOrder} />
                )}

                {/* Custom Stage Content */}
                {renderStageContent && (
                    <div className="mt-4">{renderStageContent(currentOrder)}</div>
                )}
            </div>

            {/* Navigation & Actions */}
            <div className="flex items-center justify-between space-x-4">
                <button
                    onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                    disabled={currentIndex === 0}
                    className="btn btn-outline disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Previous</span>
                </button>

                {isChecker ? (
                    <div className="flex space-x-3">
                        <button
                            onClick={handleReject}
                            disabled={actionLoading}
                            className="btn btn-danger flex items-center space-x-2"
                        >
                            <XIcon className="w-5 h-5" />
                            <span>Reject</span>
                        </button>
                        <button
                            onClick={handleApprove}
                            disabled={actionLoading}
                            className="btn bg-green-600 text-white hover:bg-green-700 flex items-center space-x-2"
                        >
                            <Check className="w-5 h-5" />
                            <span>Approve</span>
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={handleComplete}
                        disabled={actionLoading}
                        className="btn btn-primary flex items-center space-x-2"
                    >
                        <Check className="w-5 h-5" />
                        <span>{actionLoading ? "Completing..." : `Complete ${stageDisplayName}`}</span>
                    </button>
                )}

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
    );
}
