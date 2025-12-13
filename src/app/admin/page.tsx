"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { Users, Briefcase, Package, TrendingUp, Settings } from "lucide-react";
import Link from "next/link";

export default function AdminPage() {
    return (
        <ProtectedRoute allowedRoles={["admin"]}>
            <div className="page-container min-h-screen">
                <TopBar />

                <div className="page-content">
                    <div className="mb-8">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Admin Dashboard
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Manage staff, orders, payments, and reports
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Staff Management */}
                        <Link href="/admin/staff" className="card hover:shadow-xl transition-all cursor-pointer group">
                            <div className="flex items-start space-x-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                    <Users className="w-7 h-7 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                                        Staff Management
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Manage users, roles, and assignments
                                    </p>
                                </div>
                            </div>
                        </Link>

                        {/* Staff Work & Payments */}
                        <Link href="/admin/staff-work" className="card hover:shadow-xl transition-all cursor-pointer group">
                            <div className="flex items-start space-x-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                    <Briefcase className="w-7 h-7 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                                        Staff Work & Payments
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        View work logs and manage payments
                                    </p>
                                </div>
                            </div>
                        </Link>

                        {/* Orders Management */}
                        <Link href="/admin/orders" className="card hover:shadow-xl transition-all cursor-pointer group">
                            <div className="flex items-start space-x-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                    <Package className="w-7 h-7 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                                        Orders & Workflow
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        View all orders and timeline
                                    </p>
                                </div>
                            </div>
                        </Link>

                        {/* Reports */}
                        <Link href="/admin/reports" className="card hover:shadow-xl transition-all cursor-pointer group">
                            <div className="flex items-start space-x-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                    <TrendingUp className="w-7 h-7 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                                        Reports & Analytics
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Revenue, costs, and profit analysis
                                    </p>
                                </div>
                            </div>
                        </Link>

                        {/* Settings */}
                        <Link href="/admin/settings" className="card hover:shadow-xl transition-all cursor-pointer group">
                            <div className="flex items-start space-x-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-gray-500 to-slate-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                    <Settings className="w-7 h-7 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                                        Settings
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Configure stage defaults
                                    </p>
                                </div>
                            </div>
                        </Link>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
