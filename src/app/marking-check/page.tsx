"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import StagePageContent from "@/components/StagePageContent";

export default function MarkingCheckPage() {
    return (
        <ProtectedRoute allowedRoles={["marking_checker", "supervisor", "admin"]}>
            <div className="page-container min-h-screen">
                <TopBar />

                <div className="page-content">
                    <div className="mb-6">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Marking Check
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Review and approve marking work
                        </p>
                    </div>

                    <StagePageContent
                        stageName="marking_checker"
                        stageDisplayName="Marking Check"
                        isChecker={true}
                        previousStage="marking"
                    />
                </div>
            </div>
        </ProtectedRoute>
    );
}
