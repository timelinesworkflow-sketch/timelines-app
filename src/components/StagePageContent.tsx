"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Order, OrderItem, MEASUREMENT_LABELS, getSamplerImageUrl, WorkflowStage, ItemStatus, ItemReferenceImage } from "@/types";
import { getItemsForStage, updateItemStage, getNextWorkflowStage } from "@/lib/orderItems";
import { addTimelineEntry, logStaffWork } from "@/lib/orders";
import { canViewCustomerInfo } from "@/lib/privacy";
import { ArrowLeft, ArrowRight, Check, X as XIcon, Eye, Package, ChevronDown, ChevronUp, Image as ImageIcon } from "lucide-react";
import Toast from "@/components/Toast";
import MaterialsView from "@/components/MaterialsView";

interface StagePageContentProps {
    stageName: string;
    stageDisplayName: string;
    renderStageContent?: (item: OrderItem) => React.ReactNode;
    isChecker?: boolean;
    previousStage?: WorkflowStage;
}

export default function StagePageContent({
    stageName,
    stageDisplayName,
    renderStageContent,
    isChecker = false,
    previousStage,
}: StagePageContentProps) {
    const { userData } = useAuth();
    const [items, setItems] = useState<OrderItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
    const [showImageModal, setShowImageModal] = useState<string | null>(null);

    // Privacy control
    const canSeeCustomer = userData ? canViewCustomerInfo(userData.role) : false;

    useEffect(() => {
        loadItems();
    }, [stageName]);

    const loadItems = async () => {
        try {
            const itemsData = await getItemsForStage(stageName, userData?.staffId);
            setItems(itemsData);
        } catch (error) {
            console.error("Failed to load items:", error);
            setToast({ message: "Failed to load workflow items", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const currentItem = items[currentIndex];

    // Helper for Actions
    const handleAction = async (actionType: "complete" | "approve" | "reject") => {
        if (!currentItem || !userData) return;
        setActionLoading(true);
        try {
            let nextStage: WorkflowStage | null = null;
            let nextStatus: ItemStatus = "in_progress";

            if (actionType === "reject") {
                if (!previousStage) throw new Error("No previous stage defined for rejection");
                nextStage = previousStage;
                nextStatus = "in_progress"; // Or 'hold'
            } else {
                // Complete or Approve -> Move Forward
                nextStage = getNextWorkflowStage(currentItem);
            }

            if (!nextStage) {
                // Determine if finished
                if (actionType !== "reject") {
                    nextStatus = "completed"; // or 'ready'
                    nextStage = "completed";
                }
            }

            // If we are at 'delivery' stage and completing, it's 'delivered'
            if (currentItem.currentStage === 'delivery' && actionType === 'complete') {
                nextStatus = "delivered";
                nextStage = "completed"; // Workflow ends
            }

            if (!nextStage) throw new Error("Next stage could not be determined");

            await updateItemStage(
                currentItem.itemId,
                nextStage,
                nextStatus,
                userData.staffId,
                userData.name || "Staff"
            );

            // Log global work for salary/auditing
            await logStaffWork({
                staffId: userData.staffId,
                firebaseUid: userData.email, // using email as uid per current pattern
                email: userData.email,
                role: userData.role,
                orderId: currentItem.orderId,
                stage: stageName,
                action: actionType === "reject" ? "checked_reject" : (isChecker ? "checked_ok" : "completed"),
                // We add itemId implicitly to context if logic changes, but standard log uses orderId
            });

            // Add timeline entry
            await addTimelineEntry(currentItem.orderId, {
                staffId: userData.staffId,
                role: userData.role,
                stage: stageName,
                action: actionType === "reject" ? "checked_reject" : (isChecker ? "checked_ok" : "completed"),
            });

            setToast({
                message: actionType === "reject" ? "Item rejected" : "Item completed successfully",
                type: actionType === "reject" ? "info" : "success"
            });

            // Remove item from list
            const newItems = items.filter((_, idx) => idx !== currentIndex);
            setItems(newItems);
            if (currentIndex >= newItems.length && currentIndex > 0) {
                setCurrentIndex(currentIndex - 1);
            }

        } catch (error) {
            console.error(error);
            setToast({ message: `Failed to ${actionType}`, type: "error" });
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

    if (items.length === 0) {
        return (
            <div className="card text-center py-12">
                <Check className="w-16 h-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">All Caught Up!</h3>
                <p className="text-gray-600 dark:text-gray-400">No pending items for {stageDisplayName}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Image Modal */}
            {showImageModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowImageModal(null)}>
                    <div className="relative max-w-4xl w-full">
                        <button className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 rounded-full p-2" onClick={() => setShowImageModal(null)}>
                            <XIcon className="w-6 h-6 text-white" />
                        </button>
                        <img src={showImageModal} alt="Full size" className="w-full h-auto rounded-lg" />
                    </div>
                </div>
            )}

            {/* Item Card */}
            <div className="card border-2 border-indigo-50 dark:border-indigo-900/20">
                {/* Header Info */}
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-gray-100 dark:border-gray-700 pb-4 mb-4">
                    <div>
                        <div className="flex items-center space-x-2 mb-1">
                            <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                {currentIndex + 1}
                            </span>
                            <span className="text-sm text-gray-500 font-medium uppercase tracking-wide">
                                {currentIndex + 1} of {items.length} Items
                            </span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            {canSeeCustomer ? currentItem.customerName : "Customer"}
                            <span className="text-gray-300 dark:text-gray-600">/</span>
                            <span className="text-indigo-600 dark:text-indigo-400">{currentItem.itemName || "Item"}</span>
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            ID: <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">{currentItem.itemId}</span>
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="inline-flex flex-col items-end">
                            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold uppercase mb-1">
                                {currentItem.garmentType}
                            </span>
                            <span className="text-xs text-gray-500 font-medium">
                                Due: {currentItem.dueDate?.toDate().toLocaleDateString() || "No Date"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Content Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* Left Column: Specifications */}
                    <div className="space-y-6">

                        {/* Design Design/Specs/Measurements */}
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white border-b pb-2 mb-3 flex items-center gap-2">
                                {currentItem.measurementType === 'measurement_garment' ? <ImageIcon className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                                <span>Specification Mode: {currentItem.measurementType === 'measurement_garment' ? 'Pattern Garment' : 'Measurements'}</span>
                            </h3>

                            {currentItem.measurementType === 'measurements' ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {currentItem.measurements && Object.entries(currentItem.measurements).map(([key, value]) => (
                                        <div key={key} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{MEASUREMENT_LABELS[key] || key}</p>
                                            <p className="font-mono font-semibold text-gray-900 dark:text-white text-lg">{value}</p>
                                        </div>
                                    ))}
                                    {(!currentItem.measurements || Object.keys(currentItem.measurements).length === 0) && (
                                        <p className="text-gray-500 text-sm italic col-span-full">No measurements recorded.</p>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800">
                                    <p className="text-indigo-800 dark:text-indigo-300 font-medium mb-2">Follow Pattern Garment</p>
                                    <p className="text-sm text-indigo-600 dark:text-indigo-400">
                                        Refer to the attached images for pattern and design details.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Design Notes */}
                        {currentItem.designNotes && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-100 dark:border-amber-800">
                                <h4 className="text-amber-800 dark:text-amber-300 font-bold text-xs uppercase mb-2">Design Notes</h4>
                                <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed">{currentItem.designNotes}</p>
                            </div>
                        )}

                        {/* Custom Stage Content Injection */}
                        {renderStageContent && (
                            <div className="pt-4 border-t">
                                {renderStageContent(currentItem)}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Reference Images */}
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white border-b pb-2 mb-3 flex items-center gap-2">
                            <Eye className="w-4 h-4" />
                            <span>Reference Images ({Array.isArray(currentItem.referenceImages) ? currentItem.referenceImages.length : 0})</span>
                        </h3>

                        {(Array.isArray(currentItem.referenceImages) && currentItem.referenceImages.length > 0) ? (
                            <div className="grid grid-cols-2 gap-3">
                                {currentItem.referenceImages.map((img, idx) => {
                                    // Handle both string URLs (legacy) and object (new)
                                    const url = typeof img === 'string' ? img : img.imageUrl;
                                    const title = typeof img === 'string' ? `Image ${idx + 1}` : img.title;
                                    const desc = typeof img === 'string' ? null : img.description;

                                    return (
                                        <div key={idx} className="group relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer shadow-sm hover:shadow-md transition-shadow" onClick={() => setShowImageModal(url)}>
                                            <img src={url} alt={title} className="w-full h-40 object-cover" />
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                                                <p className="text-white text-xs font-medium truncate">{title}</p>
                                                {desc && <p className="text-gray-300 text-[10px] truncate">{desc}</p>}
                                            </div>
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                <Eye className="w-8 h-8 text-white drop-shadow-md" />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                                <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                <p className="text-sm text-gray-500">No reference images attached.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Navigation & Actions */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                    disabled={currentIndex === 0}
                    className="btn btn-outline disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Previous Item</span>
                </button>

                {isChecker ? (
                    <div className="flex space-x-3">
                        <button
                            onClick={() => handleAction("reject")}
                            disabled={actionLoading}
                            className="btn btn-danger flex items-center space-x-2 px-6"
                        >
                            <XIcon className="w-5 h-5" />
                            <span>Reject Item</span>
                        </button>
                        <button
                            onClick={() => handleAction("approve")}
                            disabled={actionLoading}
                            className="btn bg-green-600 text-white hover:bg-green-700 flex items-center space-x-2 px-6"
                        >
                            <Check className="w-5 h-5" />
                            <span>Approve Item</span>
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => handleAction("complete")}
                        disabled={actionLoading}
                        className="btn btn-primary flex items-center space-x-2 px-6 shadow-lg shadow-indigo-500/30"
                    >
                        {actionLoading ? (
                            <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                        ) : (
                            <Check className="w-5 h-5" />
                        )}
                        <span>Complete Stage for Item</span>
                    </button>
                )}

                <button
                    onClick={() => setCurrentIndex(Math.min(items.length - 1, currentIndex + 1))}
                    disabled={currentIndex === items.length - 1}
                    className="btn btn-outline disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                    <span className="hidden sm:inline">Next Item</span>
                    <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
