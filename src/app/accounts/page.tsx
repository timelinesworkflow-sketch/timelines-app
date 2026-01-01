"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { User, StaffWorkLog, SalaryLog, AdvanceLog, DailyWageLog } from "@/types";
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
} from "lucide-react";
import Toast from "@/components/Toast";
import {
    getSalaryLogs,
    getAdvanceLogs,
    getDailyWageLogs,
    creditSalary,
    createAdvanceLog,
    createDailyWageLog,
    getWeekDateRange,
    getMonthDateRange,
    getStaffWorkSummary,
} from "@/lib/salary";

type TabType = "tailors" | "aari" | "monthly";

// Staff roles for each tab
const TAILOR_ROLES = ["stitching", "stitching_checker"];
const AARI_ROLES = ["aari"];
const MONTHLY_ROLES = ["supervisor", "admin", "intake", "materials", "purchase", "billing", "delivery", "accountant"];

interface StaffSummary {
    staffId: string;
    staffName: string;
    role: string;
    ordersCompleted: number;
    ordersInProgress: number;
    totalWages: number;
    totalAdvances: number;
    netPayable: number;
    status: "pending" | "credited";
}

export default function AccountsPage() {
    const { userData } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>("tailors");
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

    // Staff list for current tab
    const [staffList, setStaffList] = useState<User[]>([]);
    const [staffSummaries, setStaffSummaries] = useState<StaffSummary[]>([]);

    // Selected staff for detail view
    const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
    const [staffDetail, setStaffDetail] = useState<{
        wages: DailyWageLog[];
        advances: AdvanceLog[];
        totalWages: number;
        totalAdvances: number;
        netPayable: number;
        isCredited: boolean;
    } | null>(null);

    // Week/Month selection
    const [currentWeek, setCurrentWeek] = useState(getWeekDateRange());
    const [currentMonth, setCurrentMonth] = useState(getMonthDateRange());

    // Modals
    const [showWageModal, setShowWageModal] = useState(false);
    const [showAdvanceModal, setShowAdvanceModal] = useState(false);
    const [showCreditModal, setShowCreditModal] = useState(false);

    // Form states
    const [wageAmount, setWageAmount] = useState("");
    const [wageNote, setWageNote] = useState("");
    const [advanceAmount, setAdvanceAmount] = useState("");
    const [advanceNote, setAdvanceNote] = useState("");
    const [saving, setSaving] = useState(false);

    // Load staff based on active tab
    useEffect(() => {
        loadStaff();
    }, [activeTab]);

    const loadStaff = async () => {
        setLoading(true);
        setSelectedStaff(null);
        setStaffDetail(null);

        try {
            const roles = activeTab === "tailors" ? TAILOR_ROLES
                : activeTab === "aari" ? AARI_ROLES
                    : MONTHLY_ROLES;

            // Get staff with these roles
            const usersRef = collection(db, "users");
            const snapshot = await getDocs(usersRef);
            const allStaff = snapshot.docs
                .map(doc => doc.data() as User)
                .filter(user => roles.includes(user.role) && user.isActive);

            setStaffList(allStaff);

            // Build summaries for each staff
            const dateRange = activeTab === "monthly" ? currentMonth : currentWeek;
            const summaries: StaffSummary[] = [];

            for (const staff of allStaff) {
                const summary = await getStaffWorkSummary(
                    staff.staffId,
                    dateRange.start,
                    dateRange.end
                );

                summaries.push({
                    staffId: staff.staffId,
                    staffName: staff.name,
                    role: staff.role,
                    ordersCompleted: summary.wages.reduce((sum, w) => sum + w.ordersWorked.length, 0),
                    ordersInProgress: 0, // Would need order tracking
                    totalWages: summary.totalWages,
                    totalAdvances: summary.totalAdvances,
                    netPayable: summary.netPayable,
                    status: summary.isCredited ? "credited" : "pending",
                });
            }

            setStaffSummaries(summaries);
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
            const dateRange = activeTab === "monthly" ? currentMonth : currentWeek;
            const detail = await getStaffWorkSummary(
                staff.staffId,
                dateRange.start,
                dateRange.end
            );

            setStaffDetail(detail);
        } catch (error) {
            console.error("Failed to load staff detail:", error);
            setToast({ message: "Failed to load staff details", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleLogWage = async () => {
        if (!selectedStaff || !userData || !wageAmount) return;

        setSaving(true);
        try {
            await createDailyWageLog({
                staffId: selectedStaff.staffId,
                staffName: selectedStaff.name,
                date: new Date(),
                ordersWorked: [], // Would be filled from work logs
                wageAmount: parseFloat(wageAmount),
                loggedById: userData.staffId,
                loggedByName: userData.name,
                notes: wageNote,
            });

            setToast({ message: "Wage logged successfully!", type: "success" });
            setShowWageModal(false);
            setWageAmount("");
            setWageNote("");
            handleSelectStaff(selectedStaff); // Refresh
        } catch (error) {
            console.error("Failed to log wage:", error);
            setToast({ message: "Failed to log wage", type: "error" });
        } finally {
            setSaving(false);
        }
    };

    const handleLogAdvance = async () => {
        if (!selectedStaff || !userData || !advanceAmount) return;

        setSaving(true);
        try {
            await createAdvanceLog({
                staffId: selectedStaff.staffId,
                staffName: selectedStaff.name,
                amount: parseFloat(advanceAmount),
                givenById: userData.staffId,
                givenByName: userData.name,
                givenByRole: userData.role as "accountant" | "admin",
                notes: advanceNote,
            });

            setToast({ message: "Advance logged successfully!", type: "success" });
            setShowAdvanceModal(false);
            setAdvanceAmount("");
            setAdvanceNote("");
            handleSelectStaff(selectedStaff); // Refresh
        } catch (error) {
            console.error("Failed to log advance:", error);
            setToast({ message: "Failed to log advance", type: "error" });
        } finally {
            setSaving(false);
        }
    };

    const handleCreditSalary = async () => {
        if (!selectedStaff || !userData || !staffDetail) return;

        setSaving(true);
        try {
            const dateRange = activeTab === "monthly" ? currentMonth : currentWeek;

            await creditSalary({
                staffId: selectedStaff.staffId,
                staffName: selectedStaff.name,
                role: selectedStaff.role,
                salaryType: activeTab === "monthly" ? "monthly" : "weekly",
                periodStart: dateRange.start,
                periodEnd: dateRange.end,
                totalWage: staffDetail.totalWages,
                advanceAmount: staffDetail.totalAdvances,
                creditedById: userData.staffId,
                creditedByName: userData.name,
                creditedByRole: userData.role as "accountant" | "admin",
            });

            setToast({ message: `Salary credited: ₹${staffDetail.netPayable.toFixed(2)}`, type: "success" });
            setShowCreditModal(false);
            handleSelectStaff(selectedStaff); // Refresh
            loadStaff(); // Refresh list
        } catch (error) {
            console.error("Failed to credit salary:", error);
            setToast({ message: "Failed to credit salary", type: "error" });
        } finally {
            setSaving(false);
        }
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    };

    const tabs = [
        { id: "tailors" as const, label: "Tailors / Stitching", icon: Users },
        { id: "aari" as const, label: "AARI Workers", icon: Sparkles },
        { id: "monthly" as const, label: "Monthly Salary", icon: Briefcase },
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
                                if (activeTab === "monthly") {
                                    const prev = new Date(currentMonth.start);
                                    prev.setMonth(prev.getMonth() - 1);
                                    setCurrentMonth(getMonthDateRange(prev));
                                } else {
                                    const prev = new Date(currentWeek.start);
                                    prev.setDate(prev.getDate() - 7);
                                    setCurrentWeek(getWeekDateRange(prev));
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
                                {activeTab === "monthly"
                                    ? currentMonth.start.toLocaleDateString("en-IN", { month: "long", year: "numeric" })
                                    : `${formatDate(currentWeek.start)} - ${formatDate(currentWeek.end)}`
                                }
                            </p>
                        </div>

                        <button
                            onClick={() => {
                                if (activeTab === "monthly") {
                                    const next = new Date(currentMonth.start);
                                    next.setMonth(next.getMonth() + 1);
                                    setCurrentMonth(getMonthDateRange(next));
                                } else {
                                    const next = new Date(currentWeek.start);
                                    next.setDate(next.getDate() + 7);
                                    setCurrentWeek(getWeekDateRange(next));
                                }
                            }}
                            className="p-2 rounded-lg bg-slate-700 text-gray-300 hover:bg-slate-600"
                        >
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Main Content */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Staff List (Level 1) */}
                        <div className="lg:col-span-1 bg-slate-800 rounded-xl p-4">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <Users className="w-5 h-5 text-green-500" />
                                Staff List
                            </h3>

                            {loading && !selectedStaff ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent"></div>
                                </div>
                            ) : staffSummaries.length === 0 ? (
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
                                                    <p className="text-xs opacity-70">{summary.staffId}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-bold">₹{summary.netPayable.toFixed(0)}</p>
                                                    <span className={`text-xs px-2 py-0.5 rounded ${summary.status === "credited"
                                                        ? "bg-green-500/20 text-green-400"
                                                        : "bg-yellow-500/20 text-yellow-400"
                                                        }`}>
                                                        {summary.status === "credited" ? "Paid" : "Pending"}
                                                    </span>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Staff Detail (Level 2) */}
                        <div className="lg:col-span-2 bg-slate-800 rounded-xl p-4">
                            {!selectedStaff ? (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                    <ArrowLeft className="w-16 h-16 mb-4 opacity-30" />
                                    <p>Select a staff member to view details</p>
                                </div>
                            ) : loading ? (
                                <div className="flex items-center justify-center py-16">
                                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-green-500 border-t-transparent"></div>
                                </div>
                            ) : staffDetail ? (
                                <div>
                                    {/* Staff Header */}
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h3 className="text-xl font-bold text-white">{selectedStaff.name}</h3>
                                            <p className="text-sm text-gray-400">{selectedStaff.staffId} • {selectedStaff.role}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setShowWageModal(true)}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Log Wage
                                            </button>
                                            <button
                                                onClick={() => setShowAdvanceModal(true)}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Advance
                                            </button>
                                        </div>
                                    </div>

                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-3 gap-4 mb-6">
                                        <div className="bg-slate-700 rounded-lg p-4 text-center">
                                            <p className="text-sm text-gray-400">Total Wages</p>
                                            <p className="text-2xl font-bold text-green-400">₹{staffDetail.totalWages.toFixed(0)}</p>
                                        </div>
                                        <div className="bg-slate-700 rounded-lg p-4 text-center">
                                            <p className="text-sm text-gray-400">Advances</p>
                                            <p className="text-2xl font-bold text-orange-400">₹{staffDetail.totalAdvances.toFixed(0)}</p>
                                        </div>
                                        <div className="bg-slate-700 rounded-lg p-4 text-center">
                                            <p className="text-sm text-gray-400">Net Payable</p>
                                            <p className="text-2xl font-bold text-white">₹{staffDetail.netPayable.toFixed(0)}</p>
                                        </div>
                                    </div>

                                    {/* Wage History */}
                                    <div className="mb-4">
                                        <h4 className="text-sm font-semibold text-gray-400 mb-2">Daily Wages</h4>
                                        {staffDetail.wages.length === 0 ? (
                                            <p className="text-gray-500 text-sm">No wages logged for this period</p>
                                        ) : (
                                            <div className="bg-slate-900 rounded-lg overflow-hidden">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-slate-700">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left text-gray-400">Date</th>
                                                            <th className="px-3 py-2 text-left text-gray-400">Orders</th>
                                                            <th className="px-3 py-2 text-right text-gray-400">Amount</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {staffDetail.wages.map(wage => (
                                                            <tr key={wage.wageLogId} className="border-t border-slate-700">
                                                                <td className="px-3 py-2 text-gray-300">
                                                                    {wage.date.toDate().toLocaleDateString("en-IN")}
                                                                </td>
                                                                <td className="px-3 py-2 text-gray-300">
                                                                    {wage.ordersWorked.length} orders
                                                                </td>
                                                                <td className="px-3 py-2 text-right text-green-400">
                                                                    ₹{wage.wageAmount.toFixed(0)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* Advances History */}
                                    {staffDetail.advances.length > 0 && (
                                        <div className="mb-4">
                                            <h4 className="text-sm font-semibold text-gray-400 mb-2">Advances</h4>
                                            <div className="bg-slate-900 rounded-lg overflow-hidden">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-slate-700">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left text-gray-400">Date</th>
                                                            <th className="px-3 py-2 text-left text-gray-400">Given By</th>
                                                            <th className="px-3 py-2 text-right text-gray-400">Amount</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {staffDetail.advances.map(adv => (
                                                            <tr key={adv.advanceId} className="border-t border-slate-700">
                                                                <td className="px-3 py-2 text-gray-300">
                                                                    {adv.date.toDate().toLocaleDateString("en-IN")}
                                                                </td>
                                                                <td className="px-3 py-2 text-gray-300">
                                                                    {adv.givenByName}
                                                                </td>
                                                                <td className="px-3 py-2 text-right text-orange-400">
                                                                    ₹{adv.amount.toFixed(0)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Credit Button */}
                                    {!staffDetail.isCredited && staffDetail.netPayable > 0 && (
                                        <button
                                            onClick={() => setShowCreditModal(true)}
                                            className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
                                        >
                                            <CreditCard className="w-5 h-5" />
                                            Credit Salary: ₹{staffDetail.netPayable.toFixed(0)}
                                        </button>
                                    )}

                                    {staffDetail.isCredited && (
                                        <div className="mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-green-900/30 text-green-400 rounded-lg">
                                            <Check className="w-5 h-5" />
                                            Salary Credited for this period
                                        </div>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>

                {/* Log Wage Modal */}
                {showWageModal && selectedStaff && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md">
                            <h3 className="text-lg font-bold text-white mb-4">Log Daily Wage</h3>
                            <p className="text-sm text-gray-400 mb-4">{selectedStaff.name}</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Amount (₹)</label>
                                    <input
                                        type="number"
                                        value={wageAmount}
                                        onChange={e => setWageAmount(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg"
                                        placeholder="Enter wage amount"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Notes (optional)</label>
                                    <input
                                        type="text"
                                        value={wageNote}
                                        onChange={e => setWageNote(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg"
                                        placeholder="Any notes"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 mt-6">
                                <button
                                    onClick={() => setShowWageModal(false)}
                                    className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleLogWage}
                                    disabled={!wageAmount || saving}
                                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                >
                                    {saving ? "Saving..." : "Log Wage"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Log Advance Modal */}
                {showAdvanceModal && selectedStaff && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md">
                            <h3 className="text-lg font-bold text-white mb-4">Log Advance</h3>
                            <p className="text-sm text-gray-400 mb-4">{selectedStaff.name}</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Amount (₹)</label>
                                    <input
                                        type="number"
                                        value={advanceAmount}
                                        onChange={e => setAdvanceAmount(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg"
                                        placeholder="Enter advance amount"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Notes (optional)</label>
                                    <input
                                        type="text"
                                        value={advanceNote}
                                        onChange={e => setAdvanceNote(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg"
                                        placeholder="Reason for advance"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 mt-6">
                                <button
                                    onClick={() => setShowAdvanceModal(false)}
                                    className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleLogAdvance}
                                    disabled={!advanceAmount || saving}
                                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                                >
                                    {saving ? "Saving..." : "Log Advance"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Credit Salary Modal */}
                {showCreditModal && selectedStaff && staffDetail && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md">
                            <h3 className="text-lg font-bold text-white mb-4">Confirm Salary Credit</h3>

                            <div className="bg-slate-700 rounded-lg p-4 mb-4">
                                <div className="flex justify-between mb-2">
                                    <span className="text-gray-400">Staff:</span>
                                    <span className="text-white font-medium">{selectedStaff.name}</span>
                                </div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-gray-400">Total Wages:</span>
                                    <span className="text-green-400">₹{staffDetail.totalWages.toFixed(0)}</span>
                                </div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-gray-400">Advances:</span>
                                    <span className="text-orange-400">- ₹{staffDetail.totalAdvances.toFixed(0)}</span>
                                </div>
                                <hr className="border-slate-600 my-2" />
                                <div className="flex justify-between">
                                    <span className="text-white font-bold">Net Payable:</span>
                                    <span className="text-white font-bold text-xl">₹{staffDetail.netPayable.toFixed(0)}</span>
                                </div>
                            </div>

                            <p className="text-sm text-gray-400 mb-4">
                                This will mark the salary as credited for this period. This action is logged.
                            </p>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowCreditModal(false)}
                                    className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreditSalary}
                                    disabled={saving}
                                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                >
                                    {saving ? "Processing..." : "Credit Salary"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
