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
import { CheckSquare, Check, X, AlertTriangle, RefreshCw, User as UserIcon } from "lucide-react";
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
            setToast({ message: "Task marked for rework", type: "info" });
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

            setToast({ message: "Marking complete! Order moved to Cutting", type: "success" });
            loadData();
        } catch (error) {
            console.error("Failed to complete marking:", error);
            setToast({ message: "Failed to complete marking", type: "error" });
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

    const getOrderProgress = (tasks: MarkingTask[]) => {
        const approved = tasks.filter(t => t.status === "approved").length;
        const completed = tasks.filter(t => t.status === "completed" || t.status === "approved").length;
        return { approved, completed, total: tasks.length };
    };

    return (
        <ProtectedRoute allowedRoles={["marking_checker", "supervisor", "admin"]}>
            <div className="page-container min-h-screen">
                <TopBar />

                <div className="page-content">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center space-x-2">
                                <CheckSquare className="w-8 h-8 text-green-600" />
                                <span>Marking Quality Check</span>
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400">
                                Review, approve, or reject marking tasks
                            </p>
                        </div>
                        <button onClick={loadData} className="btn btn-outline flex items-center space-x-1">
                            <RefreshCw className="w-4 h-4" />
                            <span>Refresh</span>
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-600 border-t-transparent"></div>
                        </div>
                    ) : ordersWithTasks.length === 0 ? (
                        <div className="card text-center py-12">
                            <CheckSquare className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                            <p className="text-gray-600 dark:text-gray-400">No orders in marking stage</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {ordersWithTasks.map(({ order, tasks }) => {
                                const progress = getOrderProgress(tasks);
                                const allApproved = progress.approved === progress.total;

                                return (
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
                                            <div className="flex items-center space-x-3">
                                                <span className="text-sm text-gray-500">
                                                    {progress.approved}/{progress.total} approved
                                                </span>
                                                {allApproved && (
                                                    <button
                                                        onClick={() => handleCompleteMarking(order.orderId)}
                                                        disabled={actionLoading === order.orderId}
                                                        className="btn btn-primary btn-sm"
                                                    >
                                                        {actionLoading === order.orderId ? "Processing..." : "Complete Marking →"}
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {tasks.map((task) => (
                                                <div
                                                    key={task.taskId}
                                                    className={`p-4 rounded-lg border ${task.status === "needs_rework"
                                                            ? "border-red-300 bg-red-50 dark:bg-red-900/10"
                                                            : task.status === "approved"
                                                                ? "border-green-300 bg-green-50 dark:bg-green-900/10"
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

                                                            {/* Assignment Dropdown */}
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

                                                            {/* Approve/Reject for completed tasks */}
                                                            {task.status === "completed" && (
                                                                <>
                                                                    <button
                                                                        onClick={() => handleApproveTask(task.taskId)}
                                                                        disabled={actionLoading === task.taskId}
                                                                        className="px-2 py-1 bg-green-600 text-white text-xs rounded flex items-center space-x-1 hover:bg-green-700"
                                                                    >
                                                                        <Check className="w-3 h-3" />
                                                                        <span>Approve</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setRejectModal({ taskId: task.taskId, reason: "" })}
                                                                        disabled={actionLoading === task.taskId}
                                                                        className="px-2 py-1 bg-red-600 text-white text-xs rounded flex items-center space-x-1 hover:bg-red-700"
                                                                    >
                                                                        <X className="w-3 h-3" />
                                                                        <span>Reject</span>
                                                                    </button>
                                                                </>
                                                            )}

                                                            {/* Approved indicator */}
                                                            {task.status === "approved" && task.approvedByName && (
                                                                <span className="text-xs text-green-600 dark:text-green-400">
                                                                    ✓ by {task.approvedByName}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {task.notes && (
                                                        <div className="mt-2 p-2 bg-white dark:bg-gray-900 rounded text-sm text-gray-600 dark:text-gray-400">
                                                            <AlertTriangle className="w-4 h-4 inline mr-2 text-yellow-500" />
                                                            {task.notes}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Reject Modal */}
                {rejectModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Reject Task - Needs Rework
                            </h3>
                            <textarea
                                value={rejectModal.reason}
                                onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
                                placeholder="Reason for rejection (required)"
                                className="input h-24 mb-4"
                            />
                            <div className="flex space-x-3">
                                <button
                                    onClick={() => setRejectModal(null)}
                                    className="btn btn-outline flex-1"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRejectTask}
                                    disabled={actionLoading === rejectModal.taskId || !rejectModal.reason.trim()}
                                    className="btn bg-red-600 text-white hover:bg-red-700 flex-1 disabled:opacity-50"
                                >
                                    {actionLoading === rejectModal.taskId ? "Saving..." : "Mark for Rework"}
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
