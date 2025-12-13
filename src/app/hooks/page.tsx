"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import StagePageContent from "@/components/StagePageContent";

export default function HooksPage() {
    return (
        <ProtectedRoute allowedRoles={["hooks", "supervisor", "admin"]}>
            <div className="page-container min-h-screen">
                <TopBar />

                <div className="page-content">
                    <div className="mb-6">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Hooks & Finishing
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Complete hooks and finishing touches
                        </p>
                    </div>

                    <StagePageContent
                        stageName="hooks"
                        stageDisplayName="Hooks"
                    />
                </div>
            </div>
        </ProtectedRoute>
    );
}
