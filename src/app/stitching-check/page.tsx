"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import StagePageContent from "@/components/StagePageContent";

export default function StitchingCheckPage() {
    return (
        <ProtectedRoute allowedRoles={["stitching_checker", "supervisor", "admin"]}>
            <div className="page-container min-h-screen">
                <TopBar />

                <div className="page-content">
                    <div className="mb-6">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Stitching Check
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Review and approve stitching work
                        </p>
                    </div>

                    <StagePageContent
                        stageName="stitching_checker"
                        stageDisplayName="Stitching Check"
                        isChecker={true}
                        previousStage="stitching"
                    />
                </div>
            </div>
        </ProtectedRoute>
    );
}
