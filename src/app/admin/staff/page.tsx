"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { collection, getDocs, setDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signOut as firebaseSignOut } from "firebase/auth";
import { auth, db, secondaryAuth } from "@/lib/firebase";
import { User, UserRole, SubStageParentRole } from "@/types";
import { getAllActiveSubStages } from "@/lib/markingTemplates";
import { Plus, Edit, Key, X, Trash2, Power, Settings } from "lucide-react";
import Toast from "@/components/Toast";

interface SubStageOption {
    subStageId: string;
    subStageName: string;
}

export default function AdminStaffPage() {
    const [users, setUsers] = useState<(User & { uid: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<(User & { uid: string }) | null>(null);
    const [deletingUser, setDeletingUser] = useState<(User & { uid: string }) | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

    // Dynamic sub-stages from templates
    const [availableSubStages, setAvailableSubStages] = useState<SubStageOption[]>([]);

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        staffId: "",
        role: "marking" as UserRole,
        isActive: true,
        subStageEligibility: {} as Record<string, boolean>,
        subStageDefaults: {} as Record<string, boolean>,
    });

    useEffect(() => {
        loadUsers();
    }, []);

    // Load sub-stages when role changes to marking/cutting/stitching
    useEffect(() => {
        const loadSubStages = async () => {
            if (formData.role === "marking" || formData.role === "cutting" || formData.role === "stitching") {
                const stages = await getAllActiveSubStages(formData.role as SubStageParentRole);
                setAvailableSubStages(stages);
            } else {
                setAvailableSubStages([]);
            }
        };
        loadSubStages();
    }, [formData.role]);

    const loadUsers = async () => {
        try {
            const usersSnapshot = await getDocs(collection(db, "users"));
            const usersData = usersSnapshot.docs.map((doc) => ({
                uid: doc.id,
                ...(doc.data() as User),
            }));
            setUsers(usersData);
        } catch (error) {
            console.error("Failed to load users:", error);
            setToast({ message: "Failed to load users", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async () => {
        if (!formData.name || !formData.email || !formData.password || !formData.staffId) {
            setToast({ message: "Please fill all fields", type: "error" });
            return;
        }

        setLoading(true);

        try {
            const userCredential = await createUserWithEmailAndPassword(
                secondaryAuth,
                formData.email,
                formData.password
            );

            const allowedStages =
                formData.role === "admin" || formData.role === "supervisor"
                    ? []
                    : [formData.role.replace(/_checker$/, "")];

            const userData: Record<string, unknown> = {
                email: formData.email,
                staffId: formData.staffId,
                name: formData.name,
                role: formData.role,
                allowedStages,
                isActive: formData.isActive,
                createdAt: serverTimestamp(),
            };

            // Add sub-stage eligibility and defaults for marking/cutting/stitching roles
            if (["marking", "cutting", "stitching"].includes(formData.role)) {
                userData.subStageEligibility = formData.subStageEligibility;
                userData.subStageDefaults = formData.subStageDefaults;
            }

            await setDoc(doc(db, "users", userCredential.user.uid), userData);
            await firebaseSignOut(secondaryAuth);

            setToast({ message: "User created successfully!", type: "success" });
            setShowModal(false);
            resetForm();
            loadUsers();
        } catch (error: any) {
            console.error(error);
            setToast({ message: error.message || "Failed to create user", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateUser = async () => {
        if (!editingUser) return;

        setLoading(true);

        try {
            const allowedStages =
                formData.role === "admin" || formData.role === "supervisor"
                    ? []
                    : [formData.role.replace(/_checker$/, "")];

            const updateData: Record<string, unknown> = {
                name: formData.name,
                staffId: formData.staffId,
                role: formData.role,
                allowedStages,
                isActive: formData.isActive,
            };

            // Add or clear sub-stage fields
            if (["marking", "cutting", "stitching"].includes(formData.role)) {
                updateData.subStageEligibility = formData.subStageEligibility;
                updateData.subStageDefaults = formData.subStageDefaults;
            } else {
                updateData.subStageEligibility = {};
                updateData.subStageDefaults = {};
            }

            await updateDoc(doc(db, "users", editingUser.uid), updateData);

            setToast({ message: "User updated successfully!", type: "success" });
            setShowModal(false);
            setEditingUser(null);
            resetForm();
            loadUsers();
        } catch (error: any) {
            console.error(error);
            setToast({ message: error.message || "Failed to update user", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (email: string) => {
        try {
            await sendPasswordResetEmail(auth, email);
            setToast({ message: `Password reset email sent to ${email}`, type: "success" });
        } catch (error: any) {
            console.error(error);
            setToast({ message: error.message || "Failed to send reset email", type: "error" });
        }
    };

    const handleToggleActive = async (user: User & { uid: string }) => {
        setLoading(true);
        try {
            await updateDoc(doc(db, "users", user.uid), {
                isActive: !user.isActive,
            });
            setToast({
                message: `Staff ${!user.isActive ? 'activated' : 'deactivated'} successfully!`,
                type: "success"
            });
            loadUsers();
        } catch (error: any) {
            console.error(error);
            setToast({ message: error.message || "Failed to toggle status", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!deletingUser) return;

        setLoading(true);

        try {
            await deleteDoc(doc(db, "users", deletingUser.uid));
            setToast({ message: "Staff deleted successfully!", type: "success" });
            setDeletingUser(null);
            loadUsers();
        } catch (error: any) {
            console.error(error);
            setToast({ message: error.message || "Failed to delete user", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: "",
            email: "",
            password: "",
            staffId: "",
            role: "marking",
            isActive: true,
            subStageEligibility: {},
            subStageDefaults: {},
        });
    };

    const openEditModal = (user: User & { uid: string }) => {
        setEditingUser(user);
        setFormData({
            name: user.name,
            email: user.email,
            password: "",
            staffId: user.staffId,
            role: user.role,
            isActive: user.isActive,
            subStageEligibility: user.subStageEligibility || {},
            subStageDefaults: user.subStageDefaults || {},
        });
        setShowModal(true);
    };

    const openCreateModal = () => {
        setEditingUser(null);
        resetForm();
        setShowModal(true);
    };

    const handleEligibilityChange = (subStageId: string, checked: boolean) => {
        setFormData(prev => ({
            ...prev,
            subStageEligibility: {
                ...prev.subStageEligibility,
                [subStageId]: checked,
            },
            subStageDefaults: checked ? prev.subStageDefaults : {
                ...prev.subStageDefaults,
                [subStageId]: false,
            },
        }));
    };

    const handleDefaultChange = (subStageId: string, checked: boolean) => {
        setFormData(prev => ({
            ...prev,
            subStageDefaults: {
                ...prev.subStageDefaults,
                [subStageId]: checked,
            },
        }));
    };

    const getRoleBadgeColor = (role: string) => {
        const colors: Record<string, string> = {
            admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
            supervisor: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
            marking: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
            cutting: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
            stitching: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
        };
        return colors[role.replace(/_checker$/, "")] || "bg-gray-100 text-gray-700";
    };

    const isSubStageRole = ["marking", "cutting", "stitching"].includes(formData.role);

    if (loading && users.length === 0) {
        return (
            <ProtectedRoute allowedRoles={["admin"]}>
                <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
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
            <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
                <TopBar />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    {/* Header */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                                    Staff Management
                                </h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    Manage staff members and their sub-stage assignments
                                </p>
                            </div>
                            <button
                                onClick={openCreateModal}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
                            >
                                <Plus className="w-4 h-4" />
                                Add Staff
                            </button>
                        </div>
                    </div>

                    {/* Staff List */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Staff ID</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {users.map((user) => (
                                        <tr key={user.uid} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                                            <td className="px-4 py-3">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</div>
                                                <div className="text-xs text-gray-500">{user.email}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-sm font-mono text-gray-600 dark:text-gray-400">{user.staffId}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(user.role)}`}>
                                                    {user.role.replace(/_/g, " ")}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                                    {user.isActive ? "Active" : "Inactive"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => openEditModal(user)}
                                                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                                        title="Edit"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleResetPassword(user.email)}
                                                        className="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded"
                                                        title="Reset Password"
                                                    >
                                                        <Key className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleActive(user)}
                                                        className={`p-1.5 rounded ${user.isActive ? "text-gray-500 hover:text-red-600 hover:bg-red-50" : "text-gray-500 hover:text-green-600 hover:bg-green-50"}`}
                                                        title={user.isActive ? "Deactivate" : "Activate"}
                                                    >
                                                        <Power className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeletingUser(user)}
                                                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Create/Edit Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 9998 }}>
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                    {editingUser ? "Edit Staff" : "Add New Staff"}
                                </h2>
                                <button
                                    onClick={() => { setShowModal(false); setEditingUser(null); }}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-4 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        disabled={!!editingUser}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                                    />
                                </div>

                                {!editingUser && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password *</label>
                                        <input
                                            type="password"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Staff ID *</label>
                                    <input
                                        type="text"
                                        value={formData.staffId}
                                        onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                                        placeholder="E.g., STF101"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role *</label>
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            role: e.target.value as UserRole,
                                            subStageEligibility: {},
                                            subStageDefaults: {},
                                        })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    >
                                        <option value="admin">Admin</option>
                                        <option value="supervisor">Supervisor</option>
                                        <option value="intake">Intake</option>
                                        <option value="materials">Materials</option>
                                        <option value="purchase">Purchase</option>
                                        <option value="marking">Marking</option>
                                        <option value="marking_checker">Marking Checker</option>
                                        <option value="cutting">Cutting</option>
                                        <option value="cutting_checker">Cutting Checker</option>
                                        <option value="aari">Aari Worker</option>
                                        <option value="stitching">Stitching</option>
                                        <option value="stitching_checker">Stitching Checker</option>
                                        <option value="hooks">Hooks</option>
                                        <option value="ironing">Ironing</option>
                                        <option value="billing">Billing</option>
                                        <option value="delivery">Delivery</option>
                                        <option value="accountant">Accountant</option>
                                    </select>
                                </div>

                                {/* Dynamic Sub-Stage Assignment */}
                                {isSubStageRole && availableSubStages.length > 0 && (
                                    <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Settings className="w-4 h-4 text-orange-600" />
                                            <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                                                Sub-Stage Assignments
                                            </h4>
                                        </div>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                                            Select which sub-stages this staff can work on. Only 1 default per sub-stage.
                                        </p>
                                        <div className="space-y-2">
                                            {availableSubStages.map((stage) => (
                                                <div key={stage.subStageId} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                                    <label className="flex items-center gap-2 cursor-pointer flex-1">
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.subStageEligibility[stage.subStageId] || false}
                                                            onChange={(e) => handleEligibilityChange(stage.subStageId, e.target.checked)}
                                                            className="w-4 h-4 text-orange-600 rounded"
                                                        />
                                                        <span className="text-sm text-gray-700 dark:text-gray-300">
                                                            {stage.subStageName}
                                                        </span>
                                                    </label>
                                                    {formData.subStageEligibility[stage.subStageId] && (
                                                        <label className="flex items-center gap-1 text-xs cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.subStageDefaults[stage.subStageId] || false}
                                                                onChange={(e) => handleDefaultChange(stage.subStageId, e.target.checked)}
                                                                className="w-3 h-3 text-green-600 rounded"
                                                            />
                                                            <span className="text-green-600">Default</span>
                                                        </label>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.isActive}
                                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                        className="w-4 h-4 text-indigo-600 rounded"
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                                </label>

                                <button
                                    onClick={editingUser ? handleUpdateUser : handleCreateUser}
                                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50"
                                    disabled={loading}
                                >
                                    {loading ? "Saving..." : editingUser ? "Update Staff" : "Create Staff"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {deletingUser && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 9998 }}>
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg max-w-md w-full p-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                                Delete Staff Member
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400 mb-6">
                                Are you sure you want to delete <strong>{deletingUser.name}</strong>? This action cannot be undone.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeletingUser(null)}
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteUser}
                                    disabled={loading}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
                                >
                                    {loading ? "Deleting..." : "Delete"}
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
