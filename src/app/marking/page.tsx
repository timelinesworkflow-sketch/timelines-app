"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Order, MarkingTask, User } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import {
    getMarkingTasksForOrder,
    getMarkingTasksForStaff,
    generateMarkingTasksForOrder,
    startMarkingTask,
    completeMarkingTask,
    assignMarkingTask,
} from "@/lib/markingTemplates";
import { ClipboardList, Play, Check, User as UserIcon, RefreshCw, MessageSquare } from "lucide-react";
import Toast from "@/components/Toast";

interface OrderWithTasks {
    order: Order;
    tasks: MarkingTask[];
}

export default function MarkingPage() {
    const { userData } = useAuth();
    const [ordersWithTasks, setOrdersWithTasks] = useState<OrderWithTasks[]>([]);
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

            // Load tasks for each order
            const ordersWithTasksData: OrderWithTasks[] = [];

            for (const order of orders) {
                let tasks = await getMarkingTasksForOrder(order.orderId);

                // Generate tasks if none exist
                if (tasks.length === 0) {
                    tasks = await generateMarkingTasksForOrder(order.orderId, order.garmentType);
                }

                // Filter tasks for marking staff (only show assigned to them)
                if (isMarkingStaff) {
                    tasks = tasks.filter(t => t.assignedStaffId === userData.staffId);
                }

                if (tasks.length > 0) {
                    ordersWithTasksData.push({ order, tasks });
                }
            }

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

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            not_started: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
            in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
            completed: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
            needs_rework: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
            approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        };
        return styles[status] || styles.not_started;
    };

    return (
        <ProtectedRoute allowedRoles={["marking", "marking_checker", "supervisor", "admin"]}>
            <div className="page-container min-h-screen">
                <TopBar />

                <div className="page-content">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center space-x-2">
                                <ClipboardList className="w-8 h-8 text-orange-600" />
                                <span>Marking Tasks</span>
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400">
                                {isMarkingStaff
                                    ? "Complete your assigned marking tasks"
                                    : "View and manage all marking tasks"}
                            </p>
                        </div>
                        <button onClick={loadData} className="btn btn-outline flex items-center space-x-1">
                            <RefreshCw className="w-4 h-4" />
                            <span>Refresh</span>
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-600 border-t-transparent"></div>
                        </div>
                    ) : ordersWithTasks.length === 0 ? (
                        <div className="card text-center py-12">
                            <ClipboardList className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                            <p className="text-gray-600 dark:text-gray-400">
                                {isMarkingStaff ? "No tasks assigned to you" : "No orders in marking stage"}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {ordersWithTasks.map(({ order, tasks }) => (
                                <div key={order.orderId} className="card">
                                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                                        <div>
                                            <h3 className="font-semibold text-gray-900 dark:text-white">
                                                {order.customerName}
                                            </h3>
                                            <p className="text-sm text-gray-500">
                                                {order.garmentType.replace(/_/g, " ")} | Due: {order.dueDate.toDate().toLocaleDateString()}
                                            </p>
                                        </div>
                                        <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                            {order.orderId.slice(0, 8)}
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        {tasks.map((task) => (
                                            <div
                                                key={task.taskId}
                                                className={`p-4 rounded-lg border ${task.status === "needs_rework"
                                                        ? "border-red-300 bg-red-50 dark:bg-red-900/10"
                                                        : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between flex-wrap gap-3">
                                                    <div className="flex items-center space-x-3">
                                                        <span className="text-sm font-mono text-gray-500">{task.taskOrder}.</span>
                                                        <div>
                                                            <span className="font-medium text-gray-900 dark:text-white">
                                                                {task.taskName}
                                                            </span>
                                                            {task.isMandatory && (
                                                                <span className="ml-2 text-xs text-red-600">*Required</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center space-x-2 flex-wrap gap-2">
                                                        {/* Status Badge */}
                                                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(task.status)}`}>
                                                            {task.status.replace(/_/g, " ")}
                                                        </span>

                                                        {/* Assignment Dropdown (for admin/supervisor/checker) */}
                                                        {canAssign && (
                                                            <select
                                                                value={task.assignedStaffId || ""}
                                                                onChange={(e) => handleAssignTask(task.taskId, e.target.value)}
                                                                disabled={actionLoading === task.taskId}
                                                                className="text-xs px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                                                            >
                                                                <option value="">Unassigned</option>
                                                                {staffList.map((s) => (
                                                                    <option key={s.staffId} value={s.staffId}>
                                                                        {s.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        )}

                                                        {/* Assigned Staff Badge (for marking staff view) */}
                                                        {!canAssign && task.assignedStaffName && (
                                                            <span className="flex items-center space-x-1 text-xs text-gray-600 dark:text-gray-400">
                                                                <UserIcon className="w-3 h-3" />
                                                                <span>{task.assignedStaffName}</span>
                                                            </span>
                                                        )}

                                                        {/* Action Buttons */}
                                                        {task.status === "not_started" && task.assignedStaffId === userData?.staffId && (
                                                            <button
                                                                onClick={() => handleStartTask(task.taskId)}
                                                                disabled={actionLoading === task.taskId}
                                                                className="btn btn-primary btn-sm flex items-center space-x-1"
                                                            >
                                                                <Play className="w-3 h-3" />
                                                                <span>Start</span>
                                                            </button>
                                                        )}

                                                        {task.status === "in_progress" && task.assignedStaffId === userData?.staffId && (
                                                            <button
                                                                onClick={() => setNoteModal({ taskId: task.taskId, note: "" })}
                                                                disabled={actionLoading === task.taskId}
                                                                className="btn btn-primary btn-sm flex items-center space-x-1"
                                                            >
                                                                <Check className="w-3 h-3" />
                                                                <span>Complete</span>
                                                            </button>
                                                        )}

                                                        {task.status === "needs_rework" && task.assignedStaffId === userData?.staffId && (
                                                            <button
                                                                onClick={() => handleStartTask(task.taskId)}
                                                                disabled={actionLoading === task.taskId}
                                                                className="btn btn-primary btn-sm"
                                                            >
                                                                Restart
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {task.notes && (
                                                    <div className="mt-2 p-2 bg-white dark:bg-gray-900 rounded text-sm text-gray-600 dark:text-gray-400 flex items-start space-x-2">
                                                        <MessageSquare className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                                        <span>{task.notes}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Complete with Note Modal */}
                {noteModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Complete Task
                            </h3>
                            <textarea
                                value={noteModal.note}
                                onChange={(e) => setNoteModal({ ...noteModal, note: e.target.value })}
                                placeholder="Add notes (optional)"
                                className="input h-24 mb-4"
                            />
                            <div className="flex space-x-3">
                                <button
                                    onClick={() => setNoteModal(null)}
                                    className="btn btn-outline flex-1"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleCompleteTask(noteModal.taskId, noteModal.note || undefined)}
                                    disabled={actionLoading === noteModal.taskId}
                                    className="btn btn-primary flex-1"
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
