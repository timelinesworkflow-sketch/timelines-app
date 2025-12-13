"use client";

import { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import StagePageContent from "@/components/StagePageContent";
import { Order } from "@/types";

const markingChecklist = [
    "Front Neck Marking",
    "Back Neck Marking",
    "Sleeve Marking",
    "Putty Marking",
];

export default function MarkingPage() {
    const renderMarkingContent = (order: Order) => {
        const [checklist, setChecklist] = useState<Record<string, boolean>>({});

        return (
            <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Marking Checklist
                </p>
                <div className="space-y-2">
                    {markingChecklist.map((item) => (
                        <label
                            key={item}
                            className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <input
                                type="checkbox"
                                checked={checklist[item] || false}
                                onChange={(e) =>
                                    setChecklist({ ...checklist, [item]: e.target.checked })
                                }
                                className="w-5 h-5 text-indigo-600 rounded"
                            />
                            <span className="text-sm text-gray-900 dark:text-white">{item}</span>
                        </label>
                    ))}
                </div>
            </div>
        );
    };

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
                        renderStageContent={renderMarkingContent}
                    />
                </div>
            </div>
        </ProtectedRoute>
    );
}
