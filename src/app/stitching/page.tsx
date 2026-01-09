"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Order, StitchingTask, User, getGarmentDisplayName, OrderItem } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import {
    getStitchingTasksForOrder,
    generateStitchingTasksForOrder,
    startStitchingTask,
    completeStitchingTask,
    assignStitchingTask,
} from "@/lib/stitchingTemplates";
import { getNextStage, addTimelineEntry, logStaffWork } from "@/lib/orders";
import { getItemsForOrder } from "@/lib/orderItems";
import { ClipboardList, Play, Check, User as UserIcon, RefreshCw, AlertCircle, Calendar, Package, FileText } from "lucide-react";
import Toast from "@/components/Toast";
import JobSheetButton from "@/components/JobSheetButton";

interface OrderWithTasks {
    order: Order;
    tasks: StitchingTask[];
    items: OrderItem[];
}

export default function StitchingPage() {
    const { userData } = useAuth();
    const [ordersWithTasks, setOrdersWithTasks] = useState<OrderWithTasks[]>([]);
    const [staffList, setStaffList] = useState<{ staffId: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

    const isStitchingStaff = userData?.role === "stitching";
    const canAssign = userData?.role === "admin" || userData?.role === "supervisor" || userData?.role === "stitching_checker";

    useEffect(() => {
        loadData();
    }, [userData]);

    const loadData = async () => {
        if (!userData) return;

        setLoading(true);
        try {
            // Load staff list for assignment
            if (canAssign) {
                const usersSnapshot = await getDocs(collection(db, "users"));
                const staff = usersSnapshot.docs
                    .map((docSnap) => docSnap.data() as User)
                    .filter((u) => u.isActive && (u.role === "stitching" || u.role === "stitching_checker"))
                    .map((u) => ({ staffId: u.staffId, name: u.name }));
                setStaffList(staff);
            }

            // Get orders currently in stitching stage
            const ordersSnapshot = await getDocs(collection(db, "orders"));
            const orders = ordersSnapshot.docs
                .map((docSnap) => ({ orderId: docSnap.id, ...docSnap.data() } as Order))
                .filter((o) => o.currentStage === "stitching");

            const ordersWithTasksData: OrderWithTasks[] = [];
            for (const order of orders) {
                let tasks = await getStitchingTasksForOrder(order.orderId);

                // Generate tasks if none exist and garmentType is defined
                if (tasks.length === 0 && order.garmentType) {
                    tasks = await generateStitchingTasksForOrder(order.orderId, order.garmentType);
                }

                // Fetch items for this order
                const items = await getItemsForOrder(order.orderId);

                ordersWithTasksData.push({ order, tasks, items });
            }

            // Sort by due date
            ordersWithTasksData.sort((a, b) => {
                const aDate = a.order.dueDate?.toDate?.() || new Date();
                const bDate = b.order.dueDate?.toDate?.() || new Date();
                return aDate.getTime() - bDate.getTime();
            });

            setOrdersWithTasks(ordersWithTasksData);
        } catch (error) {
            console.error("Failed to load data:", error);
            setToast({ message: "Failed to load tasks", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleStartTask = async (taskId: string) => {
        setActionLoading(taskId);
        try {
            await startStitchingTask(taskId);
            setToast({ message: "Task started!", type: "success" });
            loadData();
        } catch (error) {
            console.error("Failed to start task:", error);
            setToast({ message: "Failed to start task", type: "error" });
        } finally {
            setActionLoading(null);
        }
    };

    const handleCompleteTask = async (taskId: string) => {
        setActionLoading(taskId);
        try {
            await completeStitchingTask(taskId);
            setToast({ message: "Task completed!", type: "success" });
            loadData();
        } catch (error) {
            console.error("Failed to complete task:", error);
            setToast({ message: "Failed to complete task", type: "error" });
        } finally {
            setActionLoading(null);
        }
    };

    const handleAssignTask = async (taskId: string, staffId: string, orderId: string) => {
        const staff = staffList.find(s => s.staffId === staffId);
        if (!staff || !userData) return;

        setActionLoading(taskId);
        try {
            await assignStitchingTask(
                taskId,
                orderId,
                staffId,
                staff.name,
                {
                    staffId: userData.staffId,
                    staffName: userData.name,
                    role: userData.role as "admin" | "supervisor"
                }
            );
            setToast({ message: `Assigned to ${staff.name}`, type: "success" });
            loadData();
        } catch (error) {
            console.error("Failed to assign task:", error);
            setToast({ message: "Failed to assign task", type: "error" });
        } finally {
            setActionLoading(null);
        }
    };

    const handleCompleteStitching = async (orderId: string, activeStages: string[]) => {
        setActionLoading(orderId);
        try {
            const nextStage = getNextStage("stitching", activeStages);

            await addTimelineEntry(orderId, {
                staffId: userData?.staffId || "unknown",
                role: "stitching",
                stage: "stitching",
                action: "completed"
            });

            await logStaffWork({
                staffId: userData?.staffId || "unknown",
                firebaseUid: userData?.staffId || "unknown",
                email: userData?.email || "",
                role: "stitching",
                orderId,
                stage: "stitching",
                action: "completed"
            });

            const updateData: Partial<Order> = {
                currentStage: nextStage || "ironing"
            };

            const { updateOrder } = await import("@/lib/orders");
            await updateOrder(orderId, updateData);

            setToast({ message: `Stitching complete! Order moved to ${nextStage || "ironing"}`, type: "success" });
            loadData();
        } catch (error) {
            console.error("Failed to complete stitching:", error);
            setToast({ message: "Failed to complete stitching", type: "error" });
        } finally {
            setActionLoading(null);
        }
    };

    const handleUpdateNotes = async (itemId: string, field: "itemNotes" | "machinemanNotes", value: string) => {
        try {
            const { updateItem } = await import("@/lib/orderItems");
            await updateItem(itemId, { [field]: value });
            // local update
            setOrdersWithTasks(orders => orders.map(o => ({
                ...o,
                items: o.items.map(item => item.itemId === itemId ? { ...item, [field]: value } : item)
            })));
            setToast({ message: "Notes updated!", type: "success" });
        } catch (error) {
            console.error("Failed to update notes:", error);
            setToast({ message: "Failed to update notes", type: "error" });
        }
    };

    const getStatusConfig = (status: string) => {
        const configs: Record<string, { bg: string; text: string; label: string }> = {
            not_started: { bg: "bg-slate-700", text: "text-slate-300", label: "Not Started" },
            in_progress: { bg: "bg-blue-700", text: "text-blue-100", label: "In Progress" },
            completed: { bg: "bg-green-700", text: "text-green-100", label: "Awaiting Review" },
            needs_rework: { bg: "bg-red-700", text: "text-red-100", label: "Needs Rework" },
            approved: { bg: "bg-emerald-700", text: "text-emerald-100", label: "Approved" },
        };
        return configs[status] || configs.not_started;
    };

    const getDueDateStatus = (dueDate: any) => {
        if (!dueDate) return { color: "text-slate-500", label: "No due date" };
        const due = dueDate?.toDate?.() || new Date(dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diff < 0) return { color: "text-red-400", label: "Overdue" };
        if (diff === 0) return { color: "text-orange-400", label: "Due Today" };
        if (diff <= 2) return { color: "text-orange-300", label: `Due in ${diff}d` };
        return { color: "text-slate-400", label: `${diff}d` };
    };

    return (
        <ProtectedRoute allowedRoles={["stitching", "stitching_checker", "supervisor", "admin"]}>
            <div className="min-h-screen bg-slate-900">
                <TopBar />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    {/* Header */}
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h1 className="text-xl font-bold text-gray-200 flex items-center gap-2">
                                    <ClipboardList className="w-6 h-6 text-green-400" />
                                    Stitching Tasks
                                </h1>
                                <p className="text-sm text-slate-400 mt-1">
                                    {isStitchingStaff
                                        ? "Manage your assigned stitching tasks"
                                        : "Monitor all active stitching tasks"}
                                </p>
                            </div>
                            <button
                                onClick={loadData}
                                disabled={loading}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 text-gray-200 rounded-lg hover:bg-slate-600 transition-colors font-medium text-sm"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                                Refresh
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-4 border-green-500 border-t-transparent mx-auto"></div>
                            <p className="text-slate-400 mt-4">Loading orders...</p>
                        </div>
                    ) : ordersWithTasks.length === 0 ? (
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
                            <AlertCircle className="w-12 h-12 mx-auto text-slate-500 mb-4" />
                            <h3 className="text-lg font-medium text-gray-200 mb-2">No active stitching orders</h3>
                            <p className="text-slate-400">Orders will appear here once they complete the cutting stage.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {ordersWithTasks.map(({ order, tasks, items }) => {
                                const dueStatus = getDueDateStatus(order.dueDate);
                                const allTasksApproved = tasks.every(t => t.status === "approved");

                                return (
                                    <div key={order.orderId} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                                        {/* Order Header */}
                                        <div className="bg-slate-750 px-4 py-3 border-b border-slate-700">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                <div className="flex items-center gap-3">
                                                    <Package className="w-5 h-5 text-slate-400" />
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="font-semibold text-gray-200">
                                                                {order.customerName}
                                                            </h3>
                                                            <span className="text-xs font-mono bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                                                                #{order.orderId.slice(0, 8)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-3 mt-1 text-sm">
                                                            <span className="text-slate-400 capitalize">
                                                                {getGarmentDisplayName(order)}
                                                            </span>
                                                            <span className={`flex items-center gap-1 ${dueStatus.color}`}>
                                                                <Calendar className="w-3 h-3" />
                                                                {dueStatus.label}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-3">
                                                    <div className="flex flex-wrap gap-2 justify-center">
                                                        {items.map((item, idx, arr) => (
                                                            <div key={item.itemId} className="flex flex-col gap-2 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50 w-full">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-xs font-bold text-cyan-500">Item {idx + 1}: {item.itemName}</span>
                                                                    <JobSheetButton
                                                                        item={item}
                                                                        stageName="stitching"
                                                                        stageDisplayName="Stitching"
                                                                        itemIndex={idx}
                                                                        totalItems={arr.length}
                                                                    />
                                                                </div>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                    <div>
                                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Item Notes</label>
                                                                        <textarea
                                                                            defaultValue={item.itemNotes || ""}
                                                                            onBlur={(e) => handleUpdateNotes(item.itemId, "itemNotes", e.target.value)}
                                                                            placeholder="Enter item notes..."
                                                                            className="w-full h-12 p-2 text-xs bg-slate-900 border border-slate-700 rounded focus:ring-1 focus:ring-cyan-500 outline-none resize-none text-white"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Machineman Notes</label>
                                                                        <textarea
                                                                            defaultValue={item.machinemanNotes || ""}
                                                                            onBlur={(e) => handleUpdateNotes(item.itemId, "machinemanNotes", e.target.value)}
                                                                            placeholder="Enter notes for machineman..."
                                                                            className="w-full h-12 p-2 text-xs bg-slate-900 border border-slate-700 rounded focus:ring-1 focus:ring-cyan-500 outline-none resize-none text-white"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Tasks Grid */}
                                        <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                            {tasks.map((task) => {
                                                const statusConfig = getStatusConfig(task.status);
                                                const canStart = task.status === "not_started" || task.status === "needs_rework";
                                                const canComplete = task.status === "in_progress";

                                                return (
                                                    <div
                                                        key={task.taskId}
                                                        className={`border rounded-xl p-3 ${task.status === "needs_rework"
                                                            ? "border-red-700 bg-red-900/20"
                                                            : "border-slate-600 bg-slate-750"
                                                            }`}
                                                    >
                                                        <div className="flex items-start justify-between mb-2">
                                                            <h4 className="font-medium text-gray-200 text-sm">
                                                                {task.taskName}
                                                            </h4>
                                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                                                                {statusConfig.label}
                                                            </span>
                                                        </div>

                                                        {/* Assignment */}
                                                        {canAssign && (
                                                            <div className="mb-3">
                                                                <select
                                                                    value={task.assignedStaffId || ""}
                                                                    onChange={(e) => handleAssignTask(task.taskId, e.target.value, order.orderId)}
                                                                    disabled={actionLoading === task.taskId}
                                                                    className="w-full text-xs px-2 py-1.5 border border-slate-600 rounded bg-slate-700 text-gray-200"
                                                                >
                                                                    <option value="">Unassigned</option>
                                                                    {staffList.map((s) => (
                                                                        <option key={s.staffId} value={s.staffId}>
                                                                            {s.name}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        )}

                                                        {/* Assigned To (for non-admin view) */}
                                                        {!canAssign && task.assignedStaffName && (
                                                            <div className="text-xs text-slate-400 mb-3 flex items-center gap-1">
                                                                <UserIcon className="w-3 h-3" />
                                                                {task.assignedStaffName}
                                                            </div>
                                                        )}

                                                        {/* Actions */}
                                                        <div className="flex gap-2">
                                                            {canStart && (
                                                                <button
                                                                    onClick={() => handleStartTask(task.taskId)}
                                                                    disabled={actionLoading === task.taskId}
                                                                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50"
                                                                >
                                                                    <Play className="w-3 h-3" />
                                                                    Start
                                                                </button>
                                                            )}
                                                            {canComplete && (
                                                                <button
                                                                    onClick={() => handleCompleteTask(task.taskId)}
                                                                    disabled={actionLoading === task.taskId}
                                                                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 disabled:opacity-50"
                                                                >
                                                                    <Check className="w-3 h-3" />
                                                                    Complete
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Order Completion Action */}
                                        {canAssign && allTasksApproved && (
                                            <div className="px-4 py-3 bg-emerald-900/20 border-t border-emerald-900/30 flex justify-end">
                                                <button
                                                    onClick={() => handleCompleteStitching(order.orderId, order.activeStages)}
                                                    disabled={actionLoading === order.orderId}
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm disabled:opacity-50 shadow-lg"
                                                >
                                                    {actionLoading === order.orderId ? (
                                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Check className="w-4 h-4" />
                                                    )}
                                                    Ready for Ironing
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Toast */}
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </div>
        </ProtectedRoute>
    );
}
