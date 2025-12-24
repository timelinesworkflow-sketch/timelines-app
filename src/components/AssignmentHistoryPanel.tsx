"use client";

import { useState, useEffect } from "react";
import { AssignmentAuditLog } from "@/types";
import { getAssignmentLogsForOrder, getAssignmentLogsForStaff } from "@/lib/assignments";
import { History, ArrowRight, User, Clock } from "lucide-react";

interface AssignmentHistoryPanelProps {
    orderId?: string;
    staffId?: string;
    canView: boolean;  // Admin and Supervisor only
}

export default function AssignmentHistoryPanel({
    orderId,
    staffId,
    canView,
}: AssignmentHistoryPanelProps) {
    const [logs, setLogs] = useState<AssignmentAuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (!canView) {
            setLoading(false);
            return;
        }
        loadLogs();
    }, [orderId, staffId, canView]);

    const loadLogs = async () => {
        try {
            if (orderId) {
                const data = await getAssignmentLogsForOrder(orderId);
                setLogs(data);
            } else if (staffId) {
                const data = await getAssignmentLogsForStaff(staffId);
                setLogs(data);
            }
        } catch (error) {
            console.error("Failed to load assignment logs:", error);
        } finally {
            setLoading(false);
        }
    };

    if (!canView) {
        return null;
    }

    if (loading) {
        return (
            <div className="card">
                <div className="flex items-center space-x-2 mb-4">
                    <History className="w-5 h-5 text-gray-500" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">Assignment History</h3>
                </div>
                <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <History className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">Assignment History</h3>
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
                        {logs.length} entries
                    </span>
                </div>
                {logs.length > 3 && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="text-sm text-indigo-600 hover:underline"
                    >
                        {expanded ? "Show Less" : "Show All"}
                    </button>
                )}
            </div>

            {logs.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No assignment history yet</p>
            ) : (
                <div className="space-y-3">
                    {(expanded ? logs : logs.slice(0, 3)).map((log) => (
                        <div
                            key={log.logId}
                            className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-2">
                                    <span className="text-xs font-mono bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
                                        {log.itemId.slice(0, 8)}
                                    </span>
                                    {log.assignedFromStaffName && (
                                        <>
                                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                                {log.assignedFromStaffName}
                                            </span>
                                            <ArrowRight className="w-4 h-4 text-gray-400" />
                                        </>
                                    )}
                                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                        {log.assignedToStaffName}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                <div className="flex items-center space-x-1">
                                    <User className="w-3 h-3" />
                                    <span>By: {log.assignedByStaffName} ({log.assignedByRole})</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <Clock className="w-3 h-3" />
                                    <span>{log.timestamp.toDate().toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
