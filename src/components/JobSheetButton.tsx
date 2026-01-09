"use client";

import { useState, useRef } from "react";
import { OrderItem, WorkflowStage } from "@/types";
import { FileText } from "lucide-react";
import JobSheetTemplate from "./billing/JobSheetTemplate";
import Toast from "./Toast";
import { useAuth } from "@/contexts/AuthContext";

interface JobSheetButtonProps {
    item: OrderItem;
    stageName: WorkflowStage;
    stageDisplayName: string;
    itemIndex: number;
    totalItems: number;
    className?: string;
}

export default function JobSheetButton({
    item,
    stageName,
    stageDisplayName,
    itemIndex,
    totalItems,
    className = ""
}: JobSheetButtonProps) {
    const { userData } = useAuth();
    const [generating, setGenerating] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const templateRef = useRef<HTMLDivElement>(null);

    // Permission Logic
    if (!userData) return null;

    const isAdmin = userData.role === "admin";
    const isSupervisor = userData.role === "supervisor";
    const isTargetStaff = userData.role === stageName;

    const canGenerate = isAdmin || isSupervisor || isTargetStaff;

    // Strict hidden roles
    const isDisallowedRole = userData.role === "intake" || userData.role === "accountant";

    if (!canGenerate || isDisallowedRole) return null;

    const handleDownload = async () => {
        setGenerating(true);

        // Wait for template to render in DOM
        setTimeout(async () => {
            if (!templateRef.current) {
                setToast({ message: "Template error. Please try again.", type: "error" });
                setGenerating(false);
                return;
            }

            try {
                const opt = {
                    margin: 0,
                    filename: `TIMELINES_JOB_SHEET_${stageName.toUpperCase()}_${item.itemId}.pdf`,
                    image: { type: 'jpeg' as const, quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
                };

                const html2pdfModule = await import("html2pdf.js");
                const html2pdf = html2pdfModule.default;

                await html2pdf().set(opt).from(templateRef.current).save();
                setToast({ message: "Job Sheet downloaded!", type: "success" });
            } catch (error) {
                console.error("PDF Error:", error);
                setToast({ message: "Failed to generate PDF.", type: "error" });
            } finally {
                setGenerating(false);
            }
        }, 150);
    };

    return (
        <>
            <button
                onClick={handleDownload}
                disabled={generating}
                className={`flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-gray-200 rounded-lg transition-colors text-xs font-bold border border-slate-600 disabled:opacity-50 ${className}`}
                title="Generate Job Sheet PDF"
            >
                {generating ? (
                    <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                ) : (
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                )}
                <span>Job Sheet</span>
            </button>

            {/* Hidden Template */}
            <div className="fixed -left-[5000px] top-0 opacity-0 pointer-events-none">
                {generating && (
                    <JobSheetTemplate
                        ref={templateRef}
                        item={item}
                        stageDisplayName={stageDisplayName}
                        itemIndex={itemIndex}
                        totalItems={totalItems}
                        generatedDate={new Date().toLocaleString("en-IN")}
                        generatedBy={`${userData.name} (${userData.role})`}
                    />
                )}
            </div>

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </>
    );
}
