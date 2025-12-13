"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { collection, getDocs, setDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signOut as firebaseSignOut } from "firebase/auth";
import { auth, db, secondaryAuth } from "@/lib/firebase";
import { User, UserRole } from "@/types";
import { Plus, Edit, Key, X, Trash2, Power } from "lucide-react";
import Toast from "@/components/Toast";

export default function AdminStaffPage() {
    const [users, setUsers] = useState<(User & { uid: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<(User & { uid: string }) | null>(null);
    const [deletingUser, setDeletingUser] = useState<(User & { uid: string }) | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        staffId: "",
        role: "marking" as UserRole,
        isActive: true,
    });

    useEffect(() => {
        loadUsers();
    }, []);

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
            // Create Firebase Auth user using SECONDARY auth instance
            // This prevents admin from being logged out
            const userCredential = await createUserWithEmailAndPassword(
                secondaryAuth,
                formData.email,
                formData.password
            );

            // Allow stages based on role
            const allowedStages =
                formData.role === "admin" || formData.role === "supervisor"
                    ? []
                    : [formData.role.replace(/_checker$/, "")];

            // Create Firestore user document with Auth UID as document ID
            await setDoc(doc(db, "users", userCredential.user.uid), {
                email: formData.email,
                staffId: formData.staffId,
                name: formData.name,
                role: formData.role,
                allowedStages,
                isActive: formData.isActive,
                createdAt: serverTimestamp(),
            });

            // Sign out from secondary auth to avoid any session conflicts
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

            await updateDoc(doc(db, "users", editingUser.uid), {
                name: formData.name,
                staffId: formData.staffId,
                role: formData.role,
                allowedStages,
                isActive: formData.isActive,
            });

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
            // Delete Firestore user document
            await deleteDoc(doc(db, "users", deletingUser.uid));

            // Note: Firebase Auth user deletion requires Admin SDK or Cloud Function
            // For now, just delete the Firestore doc. The Auth account will remain
            // but user won't be able to access the app without a Firestore profile

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
        });
        setShowModal(true);
    };

    const openCreateModal = () => {
        setEditingUser(null);
        resetForm();
        setShowModal(true);
    };

    if (loading && users.length === 0) {
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
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                                Staff Management
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400">
                                Create and manage staff accounts
                            </p>
                        </div>
                        <button onClick={openCreateModal} className="btn btn-primary flex items-center space-x-2">
                            <Plus className="w-5 h-5" />
                            <span>Add Staff</span>
                        </button>
                    </div>

                    {/* Users Table */}
                    <div className="card overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b border-gray-200 dark:border-gray-700">
                                <tr className="text-left">
                                    <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Name</th>
                                    <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Email</th>
                                    <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Staff ID</th>
                                    <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Role</th>
                                    <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                                    <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {users.map((user) => (
                                    <tr key={user.uid}>
                                        <td className="py-3 text-sm text-gray-900 dark:text-white">{user.name}</td>
                                        <td className="py-3 text-sm text-gray-600 dark:text-gray-400">{user.email}</td>
                                        <td className="py-3 text-sm text-gray-600 dark:text-gray-400">{user.staffId}</td>
                                        <td className="py-3">
                                            <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded text-xs font-medium capitalize">
                                                {user.role.replace(/_/g, " ")}
                                            </span>
                                        </td>
                                        <td className="py-3">
                                            <span
                                                className={`px-2 py-1 rounded text-xs font-medium ${user.isActive
                                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                    }`}
                                            >
                                                {user.isActive ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td className="py-3">
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={() => openEditModal(user)}
                                                    className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleToggleActive(user)}
                                                    className={`p-2 rounded ${user.isActive
                                                        ? "text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                                                        : "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                                                        }`}
                                                    title={user.isActive ? "Deactivate" : "Activate"}
                                                >
                                                    <Power className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleResetPassword(user.email)}
                                                    className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                                    title="Reset Password"
                                                >
                                                    <Key className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setDeletingUser(user)}
                                                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
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

                {/* Create/Edit Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="card max-w-md w-full">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                    {editingUser ? "Edit Staff" : "Create New Staff"}
                                </h2>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="label">Name *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="input"
                                        placeholder="Enter name"
                                    />
                                </div>

                                <div>
                                    <label className="label">Email *</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="input"
                                        placeholder="Enter email"
                                        disabled={!!editingUser}
                                    />
                                </div>

                                {!editingUser && (
                                    <div>
                                        <label className="label">Password *</label>
                                        <input
                                            type="password"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="input"
                                            placeholder="Enter password"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="label">Staff ID *</label>
                                    <input
                                        type="text"
                                        value={formData.staffId}
                                        onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                                        className="input"
                                        placeholder="E.g., STF101"
                                    />
                                </div>

                                <div>
                                    <label className="label">Role *</label>
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                                        className="input"
                                    >
                                        <option value="admin">Admin</option>
                                        <option value="supervisor">Supervisor</option>
                                        <option value="intake">Intake</option>
                                        <option value="materials">Materials</option>
                                        <option value="marking">Marking</option>
                                        <option value="marking_checker">Marking Checker</option>
                                        <option value="cutting">Cutting</option>
                                        <option value="cutting_checker">Cutting Checker</option>
                                        <option value="stitching">Stitching</option>
                                        <option value="stitching_checker">Stitching Checker</option>
                                        <option value="hooks">Hooks</option>
                                        <option value="ironing">Ironing</option>
                                        <option value="billing">Billing</option>
                                        <option value="delivery">Delivery</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.isActive}
                                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                            className="w-4 h-4 text-indigo-600 rounded"
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                                    </label>
                                </div>

                                <button
                                    onClick={editingUser ? handleUpdateUser : handleCreateUser}
                                    className="w-full btn btn-primary"
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
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="card max-w-md w-full">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                    Delete Staff Member
                                </h2>
                                <button
                                    onClick={() => setDeletingUser(null)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                    <p className="text-sm text-red-800 dark:text-red-200 mb-2">
                                        <strong>Are you sure you want to delete this staff member?</strong>
                                    </p>
                                    <p className="text-sm text-red-700 dark:text-red-300 mb-1">
                                        <strong>Staff:</strong> {deletingUser.name} ({deletingUser.email})
                                    </p>
                                    <p className="text-sm text-red-700 dark:text-red-300">
                                        This will remove their login access permanently.
                                    </p>
                                </div>

                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                    <p className="text-sm text-blue-800 dark:text-blue-200">
                                        <strong>Note:</strong> Past work logs and order history will NOT be deleted and will remain in the system for records.
                                    </p>
                                </div>

                                <div className="flex space-x-3">
                                    <button
                                        onClick={() => setDeletingUser(null)}
                                        className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleDeleteUser}
                                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center space-x-2"
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <span>Deleting...</span>
                                        ) : (
                                            <>
                                                <Trash2 className="w-4 h-4" />
                                                <span>Delete Staff</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
