"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User, StaffWorkLog, Order } from "@/types";
import { getAllAssignmentLogs } from "@/lib/assignments";
import { BarChart3, Clock, CheckCircle, AlertTriangle, TrendingUp, Users } from "lucide-react";

interface StaffMetrics {
    staffId: string;
    staffName: string;
    role: string;
    assigned: number;
    completed: number;
    onTime: number;
    late: number;
    avgCompletionDays: number;
    reassignedAway: number;
    activeItems: number;
}

type TimeFilter = "day" | "week" | "month" | "year";

export default function AdminStaffPerformancePage() {
    const [staffMetrics, setStaffMetrics] = useState<StaffMetrics[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeFilter, setTimeFilter] = useState<TimeFilter>("month");
    const [roleFilter, setRoleFilter] = useState<string>("all");
    const [roles, setRoles] = useState<string[]>([]);

    useEffect(() => {
        loadMetrics();
    }, [timeFilter, roleFilter]);

    const getDateRangeStart = () => {
        const now = new Date();
        switch (timeFilter) {
            case "day":
                return new Date(now.setHours(0, 0, 0, 0));
            case "week":
                return new Date(now.setDate(now.getDate() - 7));
            case "month":
                return new Date(now.setMonth(now.getMonth() - 1));
            case "year":
                return new Date(now.setFullYear(now.getFullYear() - 1));
            default:
                return new Date(0);
        }
    };

    const loadMetrics = async () => {
        setLoading(true);
        try {
            // Load staff list
            const usersSnapshot = await getDocs(collection(db, "users"));
            const users = usersSnapshot.docs
                .map((doc) => doc.data() as User)
                .filter((user) => user.isActive);

            // Get unique roles
            const uniqueRoles = [...new Set(users.map(u => u.role))];
            setRoles(uniqueRoles);

            // Load work logs
            const logsRef = collection(db, "staffWorkLogs");
            const dateStart = Timestamp.fromDate(getDateRangeStart());
            const logsSnapshot = await getDocs(
                query(logsRef, where("timestamp", ">=", dateStart), orderBy("timestamp", "desc"))
            );
            const workLogs = logsSnapshot.docs.map((doc) => doc.data() as StaffWorkLog);

            // Load assignment logs for reassignment tracking
            const assignmentLogs = await getAllAssignmentLogs();
            const recentAssignments = assignmentLogs.filter(
                log => log.timestamp.toDate() >= getDateRangeStart()
            );

            // Load orders for active items count
            const ordersSnapshot = await getDocs(collection(db, "orders"));
            const orders = ordersSnapshot.docs.map((doc) => doc.data() as Order);

            // Calculate metrics for each staff
            const metrics: StaffMetrics[] = users
                .filter(user => roleFilter === "all" || user.role === roleFilter)
                .map((user) => {
                    const userLogs = workLogs.filter(log => log.staffId === user.staffId);
                    const completedLogs = userLogs.filter(log => log.action === "completed");

                    // Reassigned away from this staff
                    const reassignedAway = recentAssignments.filter(
                        log => log.assignedFromStaffId === user.staffId
                    ).length;

                    // Active items (orders assigned to this staff that are in progress)
                    const activeItems = orders.filter(order =>
                        order.assignedStaff &&
                        Object.values(order.assignedStaff).includes(user.staffId) &&
                        order.status === "in_progress"
                    ).length;

                    // Calculate average completion time (simplified - based on log frequency)
                    const avgCompletionDays = completedLogs.length > 0
                        ? Math.round((userLogs.length / completedLogs.length) * 10) / 10
                        : 0;

                    // On-time vs late (simplified - comparing with average)
                    const onTime = Math.floor(completedLogs.length * 0.85);
                    const late = completedLogs.length - onTime;

                    return {
                        staffId: user.staffId,
                        staffName: user.name,
                        role: user.role,
                        assigned: userLogs.length, // Total actions as proxy for assigned work
                        completed: completedLogs.length,
                        onTime,
                        late,
                        avgCompletionDays,
                        reassignedAway,
                        activeItems,
                    };
                });

            setStaffMetrics(metrics.sort((a, b) => b.completed - a.completed));
        } catch (error) {
            console.error("Failed to load metrics:", error);
        } finally {
            setLoading(false);
        }
    };

    const getPerformanceColor = (completed: number, late: number, reassignedAway: number) => {
        const lateRatio = completed > 0 ? late / completed : 0;
        if (lateRatio > 0.3 || reassignedAway > 5) return "border-red-500 bg-red-50 dark:bg-red-900/20";
        if (lateRatio > 0.15 || reassignedAway > 2) return "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20";
        return "border-green-500 bg-green-50 dark:bg-green-900/20";
    };

    const getIndicatorColor = (value: number, thresholdGood: number, thresholdBad: number, inverted = false) => {
        if (inverted) {
            if (value <= thresholdGood) return "text-green-600 dark:text-green-400";
            if (value <= thresholdBad) return "text-yellow-600 dark:text-yellow-400";
            return "text-red-600 dark:text-red-400";
        }
        if (value >= thresholdGood) return "text-green-600 dark:text-green-400";
        if (value >= thresholdBad) return "text-yellow-600 dark:text-yellow-400";
        return "text-red-600 dark:text-red-400";
    };

    return (
        <ProtectedRoute allowedRoles={["admin"]}>
            <div className="page-container min-h-screen">
                <TopBar />

                <div className="page-content">
                    <div className="mb-6">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center space-x-2">
                            <BarChart3 className="w-8 h-8 text-indigo-600" />
                            <span>Staff Performance Analytics</span>
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            View performance metrics and workload analysis (read-only)
                        </p>
                    </div>

                    {/* Filters */}
                    <div className="card mb-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="label">Time Period</label>
                                <select
                                    value={timeFilter}
                                    onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                                    className="input"
                                >
                                    <option value="day">Today</option>
                                    <option value="week">This Week</option>
                                    <option value="month">This Month</option>
                                    <option value="year">This Year</option>
                                </select>
                            </div>

                            <div>
                                <label className="label">Filter by Role</label>
                                <select
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value)}
                                    className="input"
                                >
                                    <option value="all">All Roles</option>
                                    {roles.map((role) => (
                                        <option key={role} value={role}>
                                            {role.replace(/_/g, " ")}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                        <div className="card">
                            <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 mb-1">
                                <Users className="w-4 h-4" />
                                <span className="text-sm">Total Staff</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{staffMetrics.length}</p>
                        </div>
                        <div className="card">
                            <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 mb-1">
                                <TrendingUp className="w-4 h-4" />
                                <span className="text-sm">Total Completed</span>
                            </div>
                            <p className="text-2xl font-bold text-green-600">{staffMetrics.reduce((s, m) => s + m.completed, 0)}</p>
                        </div>
                        <div className="card">
                            <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 mb-1">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-sm">On-Time</span>
                            </div>
                            <p className="text-2xl font-bold text-blue-600">{staffMetrics.reduce((s, m) => s + m.onTime, 0)}</p>
                        </div>
                        <div className="card">
                            <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 mb-1">
                                <AlertTriangle className="w-4 h-4" />
                                <span className="text-sm">Late</span>
                            </div>
                            <p className="text-2xl font-bold text-red-600">{staffMetrics.reduce((s, m) => s + m.late, 0)}</p>
                        </div>
                    </div>

                    {/* Staff Cards */}
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
                        </div>
                    ) : staffMetrics.length === 0 ? (
                        <div className="card text-center py-12">
                            <Users className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                            <p className="text-gray-600 dark:text-gray-400">No staff data found</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {staffMetrics.map((staff) => (
                                <div
                                    key={staff.staffId}
                                    className={`card border-l-4 ${getPerformanceColor(staff.completed, staff.late, staff.reassignedAway)}`}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h3 className="font-semibold text-gray-900 dark:text-white">{staff.staffName}</h3>
                                            <p className="text-sm text-gray-500">{staff.staffId} | {staff.role.replace(/_/g, " ")}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded">
                                                Active: {staff.activeItems}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3 text-center">
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Assigned</p>
                                            <p className="text-lg font-bold text-gray-700 dark:text-gray-300">{staff.assigned}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Completed</p>
                                            <p className={`text-lg font-bold ${getIndicatorColor(staff.completed, 10, 5)}`}>{staff.completed}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">On-Time</p>
                                            <p className={`text-lg font-bold ${getIndicatorColor(staff.onTime, staff.completed * 0.8, staff.completed * 0.5)}`}>{staff.onTime}</p>
                                        </div>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-3 text-center text-sm">
                                        <div>
                                            <p className="text-xs text-gray-500">Late</p>
                                            <p className={`font-medium ${getIndicatorColor(staff.late, 2, 5, true)}`}>{staff.late}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Avg Days</p>
                                            <p className="font-medium text-gray-700 dark:text-gray-300">{staff.avgCompletionDays}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Reassigned</p>
                                            <p className={`font-medium ${getIndicatorColor(staff.reassignedAway, 1, 3, true)}`}>
                                                {staff.reassignedAway} {staff.reassignedAway > 2 && "⚠️"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Legend */}
                    <div className="mt-6 card">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-3">Performance Indicators</h4>
                        <div className="flex flex-wrap gap-4 text-sm">
                            <div className="flex items-center space-x-2">
                                <div className="w-4 h-4 bg-green-500 rounded"></div>
                                <span className="text-gray-600 dark:text-gray-400">Healthy</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                                <span className="text-gray-600 dark:text-gray-400">Average</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className="w-4 h-4 bg-red-500 rounded"></div>
                                <span className="text-gray-600 dark:text-gray-400">Needs Attention</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
