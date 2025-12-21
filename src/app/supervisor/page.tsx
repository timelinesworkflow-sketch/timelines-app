"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { Package, Eye, Scissors, Shirt, ShoppingCart, Ruler, Flame } from "lucide-react";

const SUPERVISOR_STAGES = [
    { href: "/intake", icon: Package, label: "Intake", desc: "Manage orders", color: "indigo" },
    { href: "/materials", icon: Eye, label: "Materials", desc: "View materials", color: "purple" },
    { href: "/purchase", icon: ShoppingCart, label: "Purchase", desc: "Manage purchases", color: "emerald" },
    { href: "/marking", icon: Ruler, label: "Marking", desc: "View marking", color: "blue" },
    { href: "/cutting", icon: Scissors, label: "Cutting", desc: "View cutting", color: "green" },
    { href: "/stitching", icon: Shirt, label: "Stitching", desc: "View stitching", color: "pink" },
    { href: "/ironing", icon: Flame, label: "Ironing", desc: "View ironing", color: "orange" },
];

export default function SupervisorPage() {
    return (
        <ProtectedRoute allowedRoles={["supervisor", "admin"]}>
            <div className="page-container min-h-screen">
                <TopBar />

                <div className="page-content">
                    <div className="mb-6">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Supervisor Dashboard
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Monitor and manage all workflow stages
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {SUPERVISOR_STAGES.map((stage) => {
                            const Icon = stage.icon;
                            return (
                                <a
                                    key={stage.href}
                                    href={stage.href}
                                    className="card hover:shadow-lg transition-shadow cursor-pointer"
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-12 h-12 rounded-full bg-${stage.color}-100 dark:bg-${stage.color}-900/30 flex items-center justify-center`}>
                                            <Icon className={`w-6 h-6 text-${stage.color}-600 dark:text-${stage.color}-400`} />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900 dark:text-white">{stage.label}</h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">{stage.desc}</p>
                                        </div>
                                    </div>
                                </a>
                            );
                        })}
                    </div>

                    {/* Note about restricted access */}
                    <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <p className="text-sm text-yellow-800 dark:text-yellow-300">
                            <strong>Note:</strong> Supervisors can view and manage workflow stages but cannot access Billing, Delivery, or Admin Dashboard.
                        </p>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}

