"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { Truck } from "lucide-react";

export default function DeliveryPage() {
    return (
        <ProtectedRoute allowedRoles={["delivery", "supervisor", "admin"]}>
            <div className="page-container min-h-screen">
                <TopBar />

                <div className="page-content">
                    <div className="mb-6">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Delivery
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Manage order deliveries
                        </p>
                    </div>

                    <div className="card text-center py-12">
                        <Truck className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900dark:text-white mb-2">
                            Delivery Management
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            Delivery tracking features coming soon
                        </p>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
