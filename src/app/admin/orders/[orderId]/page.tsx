"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { useParams } from "next/navigation";
import { doc, getDoc, collection, getDocs, query, orderBy as firestoreOrderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Order, OrderItem, TimelineEntry, STAGE_DISPLAY_NAMES, MEASUREMENT_LABELS } from "@/types";
import { formatOrderProgress } from "@/lib/orderItems";
import { ArrowLeft, Package, User, Calendar, Clock, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";

export default function OrderDetailPage() {
    const params = useParams();
    const orderId = params?.orderId as string;

    const [order, setOrder] = useState<Order | null>(null);
    const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set([0]));

    useEffect(() => {
        if (orderId) {
            loadOrderDetail();
        }
    }, [orderId]);

    const loadOrderDetail = async () => {
        try {
            const orderDoc = await getDoc(doc(db, "orders", orderId));
            if (orderDoc.exists()) {
                setOrder(orderDoc.data() as Order);
            }

            // Load timeline
            const timelineRef = collection(db, "orders", orderId, "timeline");
            const q = query(timelineRef, firestoreOrderBy("timestamp", "asc"));
            const snapshot = await getDocs(q);
            const timelineData = snapshot.docs.map((doc) => doc.data() as TimelineEntry);
            setTimeline(timelineData);
        } catch (error) {
            console.error("Failed to load order:", error);
        } finally {
            setLoading(false);
        }
    };

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

    if (!order) {
        return (
            <ProtectedRoute allowedRoles={["admin"]}>
                <div className="page-container min-h-screen">
                    <TopBar />
                    <div className="page-content">
                        <p className="text-gray-600 dark:text-gray-400">Order not found</p>
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
                    <Link href="/admin/orders" className="btn btn-outline mb-6 inline-flex items-center space-x-2">
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Orders</span>
                    </Link>

                    <div className="space-y-6">
                        {/* Order Info */}
                        <div className="card">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Order Details</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Customer Name</p>
                                    <p className="font-semibold text-gray-900 dark:text-white">{order.customerName}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Phone</p>
                                    <p className="font-semibold text-gray-900 dark:text-white">{order.customerPhone}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Garment Type</p>
                                    <p className="font-semibold text-gray-900 dark:text-white capitalize">
                                        {order.garmentType?.replace(/_/g, " ") || '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Due Date</p>
                                    <p className="font-semibold text-gray-900 dark:text-white">
                                        {order.dueDate.toDate().toLocaleDateString()}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                                    <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full text-sm font-medium">
                                        {order.status.replace(/_/g, " ")}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Current Stage</p>
                                    <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-sm font-medium capitalize">
                                        {order.currentStage.replace(/_/g, " ")}
                                    </span>
                                </div>
                                {order.items && order.items.length > 0 && (
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Overall Progress</p>
                                        <p className="font-semibold text-indigo-600">
                                            {formatOrderProgress(order)}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Items Breakdown (Multi-Item) */}
                        {order.items && order.items.length > 0 && (
                            <div className="card">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                                    <Package className="w-5 h-5 text-indigo-600" />
                                    <span>Item Breakdown ({order.items.length} items)</span>
                                </h3>
                                <div className="space-y-3">
                                    {order.items.map((item: OrderItem, idx: number) => (
                                        <div
                                            key={item.itemId}
                                            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                                        >
                                            {/* Item Header */}
                                            <div
                                                className="bg-gray-50 dark:bg-gray-800 px-4 py-3 flex items-center justify-between cursor-pointer"
                                                onClick={() => {
                                                    const newExpanded = new Set(expandedItems);
                                                    if (newExpanded.has(idx)) {
                                                        newExpanded.delete(idx);
                                                    } else {
                                                        newExpanded.add(idx);
                                                    }
                                                    setExpandedItems(newExpanded);
                                                }}
                                            >
                                                <div className="flex items-center space-x-3">
                                                    <span className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-full flex items-center justify-center text-sm font-bold">
                                                        {idx + 1}
                                                    </span>
                                                    <div>
                                                        <p className="font-medium text-gray-900 dark:text-white">
                                                            {item.itemName || `Item ${idx + 1}`}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {item.garmentType?.replace(/_/g, " ") || order.garmentType?.replace(/_/g, " ")} • Qty: {item.quantity}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${item.status === 'delivered' ? 'bg-blue-100 text-blue-700' :
                                                        item.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                            item.status === 'in_progress' ? 'bg-purple-100 text-purple-700' :
                                                                'bg-yellow-100 text-yellow-700'
                                                        }`}>
                                                        {item.status}
                                                    </span>
                                                    {expandedItems.has(idx) ? (
                                                        <ChevronUp className="w-5 h-5 text-gray-400" />
                                                    ) : (
                                                        <ChevronDown className="w-5 h-5 text-gray-400" />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Item Details (Expanded) */}
                                            {expandedItems.has(idx) && (
                                                <div className="p-4 space-y-4 bg-white dark:bg-gray-900">
                                                    {/* Costs */}
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                                        <div>
                                                            <p className="text-xs text-gray-500">Material Cost</p>
                                                            <p className="font-medium text-orange-600">₹{(item.materialCost || 0).toLocaleString()}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-500">Labour Cost</p>
                                                            <p className="font-medium text-purple-600">₹{(item.labourCost || 0).toLocaleString()}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-500">Deadline</p>
                                                            <p className="font-medium">{item.dueDate?.toDate().toLocaleDateString() || 'N/A'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-500">Handled By</p>
                                                            <p className="font-medium">{item.handledByName || item.handledBy || 'N/A'}</p>
                                                        </div>
                                                    </div>

                                                    {/* Measurements */}
                                                    {item.measurements && Object.keys(item.measurements).length > 0 && (
                                                        <div>
                                                            <p className="text-xs text-gray-500 mb-2">Measurements</p>
                                                            <div className="flex flex-wrap gap-2">
                                                                {Object.entries(item.measurements).map(([key, value]) => (
                                                                    <span key={key} className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                                                        {MEASUREMENT_LABELS[key] || key}: {value}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Design Notes */}
                                                    {item.designNotes && (
                                                        <div>
                                                            <p className="text-xs text-gray-500 mb-1">Design Notes</p>
                                                            <p className="text-sm text-gray-700 dark:text-gray-300 italic">{item.designNotes}</p>
                                                        </div>
                                                    )}

                                                    {/* Item Timeline */}
                                                    {item.timeline && item.timeline.length > 0 && (
                                                        <div>
                                                            <p className="text-xs text-gray-500 mb-2">Item Timeline</p>
                                                            <div className="space-y-2">
                                                                {item.timeline.map((entry, entryIdx) => (
                                                                    <div key={entryIdx} className="flex items-center space-x-2 text-xs">
                                                                        <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                                                                        <span className="capitalize font-medium">{entry.stage}</span>
                                                                        <span className="text-gray-500">by {entry.completedByName || entry.completedBy}</span>
                                                                        <span className="text-gray-400">{entry.completedAt?.toDate().toLocaleString()}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Reference Images */}
                                                    {item.referenceImages && item.referenceImages.length > 0 && (
                                                        <div>
                                                            <p className="text-xs text-gray-500 mb-2">Reference Images</p>
                                                            <div className="flex space-x-2 overflow-x-auto">
                                                                {item.referenceImages.map((img, imgIdx) => {
                                                                    // Handle both string (legacy) and ItemReferenceImage (new) formats
                                                                    const imageUrl = typeof img === 'string' ? img : img.imageUrl;
                                                                    const title = typeof img === 'string' ? `Reference ${imgIdx + 1}` : img.title;

                                                                    return (
                                                                        <div key={imgIdx} className="flex-shrink-0">
                                                                            <img
                                                                                src={imageUrl}
                                                                                alt={title}
                                                                                className="w-16 h-16 rounded object-cover"
                                                                            />
                                                                            {typeof img !== 'string' && img.title && (
                                                                                <p className="text-xs text-gray-500 mt-1 max-w-16 truncate">{img.title}</p>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Workflow Progress */}
                        <div className="card">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Workflow Progress</h3>
                            <div className="space-y-3">
                                {order.activeStages.map((stage) => {
                                    const staffId = order.assignedStaff[stage as keyof typeof order.assignedStaff];
                                    const isCompleted = timeline.some((t) => t.stage === stage && t.action === "completed");
                                    const isPending = order.currentStage === stage;

                                    return (
                                        <div
                                            key={stage}
                                            className={`p-3 rounded-lg ${isCompleted
                                                ? "bg-green-50 dark:bg-green-900/20"
                                                : isPending
                                                    ? "bg-blue-50 dark:bg-blue-900/20"
                                                    : "bg-gray-50 dark:bg-gray-800"
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium capitalize text-gray-900 dark:text-white">
                                                    {STAGE_DISPLAY_NAMES[stage] || stage}
                                                </span>
                                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                                    {isCompleted ? "✓ Completed" : isPending ? "In Progress" : "Pending"}
                                                </span>
                                            </div>
                                            {staffId && (
                                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                    Assigned to: {staffId}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Timeline */}
                        <div className="card">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                                <Clock className="w-5 h-5 mr-2" />
                                Timeline
                            </h3>
                            <div className="space-y-3">
                                {timeline.length === 0 ? (
                                    <p className="text-gray-600 dark:text-gray-400">No timeline entries yet</p>
                                ) : (
                                    timeline.map((entry, idx) => (
                                        <div key={idx} className="flex items-start space-x-3 pb-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
                                            <div className="flex-shrink-0 w-2 h-2 rounded-full bg-indigo-600 mt-2"></div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                                                    {entry.action.replace(/_/g, " ")} - {STAGE_DISPLAY_NAMES[entry.stage] || entry.stage}
                                                </p>
                                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                                    By {entry.staffId} • {entry.timestamp.toDate().toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Billing (if exists) */}
                        {order.billing && (
                            <div className="card">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Billing Summary</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">Marking Charges:</span>
                                        <span className="font-semibold text-gray-900 dark:text-white">₹{order.billing.markingCharges}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">Cutting Charges:</span>
                                        <span className="font-semibold text-gray-900 dark:text-white">₹{order.billing.cuttingCharges}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">Stitching Charges:</span>
                                        <span className="font-semibold text-gray-900 dark:text-white">₹{order.billing.stitchingCharges}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">Materials Cost:</span>
                                        <span className="font-semibold text-gray-900 dark:text-white">₹{order.billing.materialsCost}</span>
                                    </div>
                                    <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                                        <span className="font-semibold text-gray-900 dark:text-white">Final Amount:</span>
                                        <span className="font-bold text-indigo-600 dark:text-indigo-400 text-lg">
                                            ₹{order.billing.finalAmount}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">Payment Status:</span>
                                        <span className="capitalize font-medium">{order.billing.paymentStatus.replace(/_/g, " ")}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
