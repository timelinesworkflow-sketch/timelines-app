"use client";

import { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { Plus } from "lucide-react";
import CreateOrderForm from "./CreateOrderForm";
import OrdersList from "./OrdersList";

export default function IntakePage() {
    const [showCreateForm, setShowCreateForm] = useState(false);

    return (
        <ProtectedRoute allowedRoles={["intake", "supervisor", "admin"]}>
            <div className="page-container min-h-screen">
                <TopBar />

                <div className="page-content">
                    <div className="mb-6">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Intake
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Create and manage customer orders
                        </p>
                    </div>

                    {!showCreateForm ? (
                        <>
                            <button
                                onClick={() => setShowCreateForm(true)}
                                className="w-full sm:w-auto btn btn-primary mb-6 flex items-center justify-center space-x-2"
                            >
                                <Plus className="w-5 h-5" />
                                <span>Create New Order</span>
                            </button>

                            <OrdersList />
                        </>
                    ) : (
                        <CreateOrderForm onClose={() => setShowCreateForm(false)} />
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
