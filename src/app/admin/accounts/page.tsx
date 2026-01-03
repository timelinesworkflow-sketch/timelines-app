"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { useAuth } from "@/contexts/AuthContext";
import { User, SalaryLedger, StaffWorkLog, calculatePaymentStatus } from "@/types";
import { Timestamp } from "firebase/firestore";
import {
    DollarSign,
    Users,
    Calendar,
    CreditCard,
    ArrowRight,
    ArrowLeft,
    Plus,
    Check,
    X,
    AlertCircle,
    Clock,
    Sparkles,
    Briefcase,
    FileText,
    Eye,
} from "lucide-react";
import Toast from "@/components/Toast";
import {
    getStitchingStaff,
    getAariStaff,
    getMonthlyStaff,
    getSalaryLedgerEntries,
    getStaffWorkLogs,
    getStaffWorkSummary,
    createSalaryLedgerEntry,
    updateSalaryLedgerEntry,
    getWeekDateRange,
    getMonthDateRange,
    mapRoleToSalaryRole,
    getSalaryTypeForRole,
    StaffSalarySummary,
    getStaffSalarySummaries,
} from "@/lib/salaryLedger";

type TabType = "stitching" | "aari" | "monthly";

export default function AccountsPage() {
    const { userData } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>("stitching");
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

    // Staff list
    const [staffList, setStaffList] = useState<User[]>([]);
    const [staffSummaries, setStaffSummaries] = useState<StaffSalarySummary[]>([]);

    // Selected staff for detail view
    const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
    const [staffWorkLogs, setStaffWorkLogs] = useState<StaffWorkLog[]>([]);
    const [staffSalaryHistory, setStaffSalaryHistory] = useState<SalaryLedger[]>([]);

    // Date range
    const [dateRange, setDateRange] = useState(getWeekDateRange());

    // Salary entry form
    const [showSalaryForm, setShowSalaryForm] = useState(false);
    const [grossAmount, setGrossAmount] = useState("");
    const [advanceAmount, setAdvanceAmount] = useState("");
    const [paidAmount, setPaidAmount] = useState("");
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);

    // Load staff based on active tab
    useEffect(() => {
        loadStaff();
    }, [activeTab]);

    const loadStaff = async () => {
        setLoading(true);
        setSelectedStaff(null);

        try {
            let staff: User[] = [];

            if (activeTab === "stitching") {
                staff = await getStitchingStaff();
                setDateRange(getWeekDateRange());
            } else if (activeTab === "aari") {
                staff = await getAariStaff();
                setDateRange(getWeekDateRange());
            } else {
                staff = await getMonthlyStaff();
                setDateRange(getMonthDateRange());
            }

            setStaffList(staff);

            // Get summaries for each staff - don't fail if this throws
            try {
                const summaries = await getStaffSalarySummaries(staff);
                setStaffSummaries(summaries);
            } catch (summaryError) {
                console.warn("Failed to load summaries, using defaults:", summaryError);
                // Create default summaries so staff still appears in list
                const defaultSummaries: StaffSalarySummary[] = staff.map(s => ({
                    staffId: s.staffId,
                    staffName: s.name,
                    staffRole: s.role,
                    totalOrders: 0,
                    lastPaymentStatus: "none" as const,
                    lastPaymentDate: null,
                    pendingAmount: 0,
                }));
                setStaffSummaries(defaultSummaries);
            }
        } catch (error) {
            console.error("Failed to load staff:", error);
            setToast({ message: "Failed to load staff data", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleSelectStaff = async (staff: User) => {
        setSelectedStaff(staff);
        setLoading(true);

        try {
            // Load work logs for date range
            const workLogs = await getStaffWorkLogs(staff.staffId, dateRange.start, dateRange.end);
            setStaffWorkLogs(workLogs);

            // Load salary history
            const salaryHistory = await getSalaryLedgerEntries(staff.staffId);
            setStaffSalaryHistory(salaryHistory);
        } catch (error) {
            console.error("Failed to load staff details:", error);
            setToast({ message: "Failed to load staff details", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSalaryEntry = async () => {
        if (!selectedStaff || !userData || !grossAmount) {
            setToast({ message: "Please enter gross amount", type: "error" });
            return;
        }

        setSaving(true);
        try {
            const gross = parseFloat(grossAmount) || 0;
            const advance = parseFloat(advanceAmount) || 0;
            const paid = parseFloat(paidAmount) || 0;

            // Get work summary for the period
            const workSummary = await getStaffWorkSummary(
                selectedStaff.staffId,
                dateRange.start,
                dateRange.end
            );

            await createSalaryLedgerEntry({
                staffId: selectedStaff.staffId,
                staffName: selectedStaff.name,
                staffRole: mapRoleToSalaryRole(selectedStaff.role),
                salaryType: getSalaryTypeForRole(selectedStaff.role),
                workSummary,
                grossAmount: gross,
                advanceAmount: advance,
                paidAmount: paid,
                creditedByRole: userData.role as "accountant" | "admin",
                creditedById: userData.staffId,
                creditedByName: userData.name,
                notes,
            });

            setToast({ message: "Salary entry created successfully!", type: "success" });
            setShowSalaryForm(false);
            setGrossAmount("");
            setAdvanceAmount("");
            setPaidAmount("");
            setNotes("");

            // Refresh data
            handleSelectStaff(selectedStaff);
            loadStaff();
        } catch (error) {
            console.error("Failed to create salary entry:", error);
            setToast({ message: "Failed to create salary entry", type: "error" });
        } finally {
            setSaving(false);
        }
    };

    // Calculate net payable and payment status preview
    const netPayable = (parseFloat(grossAmount) || 0) - (parseFloat(advanceAmount) || 0);
    const previewStatus = calculatePaymentStatus(netPayable, parseFloat(paidAmount) || 0);

    const formatDate = (date: Date) => {
        return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    };

    const formatCurrency = (amount: number) => {
        return `₹${amount.toLocaleString("en-IN")}`;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "paid": return "bg-green-500/20 text-green-400";
            case "partially_paid": return "bg-yellow-500/20 text-yellow-400";
            case "pending": return "bg-red-500/20 text-red-400";
            default: return "bg-gray-500/20 text-gray-400";
        }
    };

    const tabs = [
        { id: "stitching" as const, label: "Stitching / Tailors", icon: Users },
        { id: "aari" as const, label: "AARI Workers", icon: Sparkles },
        { id: "monthly" as const, label: "Monthly Staff", icon: Briefcase },
    ];

    return (
        <ProtectedRoute allowedRoles={["accountant", "admin"]}>
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                <TopBar />

                {toast && (
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )}

                <div className="max-w-7xl mx-auto px-4 py-6">
                    {/* Header */}
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <DollarSign className="w-8 h-8 text-green-500" />
                            Accounts Dashboard
                        </h1>
                        <p className="text-gray-400 mt-1">
                            Staff salary management & payroll tracking
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${activeTab === tab.id
                                    ? "bg-green-600 text-white"
                                    : "bg-slate-700 text-gray-300 hover:bg-slate-600"
                                    }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Period Selector */}
                    <div className="bg-slate-800 rounded-xl p-4 mb-6 flex items-center justify-between">
                        <button
                            onClick={() => {
                                const prev = new Date(dateRange.start);
                                if (activeTab === "monthly") {
                                    prev.setMonth(prev.getMonth() - 1);
                                    setDateRange(getMonthDateRange(prev));
                                } else {
                                    prev.setDate(prev.getDate() - 7);
                                    setDateRange(getWeekDateRange(prev));
                                }
                            }}
                            className="p-2 rounded-lg bg-slate-700 text-gray-300 hover:bg-slate-600"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>

                        <div className="text-center">
                            <p className="text-sm text-gray-400">
                                {activeTab === "monthly" ? "Month" : "Week"}
                            </p>
                            <p className="text-lg font-semibold text-white">
                                {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
                            </p>
                        </div>

                        <button
                            onClick={() => {
                                const next = new Date(dateRange.start);
                                if (activeTab === "monthly") {
                                    next.setMonth(next.getMonth() + 1);
                                    setDateRange(getMonthDateRange(next));
                                } else {
                                    next.setDate(next.getDate() + 7);
                                    setDateRange(getWeekDateRange(next));
                                }
                            }}
                            className="p-2 rounded-lg bg-slate-700 text-gray-300 hover:bg-slate-600"
                        >
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Main Content */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Staff List */}
                        <div className="lg:col-span-1 bg-slate-800 rounded-xl p-4">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <Users className="w-5 h-5 text-green-500" />
                                Staff List
                            </h3>

                            {loading && !selectedStaff ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent"></div>
                                </div>
                            ) : staffList.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>No staff found for this category</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                    {staffSummaries.map(summary => (
                                        <button
                                            key={summary.staffId}
                                            onClick={() => {
                                                const staff = staffList.find(s => s.staffId === summary.staffId);
                                                if (staff) handleSelectStaff(staff);
                                            }}
                                            className={`w-full text-left p-3 rounded-lg transition-all ${selectedStaff?.staffId === summary.staffId
                                                ? "bg-green-600 text-white"
                                                : "bg-slate-700 text-gray-300 hover:bg-slate-600"
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium">{summary.staffName}</p>
                                                    <p className="text-xs opacity-70">
                                                        {summary.staffId} • {summary.totalOrders} orders
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    {summary.pendingAmount > 0 && (
                                                        <p className="text-sm font-bold text-orange-400">
                                                            {formatCurrency(summary.pendingAmount)}
                                                        </p>
                                                    )}
                                                    <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(summary.lastPaymentStatus)}`}>
                                                        {summary.lastPaymentStatus === "none" ? "New" : summary.lastPaymentStatus.replace("_", " ")}
                                                    </span>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Staff Detail */}
                        <div className="lg:col-span-2 bg-slate-800 rounded-xl p-4">
                            {!selectedStaff ? (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                    <Eye className="w-16 h-16 mb-4 opacity-30" />
                                    <p>Select a staff member to view details</p>
                                </div>
                            ) : (
                                <div>
                                    {/* Staff Header */}
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h3 className="text-xl font-bold text-white">{selectedStaff.name}</h3>
                                            <p className="text-sm text-gray-400">
                                                {selectedStaff.staffId} • {selectedStaff.role.replace(/_/g, " ")}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setShowSalaryForm(true)}
                                            className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                        >
                                            <Plus className="w-4 h-4" />
                                            New Salary Entry
                                        </button>
                                    </div>

                                    {/* Work History */}
                                    <div className="mb-6">
                                        <h4 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                                            <FileText className="w-4 h-4" />
                                            Work History ({formatDate(dateRange.start)} - {formatDate(dateRange.end)})
                                        </h4>

                                        {loading ? (
                                            <div className="flex justify-center py-4">
                                                <div className="animate-spin rounded-full h-6 w-6 border-2 border-green-500 border-t-transparent"></div>
                                            </div>
                                        ) : staffWorkLogs.length === 0 ? (
                                            <p className="text-gray-500 text-sm py-4">No work logs for this period</p>
                                        ) : (
                                            <div className="bg-slate-900 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-slate-700 sticky top-0">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left text-gray-400">Date</th>
                                                            <th className="px-3 py-2 text-left text-gray-400">Order</th>
                                                            <th className="px-3 py-2 text-left text-gray-400">Stage</th>
                                                            <th className="px-3 py-2 text-left text-gray-400">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {staffWorkLogs.slice(0, 20).map((log, i) => (
                                                            <tr key={i} className="border-t border-slate-700">
                                                                <td className="px-3 py-2 text-gray-300">
                                                                    {log.timestamp.toDate().toLocaleDateString("en-IN")}
                                                                </td>
                                                                <td className="px-3 py-2 text-gray-300 font-mono text-xs">
                                                                    {log.orderId.slice(-8)}
                                                                </td>
                                                                <td className="px-3 py-2 text-gray-300">
                                                                    {log.stage}
                                                                </td>
                                                                <td className="px-3 py-2 text-gray-300">
                                                                    {log.action}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* Salary History */}
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                                            <DollarSign className="w-4 h-4" />
                                            Salary History
                                        </h4>

                                        {staffSalaryHistory.length === 0 ? (
                                            <p className="text-gray-500 text-sm py-4">No salary records yet</p>
                                        ) : (
                                            <div className="bg-slate-900 rounded-lg overflow-hidden">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-slate-700">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left text-gray-400">Period</th>
                                                            <th className="px-3 py-2 text-right text-gray-400">Gross</th>
                                                            <th className="px-3 py-2 text-right text-gray-400">Advance</th>
                                                            <th className="px-3 py-2 text-right text-gray-400">Net</th>
                                                            <th className="px-3 py-2 text-right text-gray-400">Paid</th>
                                                            <th className="px-3 py-2 text-center text-gray-400">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {staffSalaryHistory.slice(0, 10).map((entry) => (
                                                            <tr key={entry.ledgerId} className="border-t border-slate-700">
                                                                <td className="px-3 py-2 text-gray-300 text-xs">
                                                                    {entry.workSummary.fromDate.toDate().toLocaleDateString("en-IN")}
                                                                    {" - "}
                                                                    {entry.workSummary.toDate.toDate().toLocaleDateString("en-IN")}
                                                                </td>
                                                                <td className="px-3 py-2 text-right text-gray-300">
                                                                    {formatCurrency(entry.grossAmount)}
                                                                </td>
                                                                <td className="px-3 py-2 text-right text-orange-400">
                                                                    {entry.advanceAmount > 0 ? `-${formatCurrency(entry.advanceAmount)}` : "-"}
                                                                </td>
                                                                <td className="px-3 py-2 text-right text-white font-medium">
                                                                    {formatCurrency(entry.netPayable)}
                                                                </td>
                                                                <td className="px-3 py-2 text-right text-green-400">
                                                                    {formatCurrency(entry.paidAmount)}
                                                                </td>
                                                                <td className="px-3 py-2 text-center">
                                                                    <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(entry.paymentStatus)}`}>
                                                                        {entry.paymentStatus.replace("_", " ")}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Salary Entry Modal */}
                {showSalaryForm && selectedStaff && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md">
                            <h3 className="text-lg font-bold text-white mb-2">New Salary Entry</h3>
                            <p className="text-sm text-gray-400 mb-4">
                                {selectedStaff.name} • {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Gross Amount (₹)</label>
                                    <input
                                        type="text"
                                        value={grossAmount}
                                        onChange={e => setGrossAmount(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg"
                                        placeholder="Enter gross amount"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Advance Amount (₹) - Optional</label>
                                    <input
                                        type="text"
                                        value={advanceAmount}
                                        onChange={e => setAdvanceAmount(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg"
                                        placeholder="Enter advance (if any)"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Paid Amount (₹)</label>
                                    <input
                                        type="text"
                                        value={paidAmount}
                                        onChange={e => setPaidAmount(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg"
                                        placeholder="Enter paid amount"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Notes (Optional)</label>
                                    <input
                                        type="text"
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg"
                                        placeholder="Any notes"
                                    />
                                </div>

                                {/* Auto-calculated preview */}
                                <div className="bg-slate-900 rounded-lg p-4">
                                    <div className="flex justify-between mb-2">
                                        <span className="text-gray-400">Net Payable:</span>
                                        <span className="text-white font-bold">{formatCurrency(Math.max(netPayable, 0))}</span>
                                    </div>
                                    <div className="flex justify-between mb-2">
                                        <span className="text-gray-400">Balance:</span>
                                        <span className={`font-bold ${netPayable - (parseFloat(paidAmount) || 0) > 0 ? "text-orange-400" : "text-green-400"}`}>
                                            {formatCurrency(Math.max(netPayable - (parseFloat(paidAmount) || 0), 0))}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Status:</span>
                                        <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(previewStatus)}`}>
                                            {previewStatus.replace("_", " ")}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 mt-6">
                                <button
                                    onClick={() => {
                                        setShowSalaryForm(false);
                                        setGrossAmount("");
                                        setAdvanceAmount("");
                                        setPaidAmount("");
                                        setNotes("");
                                    }}
                                    className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateSalaryEntry}
                                    disabled={!grossAmount || saving}
                                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                >
                                    {saving ? "Saving..." : "Create Entry"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
