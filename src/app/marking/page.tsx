"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Order, SubTask, User } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import {
    startMarkingTask,
    completeMarkingTask,
    assignMarkingTask,
    ensureMarkingTasks,
} from "@/lib/markingTemplates";
import { ClipboardList, Play, Check, User as UserIcon, RefreshCw, AlertCircle, Calendar } from "lucide-react";
import Toast from "@/components/Toast";

interface OrderWithTasks {
    order: Order;
    tasks: SubTask[];
}

export default function MarkingPage() {
    const { userData } = useAuth();
    const [ordersWithTasks, setOrdersWithTasks] = useState<OrderWithTasks[]>([]);
    const [staffList, setStaffList] = useState<{ staffId: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
    const [noteModal, setNoteModal] = useState<{ taskId: string; orderId: string; note: string } | null>(null);

    const isMarkingStaff = userData?.role === "marking";
    const canAssign = userData?.role === "admin" || userData?.role === "supervisor" || userData?.role === "marking_checker";

    useEffect(() => {
        loadData();
    }, [userData]);

    const loadData = async () => {
        if (!userData) return;

        setLoading(true);
        try {
            // Load staff list for assignment dropdown
            if (canAssign) {
                const usersSnapshot = await getDocs(collection(db, "users"));
                const staff = usersSnapshot.docs
                    .map((doc) => doc.data() as User)
                    .filter((u) => u.isActive && (u.role === "marking" || u.role === "marking_checker"))
                    .map((u) => ({ staffId: u.staffId, name: u.name }));
                setStaffList(staff);
            }

            // Load orders in marking stage
            const ordersRef = collection(db, "orders");
            const q = query(
                ordersRef,
                where("currentStage", "==", "marking"),
                orderBy("createdAt", "desc")
            );
            const snapshot = await getDocs(q);
            const orders = snapshot.docs.map((doc) => doc.data() as Order);

            // Process orders (Client-side filtering for visibility)
            const ordersWithTasksData: OrderWithTasks[] = [];

            for (const order of orders) {
                // Get tasks from embedded map (lazily migrate if needed)
                const tasksMap = await ensureMarkingTasks(order);
                let tasks: SubTask[] = Object.values(tasksMap);

                // Sort by taskOrder
                tasks.sort((a, b) => a.taskOrder - b.taskOrder);

                // Filter tasks for marking staff visibility rule:
                // Show order if ANY task is:
                // 1. Assigned to them
                // 2. OR Unassigned (available to pick)
                // AND not completed (optional, but requested "is not completed")

                if (isMarkingStaff) {
                    // Check if this order has ANY relevant tasks for this staff
                    // We DO NOT filter the tasks array itself because specific staff might need context of other tasks?
                    // "Show an order to a staff member if any marking sub-task: is assigned to them..."
                    // Usually staff sees ONLY their tasks to avoid confusion, simpler to show only relevant tasks.

                    const relevantTasks = tasks.filter(t =>
                        (t.assignedStaffId === userData.staffId && t.status !== "completed" && t.status !== "approved") ||
                        (!t.assignedStaffId && t.status !== "completed" && t.status !== "approved")
                    );

                    if (relevantTasks.length === 0) {
                        continue; // Skip this order entirely
                    }

                    // For the view, should we show only relevant tasks or all?
                    // "View only their assigned sub-task" implies filtering the list too.
                    tasks = relevantTasks;
                }

                if (tasks.length > 0) {
                    ordersWithTasksData.push({ order, tasks });
                }
            }

            setOrdersWithTasks(ordersWithTasksData);
        } catch (error) {
            console.error("Failed to load data:", error);
            setToast({ message: "Failed to load orders", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleStartTask = async (orderId: string, taskId: string) => {
        setActionLoading(taskId);
        try {
            await startMarkingTask(orderId, taskId);
            setToast({ message: "Task started!", type: "success" });
            loadData();
        } catch (error) {
            console.error("Failed to start task:", error);
            setToast({ message: "Failed to start task", type: "error" });
        } finally {
            setActionLoading(null);
        }
    };

    const handleCompleteTask = async (orderId: string, taskId: string, notes?: string) => {
        setActionLoading(taskId);
        try {
            await completeMarkingTask(orderId, taskId, notes);
            setToast({ message: "Task completed!", type: "success" });
            setNoteModal(null);
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

    const getStatusConfig = (status: string) => {
        const configs: Record<string, { bg: string; text: string; label: string }> = {
            not_started: { bg: "bg-gray-200", text: "text-gray-700", label: "Not Started" },
            in_progress: { bg: "bg-blue-500", text: "text-white", label: "In Progress" },
            completed: { bg: "bg-amber-500", text: "text-white", label: "Completed" },
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
        if (diff <= 2) return { color: "text-amber-500", label: `Due in ${diff} day${diff > 1 ? "s" : ""}` };
        return { color: "text-gray-600", label: `Due in ${diff} days` };
    };

    return (
        <ProtectedRoute allowedRoles={["marking", "marking_checker", "supervisor", "admin"]}>
            <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
                <TopBar />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    {/* Header */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <ClipboardList className="w-6 h-6 text-orange-600" />
                                    Marking Stage
                                </h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    {isMarkingStaff
                                        ? "Your assigned and available tasks"
                                        : "All orders in marking stage"}
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
                            <div className="animate-spin rounded-full h-10 w-10 border-4 border-orange-600 border-t-transparent mx-auto"></div>
                            <p className="text-gray-500 dark:text-gray-400 mt-4">Loading tasks...</p>
                        </div>
                    ) : ordersWithTasks.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                            <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                No Tasks Found
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400">
                                {isMarkingStaff
                                    ? "No marking tasks are assigned to you or available at the moment."
                                    : "No orders are currently in the marking stage."}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {ordersWithTasks.map(({ order, tasks }) => {
                                const dueStatus = getDueDateStatus(order.dueDate);
                                const totalTasks = order.markingTasks ? Object.keys(order.markingTasks).length : 0;
                                const completedTasks = order.markingTasks ? Object.values(order.markingTasks).filter(t => t.status === "completed" || t.status === "approved").length : 0;

                                return (
                                    <div key={order.orderId} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                        {/* Order Header */}
                                        <div className="bg-gray-50 dark:bg-gray-750 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
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
                                                <div className="text-sm text-gray-500">
                                                    {completedTasks} / {totalTasks} done
                                                </div>
                                            </div>
                                        </div>

                                        {/* Tasks Grid */}
                                        <div className="p-4">
                                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                                {tasks.map((task) => {
                                                    const statusConfig = getStatusConfig(task.status);
                                                    const canStart = task.status === "not_started" && task.assignedStaffId === userData?.staffId;
                                                    const canComplete = task.status === "in_progress" && task.assignedStaffId === userData?.staffId;
                                                    const canRestart = task.status === "needs_rework" && task.assignedStaffId === userData?.staffId;

                                                    return (
                                                        <div
                                                            key={task.taskId}
                                                            className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-750"
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
                                                                {canAssign ? (
                                                                    <select
                                                                        value={task.assignedStaffId || ""}
                                                                        onChange={(e) => handleAssignTask(task.taskId, e.target.value, order.orderId)}
                                                                        disabled={actionLoading === task.taskId}
                                                                        className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-orange-500 max-w-[120px]"
                                                                    >
                                                                        <option value="">Unassigned</option>
                                                                        {staffList.map((s) => (
                                                                            <option key={s.staffId} value={s.staffId}>
                                                                                {s.name}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                ) : (
                                                                    <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                                                                        <UserIcon className="w-3 h-3" />
                                                                        <span>{task.assignedStaffName || "Unassigned"}</span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Actions */}
                                                            <div className="flex gap-2">
                                                                {canStart && (
                                                                    <button
                                                                        onClick={() => handleStartTask(order.orderId, task.taskId)}
                                                                        disabled={actionLoading === task.taskId}
                                                                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50"
                                                                    >
                                                                        <Play className="w-3 h-3" />
                                                                        Start
                                                                    </button>
                                                                )}
                                                                {canComplete && (
                                                                    <button
                                                                        onClick={() => setNoteModal({ taskId: task.taskId, orderId: order.orderId, note: "" })}
                                                                        disabled={actionLoading === task.taskId}
                                                                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 disabled:opacity-50"
                                                                    >
                                                                        <Check className="w-3 h-3" />
                                                                        Complete
                                                                    </button>
                                                                )}
                                                                {canRestart && (
                                                                    <button
                                                                        onClick={() => handleStartTask(order.orderId, task.taskId)}
                                                                        disabled={actionLoading === task.taskId}
                                                                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded hover:bg-amber-700 disabled:opacity-50"
                                                                    >
                                                                        Restart
                                                                    </button>
                                                                )}
                                                            </div>

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

                {/* Complete with Note Modal */}
                {noteModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 9998 }}>
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg max-w-md w-full p-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Complete Task
                            </h3>
                            <textarea
                                value={noteModal.note}
                                onChange={(e) => setNoteModal({ ...noteModal, note: e.target.value })}
                                placeholder="Add notes (optional)"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white h-24 resize-none"
                            />
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => setNoteModal(null)}
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleCompleteTask(noteModal.orderId, noteModal.taskId, noteModal.note || undefined)}
                                    disabled={actionLoading === noteModal.taskId}
                                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                                >
                                    {actionLoading === noteModal.taskId ? "Saving..." : "Complete"}
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
