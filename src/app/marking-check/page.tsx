"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Order, MarkingTask, User, getGarmentDisplayName } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import {
    getAllPendingMarkingTasks,
    approveMarkingTask,
    rejectMarkingTask,
    assignMarkingTask,
    areAllMarkingTasksApproved,
    startMarkingTask,
} from "@/lib/markingTemplates";
import { generateCuttingTasksForOrder, getCuttingTasksForOrder } from "@/lib/cuttingTemplates";
import { getNextStage, addTimelineEntry, logStaffWork } from "@/lib/orders";
import { CheckSquare, Check, X, RefreshCw, Calendar, AlertCircle, ChevronRight, Package } from "lucide-react";
import Toast from "@/components/Toast";

interface TaskGroup {
    orderId: string;
    order?: Order;
    tasks: MarkingTask[];
}

// Helper: Check if a task is a Quality Check (checker) task
const isCheckerTask = (task: MarkingTask): boolean => {
    const nameMatch = task.taskName?.toLowerCase().includes("quality check") ?? false;
    const subStageMatch = task.subStageId?.toLowerCase().includes("quality_check") ?? false;
    return nameMatch || subStageMatch;
};

export default function MarkingCheckPage() {
    const { userData } = useAuth();
    const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
    const [staffList, setStaffList] = useState<{ staffId: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
    const [rejectModal, setRejectModal] = useState<{ taskId: string; reason: string } | null>(null);

    useEffect(() => {
        loadData();
    }, [userData]);

    const loadData = async () => {
        if (!userData) return;

        setLoading(true);
        try {
            // Load staff list for assignment dropdown
            const usersSnapshot = await getDocs(collection(db, "users"));
            const staff = usersSnapshot.docs
                .map((docSnap) => docSnap.data() as User)
                .filter((u) => u.isActive && (u.role === "marking" || u.role === "marking_checker"))
                .map((u) => ({ staffId: u.staffId, name: u.name }));
            setStaffList(staff);

            // Fetch all pending marking tasks (checker sees all)
            const tasks = await getAllPendingMarkingTasks();

            // Group tasks by orderId
            const groupMap = new Map<string, MarkingTask[]>();
            for (const task of tasks) {
                if (!groupMap.has(task.orderId)) {
                    groupMap.set(task.orderId, []);
                }
                groupMap.get(task.orderId)!.push(task);
            }

            // Fetch order details for each group
            const groups: TaskGroup[] = [];
            for (const [orderId, orderTasks] of groupMap) {
                let order: Order | undefined;
                try {
                    const orderDoc = await getDoc(doc(db, "orders", orderId));
                    if (orderDoc.exists()) {
                        order = orderDoc.data() as Order;
                    }
                } catch (err) {
                    console.error(`Failed to fetch order ${orderId}:`, err);
                }

                // Sort tasks by taskOrder
                orderTasks.sort((a, b) => a.taskOrder - b.taskOrder);

                // Auto-claim checker tasks for logged-in checker
                for (const task of orderTasks) {
                    if (isCheckerTask(task) && (!task.assignedStaffId || task.assignedStaffId === null)) {
                        try {
                            // Auto-assign to logged-in checker
                            await updateDoc(doc(db, "markingTasks", task.taskId), {
                                assignedStaffId: userData.staffId,
                                assignedStaffName: userData.name,
                            });
                            // Auto-start the task
                            await startMarkingTask(task.taskId);
                            // Update local task object
                            task.assignedStaffId = userData.staffId;
                            task.assignedStaffName = userData.name;
                        } catch (err) {
                            console.error(`Failed to auto-claim checker task ${task.taskId}:`, err);
                        }
                    }
                }

                groups.push({ orderId, order, tasks: orderTasks });
            }

            // Sort groups by order due date
            groups.sort((a, b) => {
                const aDate = a.order?.dueDate?.toDate?.() || new Date();
                const bDate = b.order?.dueDate?.toDate?.() || new Date();
                return aDate.getTime() - bDate.getTime();
            });

            setTaskGroups(groups);
        } catch (error) {
            console.error("Failed to load data:", error);
            setToast({ message: "Failed to load tasks", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleApproveTask = async (taskId: string, orderId: string) => {
        if (!userData) return;

        setActionLoading(taskId);
        try {
            await approveMarkingTask(taskId, userData.staffId, userData.name);
            setToast({ message: "Task approved!", type: "success" });

            // Check if all tasks are approved for auto-transition
            const allApproved = await areAllMarkingTasksApproved(orderId);
            if (allApproved) {
                await handleCompleteMarking(orderId);
            } else {
                loadData();
            }
        } catch (error) {
            console.error("Failed to approve task:", error);
            setToast({ message: "Failed to approve task", type: "error" });
        } finally {
            setActionLoading(null);
        }
    };

    const handleRejectTask = async () => {
        if (!rejectModal || !rejectModal.reason.trim()) {
            setToast({ message: "Please provide a reason for rejection", type: "error" });
            return;
        }

        setActionLoading(rejectModal.taskId);
        try {
            await rejectMarkingTask(rejectModal.taskId, rejectModal.reason);
            setToast({ message: "Task sent for rework", type: "info" });
            setRejectModal(null);
            loadData();
        } catch (error) {
            console.error("Failed to reject task:", error);
            setToast({ message: "Failed to reject task", type: "error" });
        } finally {
            setActionLoading(null);
        }
    };

    const handleAssignTask = async (taskId: string, staffId: string, orderId: string) => {
        const staff = staffList.find(s => s.staffId === staffId);
        if (!staff || !userData) return;

        setActionLoading(taskId);
        try {
            await assignMarkingTask(
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

    const handleCompleteMarking = async (orderId: string) => {
        if (!userData) return;

        try {
            // Get current order to determine next stage
            const group = taskGroups.find(g => g.orderId === orderId);
            const order = group?.order;

            if (!order) {
                throw new Error("Order not found");
            }

            // Determine next stage using activeStages
            const nextStage = getNextStage("marking", order.activeStages);

            // Update order document with next stage
            await updateDoc(doc(db, "orders", orderId), {
                currentStage: nextStage || "completed",
                status: nextStage ? "in_progress" : "completed",
            });

            // Generate cutting tasks if next stage is cutting and garmentType is defined
            if (nextStage === "cutting" && order.garmentType) {
                // Safety: check if cutting tasks already exist
                const existingCuttingTasks = await getCuttingTasksForOrder(orderId);
                if (!existingCuttingTasks || existingCuttingTasks.length === 0) {
                    await generateCuttingTasksForOrder(orderId, order.garmentType);

                    // Add timeline entry for cutting stage started
                    await addTimelineEntry(orderId, {
                        staffId: userData.staffId,
                        role: userData.role,
                        stage: "cutting",
                        action: "started",
                    });
                }
            }

            // Create timeline entry
            await addTimelineEntry(orderId, {
                staffId: userData.staffId,
                role: userData.role,
                stage: "marking",
                action: "completed",
            });

            // Log staff work
            await logStaffWork({
                staffId: userData.staffId,
                firebaseUid: userData.email,
                email: userData.email,
                role: userData.role,
                orderId: orderId,
                stage: "marking",
                action: "checked_ok",
            });

            setToast({ message: `Marking complete! Order moved to ${nextStage || "completed"}`, type: "success" });
            loadData();
        } catch (error) {
            console.error("Failed to complete marking:", error);
            const errorMessage = error instanceof Error ? error.message : "Failed to complete marking";
            setToast({ message: errorMessage, type: "error" });
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

    const getProgress = (tasks: MarkingTask[]) => {
        const approved = tasks.filter(t => t.status === "approved").length;
        return { approved, total: tasks.length, allApproved: approved === tasks.length && tasks.length > 0 };
    };

    return (
        <ProtectedRoute allowedRoles={["marking_checker", "supervisor", "admin"]}>
            <div className="min-h-screen bg-slate-900">
                <TopBar />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    {/* Header */}
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h1 className="text-xl font-bold text-gray-200 flex items-center gap-2">
                                    <CheckSquare className="w-6 h-6 text-green-400" />
                                    Marking Checker
                                </h1>
                                <p className="text-sm text-slate-400 mt-1">
                                    Review, approve, and verify all marking tasks
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

                    {/* Content */}
                    {loading ? (
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-4 border-green-500 border-t-transparent mx-auto"></div>
                            <p className="text-slate-400 mt-4">Loading orders...</p>
                        </div>
                    ) : taskGroups.length === 0 ? (
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
                            <AlertCircle className="w-12 h-12 mx-auto text-slate-500 mb-4" />
                            <h3 className="text-lg font-medium text-gray-200 mb-2">
                                No Orders to Review
                            </h3>
                            <p className="text-slate-400">
                                No orders are currently in the marking stage.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {taskGroups.map(({ orderId, order, tasks }) => {
                                const dueStatus = getDueDateStatus(order?.dueDate);
                                const progress = getProgress(tasks);

                                return (
                                    <div key={orderId} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                                        {/* Order Header */}
                                        <div className="bg-slate-750 px-4 py-3 border-b border-slate-700">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <Package className="w-5 h-5 text-slate-400" />
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="font-semibold text-gray-200">
                                                                {order?.customerName || "Unknown Customer"}
                                                            </h3>
                                                            <span className="text-xs font-mono bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                                                                #{orderId.slice(0, 8)}
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
                                                <div className="flex items-center gap-3">
                                                    {/* Progress Indicator */}
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex items-center bg-slate-700 rounded-full h-2 w-24">
                                                            <div
                                                                className="bg-emerald-500 h-2 rounded-full transition-all"
                                                                style={{ width: `${(progress.approved / progress.total) * 100}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-sm font-medium text-gray-200">
                                                            {progress.approved}/{progress.total}
                                                        </span>
                                                    </div>

                                                    {/* Complete Button */}
                                                    <button
                                                        onClick={() => handleCompleteMarking(orderId)}
                                                        disabled={!progress.allApproved || actionLoading === orderId}
                                                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${progress.allApproved
                                                            ? "bg-green-600 text-white hover:bg-green-700"
                                                            : "bg-slate-700 text-slate-500 cursor-not-allowed"
                                                            }`}
                                                    >
                                                        {actionLoading === orderId ? "..." : "Complete"}
                                                        <ChevronRight className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Tasks Grid */}
                                        <div className="p-4">
                                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                                {tasks.map((task) => {
                                                    const statusConfig = getStatusConfig(task.status);
                                                    const canApprove = task.status === "completed";

                                                    return (
                                                        <div
                                                            key={task.taskId}
                                                            className={`border rounded-xl p-3 ${task.status === "approved"
                                                                ? "border-emerald-700 bg-emerald-900/20"
                                                                : task.status === "needs_rework"
                                                                    ? "border-red-700 bg-red-900/20"
                                                                    : "border-slate-600 bg-slate-750"
                                                                }`}
                                                        >
                                                            {/* Task Header */}
                                                            <div className="flex items-start justify-between mb-2">
                                                                <div>
                                                                    <h4 className="font-medium text-gray-200 text-sm">
                                                                        {task.taskName}
                                                                    </h4>
                                                                    {task.isMandatory && (
                                                                        <span className="text-xs bg-orange-900 text-orange-200 px-1.5 py-0.5 rounded">Required</span>
                                                                    )}
                                                                </div>
                                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                                                                    {statusConfig.label}
                                                                </span>
                                                            </div>

                                                            {/* Assignment - Only visible to Admin/Supervisor, NOT Checker */}
                                                            {(userData?.role === "admin" || userData?.role === "supervisor") && (
                                                                <div className="mb-3">
                                                                    <select
                                                                        value={task.assignedStaffId || ""}
                                                                        onChange={(e) => handleAssignTask(task.taskId, e.target.value, orderId)}
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

                                                            {/* Approve/Reject Actions */}
                                                            {canApprove && (
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => handleApproveTask(task.taskId, orderId)}
                                                                        disabled={actionLoading === task.taskId}
                                                                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 disabled:opacity-50"
                                                                    >
                                                                        <Check className="w-3 h-3" />
                                                                        Approve
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setRejectModal({ taskId: task.taskId, reason: "" })}
                                                                        disabled={actionLoading === task.taskId}
                                                                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 disabled:opacity-50"
                                                                    >
                                                                        <X className="w-3 h-3" />
                                                                        Reject
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {/* Approved By */}
                                                            {task.status === "approved" && task.approvedByName && (
                                                                <div className="text-xs text-emerald-400 flex items-center gap-1">
                                                                    <Check className="w-3 h-3" />
                                                                    Approved by {task.approvedByName}
                                                                </div>
                                                            )}

                                                            {/* Notes */}
                                                            {task.notes && (
                                                                <div className="mt-2 p-2 bg-orange-900/30 border border-orange-800 rounded text-xs text-orange-200">
                                                                    {task.notes}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Reject Modal */}
                {rejectModal && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4" style={{ zIndex: 9998 }}>
                        <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6">
                            <h3 className="text-lg font-semibold text-gray-200 mb-4">
                                Reject Task - Send for Rework
                            </h3>
                            <textarea
                                value={rejectModal.reason}
                                onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
                                placeholder="Reason for rejection (required)"
                                className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-700 text-gray-200 placeholder-slate-400 h-24 resize-none"
                            />
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => setRejectModal(null)}
                                    className="flex-1 px-4 py-2 border border-slate-600 text-gray-200 rounded-lg hover:bg-slate-700 font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRejectTask}
                                    disabled={actionLoading === rejectModal.taskId || !rejectModal.reason.trim()}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
                                >
                                    {actionLoading === rejectModal.taskId ? "Saving..." : "Send for Rework"}
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
