"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, User, Menu, X, ArrowLeft, UserCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { UserRole } from "@/types";

// Role routes mapping
const ROLE_ROUTES: Record<string, string> = {
    admin: "/admin",
    supervisor: "/supervisor",
    intake: "/intake",
    materials: "/materials",
    purchase: "/purchase",
    marking: "/marking",
    marking_checker: "/marking-check",
    cutting: "/cutting",
    cutting_checker: "/cutting-check",
    aari: "/aari",
    stitching: "/stitching",
    stitching_checker: "/stitching-check",
    hooks: "/hooks",
    ironing: "/ironing",
    billing: "/billing",
    delivery: "/delivery",
};

// Role display names
const ROLE_LABELS: Record<string, string> = {
    intake: "Intake",
    materials: "Materials",
    purchase: "Purchase",
    marking: "Marking",
    marking_checker: "Marking Checker",
    cutting: "Cutting",
    cutting_checker: "Cutting Checker",
    aari: "Aari Work",
    stitching: "Stitching",
    stitching_checker: "Stitching Checker",
    hooks: "Hooks",
    ironing: "Ironing",
    billing: "Billing",
    delivery: "Delivery",
};

export default function TopBar() {
    const { userData, signOut, impersonatedRole, setImpersonatedRole, isImpersonating } = useAuth();
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);

    const handleSignOut = async () => {
        setMenuOpen(false);
        await signOut();
        router.push("/");
    };

    const handleLoginAs = (role: UserRole) => {
        setImpersonatedRole(role);
        setMenuOpen(false);
        router.push(ROLE_ROUTES[role] || "/");
    };

    const handleExitImpersonation = () => {
        setImpersonatedRole(null);
        setMenuOpen(false);
        router.push("/admin");
    };

    if (!userData) return null;

    const isAdmin = userData.role === "admin";
    const displayRole = isImpersonating && impersonatedRole
        ? `${ROLE_LABELS[impersonatedRole] || impersonatedRole} (as Admin)`
        : userData.role.replace(/_/g, " ").toUpperCase();

    return (
        <div className="bg-slate-800 border-b border-slate-700 relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Left: Hamburger Menu (Admin Only) */}
                    <div className="flex items-center space-x-3">
                        {isAdmin && (
                            <button
                                onClick={() => setMenuOpen(!menuOpen)}
                                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-slate-700 transition-colors"
                                title="Login As Menu"
                            >
                                {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        )}

                        {/* User Info */}
                        <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isImpersonating
                                    ? "bg-gradient-to-r from-amber-500 to-orange-500"
                                    : "bg-gradient-to-r from-indigo-600 to-purple-600"
                                }`}>
                                {isImpersonating ? <UserCog className="w-5 h-5 text-white" /> : <User className="w-5 h-5 text-white" />}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-200">
                                    {userData.name}
                                </p>
                                <p className="text-xs text-slate-400">
                                    {userData.staffId} • {displayRole}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right: Exit Impersonation / Logout */}
                    <div className="flex items-center space-x-2">
                        {isImpersonating && (
                            <button
                                onClick={handleExitImpersonation}
                                className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-amber-400 hover:bg-amber-900/30 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span className="hidden sm:inline">Exit Login As</span>
                            </button>
                        )}
                        <button
                            onClick={handleSignOut}
                            className="flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-900/30 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Dropdown Menu (Admin Only) */}
            {isAdmin && menuOpen && (
                <div className="absolute top-16 left-0 right-0 bg-slate-900 border-b border-slate-700 shadow-xl z-50">
                    <div className="max-w-7xl mx-auto px-4 py-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                                Login As Stage
                            </h3>
                            {isImpersonating && (
                                <button
                                    onClick={handleExitImpersonation}
                                    className="text-xs text-amber-400 hover:text-amber-300"
                                >
                                    ← Back to Admin
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                            {Object.entries(ROLE_LABELS).map(([role, label]) => (
                                <button
                                    key={role}
                                    onClick={() => handleLoginAs(role as UserRole)}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${impersonatedRole === role
                                            ? "bg-amber-600 text-white"
                                            : "bg-slate-800 text-gray-300 hover:bg-slate-700 hover:text-white"
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
