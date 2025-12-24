"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { Users, Briefcase, Package, TrendingUp, Settings, Ruler, BarChart3, Layers } from "lucide-react";
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

                        {/* Staff Performance Analytics */}
                        <Link href="/admin/staff-performance" className="card hover:shadow-xl transition-all cursor-pointer group">
                            <div className="flex items-start space-x-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                    <BarChart3 className="w-7 h-7 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                                        Staff Performance
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Analytics and workload metrics
                                    </p>
                                </div>
                            </div>
                        </Link>

                        {/* Marking Templates */}
                        <Link href="/admin/marking-templates" className="card hover:shadow-xl transition-all cursor-pointer group">
                            <div className="flex items-start space-x-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                    <Layers className="w-7 h-7 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                                        Marking Templates
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Define tasks for garment types
                                    </p>
                                </div>
                            </div>
                        </Link>

                        {/* Materials & Inventory */}
                        <Link href="/admin/materials" className="card hover:shadow-xl transition-all cursor-pointer group">
                            <div className="flex items-start space-x-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                    <Ruler className="w-7 h-7 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                                        Materials & Inventory
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Track materials, lengths, and costs
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

                        {/* Customer Management */}
                        <Link href="/admin/customers" className="card hover:shadow-xl transition-all cursor-pointer group">
                            <div className="flex items-start space-x-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                    <Users className="w-7 h-7 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                                        Customer Management
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        View customer orders & financials
                                    </p>
                                </div>
                            </div>
                        </Link>

                        {/* Purchases Management */}
                        <Link href="/admin/purchases" className="card hover:shadow-xl transition-all cursor-pointer group">
                            <div className="flex items-start space-x-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                    <Package className="w-7 h-7 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                                        Purchases
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        View material purchase requests
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
