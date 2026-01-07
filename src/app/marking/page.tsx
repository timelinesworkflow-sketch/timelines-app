"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Order, MarkingTask, User, getGarmentDisplayName } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import {
    getMarkingTasksForStaff,
    getAllPendingMarkingTasks,
    startMarkingTask,
    completeMarkingTask,
    assignMarkingTask,
} from "@/lib/markingTemplates";
import { ClipboardList, Play, Check, User as UserIcon, RefreshCw, AlertCircle, Calendar, Package } from "lucide-react";
import Toast from "@/components/Toast";

// Group tasks by orderId
interface TaskGroup {
    orderId: string;
    order?: Order;
    tasks: MarkingTask[];
}

export default function MarkingPage() {
    const { userData } = useAuth();
    const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
    const [staffList, setStaffList] = useState<{ staffId: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
    const [noteModal, setNoteModal] = useState<{ taskId: string; note: string } | null>(null);

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
                    .map((docSnap) => docSnap.data() as User)
                    .filter((u) => u.isActive && (u.role === "marking" || u.role === "marking_checker"))
                    .map((u) => ({ staffId: u.staffId, name: u.name }));
                setStaffList(staff);
            }

            // Fetch tasks based on role
            let tasks: MarkingTask[] = [];

            if (isMarkingStaff) {
                // Marking staff sees only their assigned tasks
                tasks = await getMarkingTasksForStaff(userData.staffId);
            } else {
                // Admin/Supervisor/Checker sees all pending tasks
                tasks = await getAllPendingMarkingTasks();
            }

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

    const handleStartTask = async (taskId: string) => {
        setActionLoading(taskId);
        try {
            await startMarkingTask(taskId);
            setToast({ message: "Task started!", type: "success" });
            loadData();
        } catch (error) {
            console.error("Failed to start task:", error);
            setToast({ message: "Failed to start task", type: "error" });
        } finally {
            setActionLoading(null);
        }
    };

    const handleCompleteTask = async (taskId: string, notes?: string) => {
        setActionLoading(taskId);
        try {
            await completeMarkingTask(taskId, notes);
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
        <ProtectedRoute allowedRoles={["marking", "marking_checker", "supervisor", "admin"]}>
            <div className="min-h-screen bg-slate-900">
                <TopBar />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    {/* Header */}
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h1 className="text-xl font-bold text-gray-200 flex items-center gap-2">
                                    <ClipboardList className="w-6 h-6 text-purple-400" />
                                    Marking Tasks
                                </h1>
                                <p className="text-sm text-slate-400 mt-1">
                                    {isMarkingStaff
                                        ? "Your assigned marking tasks"
                                        : "All pending marking tasks"}
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
                            <div className="animate-spin rounded-full h-10 w-10 border-4 border-purple-500 border-t-transparent mx-auto"></div>
                            <p className="text-slate-400 mt-4">Loading tasks...</p>
                        </div>
                    ) : taskGroups.length === 0 ? (
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
                            <AlertCircle className="w-12 h-12 mx-auto text-slate-500 mb-4" />
                            <h3 className="text-lg font-medium text-gray-200 mb-2">
                                No Tasks Available
                            </h3>
                            <p className="text-slate-400">
                                {isMarkingStaff
                                    ? "No tasks are currently assigned to you."
                                    : "No pending marking tasks."}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {taskGroups.map(({ orderId, order, tasks }) => {
                                const dueStatus = getDueDateStatus(order?.dueDate);

                                return (
                                    <div key={orderId} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                                        {/* Order Header */}
                                        <div className="bg-slate-750 px-4 py-3 border-b border-slate-700">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
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
                                                <div className="text-sm text-slate-400">
                                                    {tasks.length} task{tasks.length !== 1 ? "s" : ""}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Tasks Grid */}
                                        <div className="p-4">
                                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

                                                            {/* Assignment */}
                                                            {canAssign && (
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
                                                                        onClick={() => setNoteModal({ taskId: task.taskId, note: "" })}
                                                                        disabled={actionLoading === task.taskId}
                                                                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 disabled:opacity-50"
                                                                    >
                                                                        <Check className="w-3 h-3" />
                                                                        Complete
                                                                    </button>
                                                                )}
                                                            </div>

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

                {/* Complete Task Modal */}
                {noteModal && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4" style={{ zIndex: 9998 }}>
                        <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6">
                            <h3 className="text-lg font-semibold text-gray-200 mb-4">
                                Complete Task
                            </h3>
                            <textarea
                                value={noteModal.note}
                                onChange={(e) => setNoteModal({ ...noteModal, note: e.target.value })}
                                placeholder="Add notes (optional)"
                                className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-700 text-gray-200 placeholder-slate-400 h-24 resize-none"
                            />
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => setNoteModal(null)}
                                    className="flex-1 px-4 py-2 border border-slate-600 text-gray-200 rounded-lg hover:bg-slate-700 font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleCompleteTask(noteModal.taskId, noteModal.note)}
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
