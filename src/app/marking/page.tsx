"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import StagePageContent from "@/components/StagePageContent";

export default function MarkingPage() {
    return (
        <ProtectedRoute allowedRoles={["marking", "supervisor", "admin"]}>
            <div className="page-container min-h-screen">
                <TopBar />

                <div className="page-content">
                    <div className="mb-6">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Marking
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Complete marking tasks for orders
                        </p>
                    </div>

                    <StagePageContent
                        stageName="marking"
                        stageDisplayName="Marking"
                    />
                </div>
            </div>
        </ProtectedRoute>
    );
}
