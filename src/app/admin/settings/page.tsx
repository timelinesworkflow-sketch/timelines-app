"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { StageDefaults } from "@/types";
import { Save } from "lucide-react";
import Toast from "@/components/Toast";

export default function AdminSettingsPage() {
    const [settings, setSettings] = useState<StageDefaults>({});
    const [staffList, setStaffList] = useState<{ staffId: string; name: string; role: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

    useEffect(() => {
        loadSettings();
        loadStaffList();
    }, []);

    const loadSettings = async () => {
        try {
            const settingsDoc = await getDoc(doc(db, "settings", "stageDefaults"));
            if (settingsDoc.exists()) {
                setSettings(settingsDoc.data() as StageDefaults);
            }
        } catch (error) {
            console.error("Failed to load settings:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadStaffList = async () => {
        try {
            const usersSnapshot = await getDocs(collection(db, "users"));
            const staff = usersSnapshot.docs.map((doc) => ({
                staffId: doc.data().staffId,
                name: doc.data().name,
                role: doc.data().role,
            }));
            setStaffList(staff);
        } catch (error) {
            console.error("Failed to load staff list:", error);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, "settings", "stageDefaults"), settings);
            setToast({ message: "Settings saved successfully!", type: "success" });
        } catch (error) {
            console.error("Failed to save settings:", error);
            setToast({ message: "Failed to save settings", type: "error" });
        } finally {
            setSaving(false);
        }
    };

    const getStaffForRole = (role: string) => {
        return staffList.filter((s) => s.role === role || s.role === "supervisor" || s.role === "admin");
    };

    if (loading) {
        return (
            <ProtectedRoute allowedRoles={["admin"]}>
                <div className="page-container min-h-screen">
                    <TopBar />
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute allowedRoles={["admin"]}>
            <div className="page-container min-h-screen">
                <TopBar />
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

                <div className="page-content">
                    <div className="mb-6">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Settings
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Configure default stage assignments
                        </p>
                    </div>

                    <div className="card max-w-2xl">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                            Default Staff Assignments
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                            Set default staff for each stage. Intake can override these for specific orders.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="label">Materials Default Staff</label>
                                <select
                                    value={settings.materialsDefaultStaffId || ""}
                                    onChange={(e) => setSettings({ ...settings, materialsDefaultStaffId: e.target.value })}
                                    className="input"
                                >
                                    <option value="">-- No Default --</option>
                                    {getStaffForRole("materials").map((staff) => (
                                        <option key={staff.staffId} value={staff.staffId}>
                                            {staff.name} ({staff.staffId})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="label">Marking Default Staff</label>
                                <select
                                    value={settings.markingDefaultStaffId || ""}
                                    onChange={(e) => setSettings({ ...settings, markingDefaultStaffId: e.target.value })}
                                    className="input"
                                >
                                    <option value="">-- No Default --</option>
                                    {getStaffForRole("marking").map((staff) => (
                                        <option key={staff.staffId} value={staff.staffId}>
                                            {staff.name} ({staff.staffId})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="label">Cutting Default Staff</label>
                                <select
                                    value={settings.cuttingDefaultStaffId || ""}
                                    onChange={(e) => setSettings({ ...settings, cuttingDefaultStaffId: e.target.value })}
                                    className="input"
                                >
                                    <option value="">-- No Default --</option>
                                    {getStaffForRole("cutting").map((staff) => (
                                        <option key={staff.staffId} value={staff.staffId}>
                                            {staff.name} ({staff.staffId})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="label">Stitching Default Staff</label>
                                <select
                                    value={settings.stitchingDefaultStaffId || ""}
                                    onChange={(e) => setSettings({ ...settings, stitchingDefaultStaffId: e.target.value })}
                                    className="input"
                                >
                                    <option value="">-- No Default --</option>
                                    {getStaffForRole("stitching").map((staff) => (
                                        <option key={staff.staffId} value={staff.staffId}>
                                            {staff.name} ({staff.staffId})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="label">Hooks Default Staff</label>
                                <select
                                    value={settings.hooksDefaultStaffId || ""}
                                    onChange={(e) => setSettings({ ...settings, hooksDefaultStaffId: e.target.value })}
                                    className="input"
                                >
                                    <option value="">-- No Default --</option>
                                    {getStaffForRole("hooks").map((staff) => (
                                        <option key={staff.staffId} value={staff.staffId}>
                                            {staff.name} ({staff.staffId})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="label">Ironing Default Staff</label>
                                <select
                                    value={settings.ironingDefaultStaffId || ""}
                                    onChange={(e) => setSettings({ ...settings, ironingDefaultStaffId: e.target.value })}
                                    className="input"
                                >
                                    <option value="">-- No Default --</option>
                                    {getStaffForRole("ironing").map((staff) => (
                                        <option key={staff.staffId} value={staff.staffId}>
                                            {staff.name} ({staff.staffId})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="label">Billing Default Staff</label>
                                <select
                                    value={settings.billingDefaultStaffId || ""}
                                    onChange={(e) => setSettings({ ...settings, billingDefaultStaffId: e.target.value })}
                                    className="input"
                                >
                                    <option value="">-- No Default --</option>
                                    {getStaffForRole("billing").map((staff) => (
                                        <option key={staff.staffId} value={staff.staffId}>
                                            {staff.name} ({staff.staffId})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full btn btn-primary flex items-center justify-center space-x-2"
                            >
                                <Save className="w-5 h-5" />
                                <span>{saving ? "Saving..." : "Save Settings"}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
