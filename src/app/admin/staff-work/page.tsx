"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { StaffWorkLog } from "@/types";
import { Calendar, User } from "lucide-react";

export default function AdminStaffWorkPage() {
    const [staffList, setStaffList] = useState<{ staffId: string; name: string }[]>([]);
    const [selectedStaffId, setSelectedStaffId] = useState("");
    const [workLogs, setWorkLogs] = useState<StaffWorkLog[]>([]);
    const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "custom">("week");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadStaffList();
    }, []);

    useEffect(() => {
        if (selectedStaffId) {
            loadWorkLogs();
        }
    }, [selectedStaffId, dateRange]);

    const loadStaffList = async () => {
        const usersSnapshot = await getDocs(collection(db, "users"));
        const staff = usersSnapshot.docs.map((doc) => ({
            staffId: doc.data().staffId,
            name: doc.data().name,
        }));
        setStaffList(staff);
    };

    const getDateRangeStart = () => {
        const now = new Date();
        switch (dateRange) {
            case "today":
                return Timestamp.fromDate(new Date(now.setHours(0, 0, 0, 0)));
            case "week":
                return Timestamp.fromDate(new Date(now.setDate(now.getDate() - 7)));
            case "month":
                return Timestamp.fromDate(new Date(now.setMonth(now.getMonth() - 1)));
            default:
                return Timestamp.fromDate(new Date(0));
        }
    };

    const loadWorkLogs = async () => {
        if (!selectedStaffId) return;

        setLoading(true);
        try {
            const logsRef = collection(db, "staffWorkLogs");
            const q = query(
                logsRef,
                where("staffId", "==", selectedStaffId),
                where("timestamp", ">=", getDateRangeStart()),
                orderBy("timestamp", "desc")
            );

            const snapshot = await getDocs(q);
            const logs = snapshot.docs.map((doc) => doc.data() as StaffWorkLog);
            setWorkLogs(logs);
        } catch (error) {
            console.error("Failed to load work logs:", error);
        } finally {
            setLoading(false);
        }
    };

    const uniqueOrders = new Set(workLogs.map((log) => log.orderId)).size;
    const totalActions = workLogs.length;

    const stageCounts = workLogs.reduce((acc, log) => {
        acc[log.stage] = (acc[log.stage] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <ProtectedRoute allowedRoles={["admin"]}>
            <div className="page-container min-h-screen">
                <TopBar />

                <div className="page-content">
                    <div className="mb-6">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Staff Work & Payments
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            View staff work logs and manage payments
                        </p>
                    </div>

                    {/* Filters */}
                    <div className="card mb-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="label">Select Staff</label>
                                <select
                                    value={selectedStaffId}
                                    onChange={(e) => setSelectedStaffId(e.target.value)}
                                    className="input"
                                >
                                    <option value="">-- Select Staff --</option>
                                    {staffList.map((staff) => (
                                        <option key={staff.staffId} value={staff.staffId}>
                                            {staff.name} ({staff.staffId})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="label">Date Range</label>
                                <select
                                    value={dateRange}
                                    onChange={(e) => setDateRange(e.target.value as any)}
                                    className="input"
                                >
                                    <option value="today">Today</option>
                                    <option value="week">This Week</option>
                                    <option value="month">This Month</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {selectedStaffId && (
                        <>
                            {/* Summary */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                                <div className="card">
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Actions</p>
                                    <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                                        {totalActions}
                                    </p>
                                </div>
                                <div className="card">
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Unique Orders</p>
                                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                                        {uniqueOrders}
                                    </p>
                                </div>
                                <div className="card">
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Stages Worked</p>
                                    <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                                        {Object.keys(stageCounts).length}
                                    </p>
                                </div>
                            </div>

                            {/* Stage Breakdown */}
                            {Object.keys(stageCounts).length > 0 && (
                                <div className="card mb-6">
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                                        Stage Breakdown
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {Object.entries(stageCounts).map(([stage, count]) => (
                                            <div key={stage} className="bg-gray-50 dark:bg-gray-800 rounded p-3">
                                                <p className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                                                    {stage.replace(/_/g, " ")}
                                                </p>
                                                <p className="text-xl font-bold text-gray-900 dark:text-white">{count}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Work Logs Table */}
                            <div className="card">
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Work History</h3>
                                {loading ? (
                                    <div className="text-center py-8">
                                        <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent mx-auto"></div>
                                    </div>
                                ) : workLogs.length === 0 ? (
                                    <p className="text-gray-600 dark:text-gray-400 text-center py-8">
                                        No work logs found for this period
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="border-b border-gray-200 dark:border-gray-700">
                                                <tr className="text-left">
                                                    <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                        Date/Time
                                                    </th>
                                                    <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                        Order ID
                                                    </th>
                                                    <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                        Stage
                                                    </th>
                                                    <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                        Action
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                                {workLogs.map((log, idx) => (
                                                    <tr key={idx}>
                                                        <td className="py-3 text-sm text-gray-900 dark:text-white">
                                                            {log.timestamp.toDate().toLocaleString()}
                                                        </td>
                                                        <td className="py-3 text-sm text-gray-600 dark:text-gray-400">
                                                            {log.orderId.slice(0, 8)}...
                                                        </td>
                                                        <td className="py-3">
                                                            <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded text-xs capitalize">
                                                                {log.stage.replace(/_/g, " ")}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 text-sm text-gray-600 dark:text-gray-400 capitalize">
                                                            {log.action.replace(/_/g, " ")}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
