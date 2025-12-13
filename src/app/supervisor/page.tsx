"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { Eye, Users, Package } from "lucide-react";

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
                        <a href="/intake" className="card hover:shadow-lg transition-shadow cursor-pointer">
                            <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                    <Package className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white">Intake</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Manage orders</p>
                                </div>
                            </div>
                        </a>

                        <a href="/materials" className="card hover:shadow-lg transition-shadow cursor-pointer">
                            <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                    <Eye className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white">Materials</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">View materials</p>
                                </div>
                            </div>
                        </a>

                        <a href="/marking" className="card hover:shadow-lg transition-shadow cursor-pointer">
                            <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                    <Eye className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white">Marking</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">View marking</p>
                                </div>
                            </div>
                        </a>

                        <a href="/cutting" className="card hover:shadow-lg transition-shadow cursor-pointer">
                            <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                    <Eye className="w-6 h-6 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white">Cutting</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">View cutting</p>
                                </div>
                            </div>
                        </a>

                        <a href="/stitching" className="card hover:shadow-lg transition-shadow cursor-pointer">
                            <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                                    <Eye className="w-6 h-6 text-pink-600 dark:text-pink-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white">Stitching</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">View stitching</p>
                                </div>
                            </div>
                        </a>

                        <a href="/billing" className="card hover:shadow-lg transition-shadow cursor-pointer">
                            <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                                    <Eye className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white">Billing</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">View billing</p>
                                </div>
                            </div>
                        </a>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
