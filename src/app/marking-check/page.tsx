"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { collection, getDocs, query, where, orderBy, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Order, MarkingTask, User } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import {
    getMarkingTasksForOrder,
    generateMarkingTasksForOrder,
    approveMarkingTask,
    rejectMarkingTask,
    assignMarkingTask,
    areAllMarkingTasksApproved,
} from "@/lib/markingTemplates";
import { generateCuttingTasksForOrder } from "@/lib/cuttingTemplates";
import { CheckSquare, Check, X, RefreshCw, User as UserIcon, Calendar, AlertCircle, ChevronRight } from "lucide-react";
import Toast from "@/components/Toast";

interface OrderWithTasks {
    order: Order;
    tasks: MarkingTask[];
}

export default function MarkingCheckPage() {
    const { userData } = useAuth();
    const [ordersWithTasks, setOrdersWithTasks] = useState<OrderWithTasks[]>([]);
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
                .map((doc) => doc.data() as User)
                .filter((u) => u.isActive && (u.role === "marking" || u.role === "marking_checker"))
                .map((u) => ({ staffId: u.staffId, name: u.name }));
            setStaffList(staff);

            // Load ALL orders in marking stage (no assignment filter)
            const ordersRef = collection(db, "orders");
            const q = query(
                ordersRef,
                where("currentStage", "==", "marking"),
                orderBy("createdAt", "desc")
            );
            const snapshot = await getDocs(q);
            const orders = snapshot.docs.map((doc) => doc.data() as Order);

            // Load tasks for each order
            const ordersWithTasksData: OrderWithTasks[] = [];

            for (const order of orders) {
                let tasks = await getMarkingTasksForOrder(order.orderId);

                // Generate tasks if none exist
                if (tasks.length === 0) {
                    tasks = await generateMarkingTasksForOrder(order.orderId, order.garmentType);
                }

                ordersWithTasksData.push({ order, tasks });
            }

            setOrdersWithTasks(ordersWithTasksData);
        } catch (error) {
            console.error("Failed to load data:", error);
            setToast({ message: "Failed to load tasks", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleApproveTask = async (taskId: string) => {
        if (!userData) return;

        setActionLoading(taskId);
        try {
            await approveMarkingTask(taskId, userData.staffId, userData.name);
            setToast({ message: "Task approved!", type: "success" });
            loadData();
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

    const handleAssignTask = async (taskId: string, staffId: string) => {
        const staff = staffList.find(s => s.staffId === staffId);
        if (!staff) return;

        setActionLoading(taskId);
        try {
            await assignMarkingTask(taskId, staffId, staff.name);
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
        setActionLoading(orderId);
        try {
            const allApproved = await areAllMarkingTasksApproved(orderId);
            if (!allApproved) {
                setToast({ message: "All tasks must be approved first", type: "error" });
                return;
            }

            // Move to next stage (cutting)
            await updateDoc(doc(db, "orders", orderId), {
                currentStage: "cutting",
            });

            // Generate cutting tasks
            const order = ordersWithTasks.find(o => o.order.orderId === orderId);
            if (order) {
                await generateCuttingTasksForOrder(orderId, order.order.garmentType);
            }

            setToast({ message: "Marking complete! Order moved to Cutting", type: "success" });
            loadData();
        } catch (error) {
            console.error("Failed to complete marking:", error);
            setToast({ message: "Failed to complete marking", type: "error" });
        } finally {
            setActionLoading(null);
        }
    };

    const getStatusConfig = (status: string) => {
        const configs: Record<string, { bg: string; text: string; label: string }> = {
            not_started: { bg: "bg-gray-200", text: "text-gray-700", label: "Not Started" },
            in_progress: { bg: "bg-blue-500", text: "text-white", label: "In Progress" },
            completed: { bg: "bg-amber-500", text: "text-white", label: "Awaiting Review" },
            needs_rework: { bg: "bg-red-500", text: "text-white", label: "Needs Rework" },
            approved: { bg: "bg-green-500", text: "text-white", label: "Approved" },
        };
        return configs[status] || configs.not_started;
    };

    const getDueDateStatus = (dueDate: any) => {
        const due = dueDate?.toDate?.() || new Date(dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diff < 0) return { color: "text-red-600", label: "Overdue" };
        if (diff === 0) return { color: "text-amber-600", label: "Due Today" };
        if (diff <= 2) return { color: "text-amber-500", label: `Due in ${diff}d` };
        return { color: "text-gray-600", label: `${diff}d` };
    };

    const getProgress = (tasks: MarkingTask[]) => {
        const approved = tasks.filter(t => t.status === "approved").length;
        const completed = tasks.filter(t => t.status === "completed" || t.status === "approved").length;
        return { approved, completed, total: tasks.length, allApproved: approved === tasks.length };
    };

    return (
        <ProtectedRoute allowedRoles={["marking_checker", "supervisor", "admin"]}>
            <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
                <TopBar />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    {/* Header */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <CheckSquare className="w-6 h-6 text-green-600" />
                                    Marking Checker
                                </h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    Review, approve, and verify all marking tasks
                                </p>
                            </div>
                            <button
                                onClick={loadData}
                                disabled={loading}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-sm"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                                Refresh
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    {loading ? (
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-4 border-green-600 border-t-transparent mx-auto"></div>
                            <p className="text-gray-500 dark:text-gray-400 mt-4">Loading orders...</p>
                        </div>
                    ) : ordersWithTasks.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                            <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                No Orders to Review
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400">
                                No orders are currently in the marking stage.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {ordersWithTasks.map(({ order, tasks }) => {
                                const dueStatus = getDueDateStatus(order.dueDate);
                                const progress = getProgress(tasks);

                                return (
                                    <div key={order.orderId} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                        {/* Order Header */}
                                        <div className="bg-gray-50 dark:bg-gray-750 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="font-semibold text-gray-900 dark:text-white">
                                                                {order.customerName}
                                                            </h3>
                                                            <span className="text-xs font-mono bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">
                                                                #{order.orderId.slice(0, 8)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-3 mt-1 text-sm">
                                                            <span className="text-gray-600 dark:text-gray-400 capitalize">
                                                                {order.garmentType.replace(/_/g, " ")}
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
                                                        <div className="flex items-center bg-gray-200 dark:bg-gray-700 rounded-full h-2 w-24">
                                                            <div
                                                                className="bg-green-500 h-2 rounded-full transition-all"
                                                                style={{ width: `${(progress.approved / progress.total) * 100}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                            {progress.approved}/{progress.total}
                                                        </span>
                                                    </div>

                                                    {/* Complete Button */}
                                                    <button
                                                        onClick={() => handleCompleteMarking(order.orderId)}
                                                        disabled={!progress.allApproved || actionLoading === order.orderId}
                                                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${progress.allApproved
                                                            ? "bg-green-600 text-white hover:bg-green-700"
                                                            : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                                            }`}
                                                    >
                                                        {actionLoading === order.orderId ? "..." : "Complete"}
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
                                                            className={`border rounded-lg p-3 ${task.status === "approved"
                                                                ? "border-green-300 bg-green-50 dark:bg-green-900/10 dark:border-green-800"
                                                                : task.status === "needs_rework"
                                                                    ? "border-red-300 bg-red-50 dark:bg-red-900/10 dark:border-red-800"
                                                                    : "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-750"
                                                                }`}
                                                        >
                                                            {/* Task Header */}
                                                            <div className="flex items-start justify-between mb-2">
                                                                <div>
                                                                    <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                                                                        {task.taskName}
                                                                    </h4>
                                                                    {task.isMandatory && (
                                                                        <span className="text-xs text-red-600">Required</span>
                                                                    )}
                                                                </div>
                                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                                                                    {statusConfig.label}
                                                                </span>
                                                            </div>

                                                            {/* Assignment */}
                                                            <div className="mb-3">
                                                                <select
                                                                    value={task.assignedStaffId || ""}
                                                                    onChange={(e) => handleAssignTask(task.taskId, e.target.value)}
                                                                    disabled={actionLoading === task.taskId}
                                                                    className="w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                                                >
                                                                    <option value="">Unassigned</option>
                                                                    {staffList.map((s) => (
                                                                        <option key={s.staffId} value={s.staffId}>
                                                                            {s.name}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>

                                                            {/* Approve/Reject Actions */}
                                                            {canApprove && (
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => handleApproveTask(task.taskId)}
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
                                                                <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                                                    <Check className="w-3 h-3" />
                                                                    Approved by {task.approvedByName}
                                                                </div>
                                                            )}

                                                            {/* Notes */}
                                                            {task.notes && (
                                                                <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-700 dark:text-amber-400">
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
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 9998 }}>
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg max-w-md w-full p-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Reject Task - Send for Rework
                            </h3>
                            <textarea
                                value={rejectModal.reason}
                                onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
                                placeholder="Reason for rejection (required)"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white h-24 resize-none"
                            />
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => setRejectModal(null)}
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
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
