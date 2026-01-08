"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, X, Plus, Image as ImageIcon, Eye, Trash2 } from "lucide-react";
import { DesignSection, DEFAULT_DESIGN_SECTIONS } from "@/types";

interface DesignSectionUploadProps {
    sections: DesignSection[];
    onChange: (sections: DesignSection[]) => void;
    // We pass a ref or callback to extract file objects for upload
    onFilesUpdate?: (filesMap: Record<string, { main?: File; sketch?: File }>) => void;
}

interface SectionUploadState extends DesignSection {
    mainFile: File | null;
    mainPreview: string;
    sketchFile: File | null;
    sketchPreview: string;
}

export default function DesignSectionUpload({
    sections,
    onChange,
    onFilesUpdate
}: DesignSectionUploadProps) {
    const [sectionStates, setSectionStates] = useState<SectionUploadState[]>([]);
    const [previewModal, setPreviewModal] = useState<string | null>(null);

    // Refs for file inputs
    const mainInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
    const sketchInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

    // Initialize states from props
    useEffect(() => {
        // Merge props sections with existing states to preserve file objects if any
        // If it's a fresh load (e.g. edit mode), we won't have files, just URLs
        if (sections.length === 0 && sectionStates.length === 0) {
            return;
        }

        const newStates: SectionUploadState[] = sections.map(sec => {
            const existingState = sectionStates.find(s => s.sectionId === sec.sectionId);
            return {
                ...sec,
                mainFile: existingState?.mainFile || null,
                mainPreview: existingState?.mainPreview || sec.mainImageUrl,
                sketchFile: existingState?.sketchFile || null,
                sketchPreview: existingState?.sketchPreview || sec.sketchImageUrl || "",
            };
        });

        // Only update if length differs or IDs differ (to avoid infinite loop with object identity)
        const isDifferent = newStates.length !== sectionStates.length ||
            newStates.some((s, i) => s.sectionId !== sectionStates[i]?.sectionId);

        if (isDifferent) {
            setSectionStates(newStates);
        }
    }, [sections]);

    // Initial setup if empty (should be handled by parent default creation, but safety check)
    useEffect(() => {
        if (sections.length === 0) {
            // Parent should usually provide defaults. If not, we wait or do nothing.
        }
    }, []);

    const emitFiles = (states: SectionUploadState[]) => {
        if (onFilesUpdate) {
            const map: Record<string, { main?: File; sketch?: File }> = {};
            states.forEach(s => {
                if (s.mainFile || s.sketchFile) {
                    map[s.sectionId] = {
                        main: s.mainFile || undefined,
                        sketch: s.sketchFile || undefined
                    };
                }
            });
            onFilesUpdate(map);
        }
    };

    const updateParent = (states: SectionUploadState[]) => {
        const metadata: DesignSection[] = states.map(s => ({
            sectionId: s.sectionId,
            title: s.title,
            isDefault: s.isDefault,
            mainImageUrl: s.mainPreview, // Use preview as temp URL
            sketchImageUrl: s.sketchPreview,
        }));
        onChange(metadata);
        emitFiles(states);
    };

    const handleMainFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const newStates = [...sectionStates];
            newStates[index] = {
                ...newStates[index],
                mainFile: file,
                mainPreview: reader.result as string,
            };
            setSectionStates(newStates);
            updateParent(newStates);
        };
        reader.readAsDataURL(file);
    };

    const handleSketchFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const newStates = [...sectionStates];
            newStates[index] = {
                ...newStates[index],
                sketchFile: file,
                sketchPreview: reader.result as string,
            };
            setSectionStates(newStates);
            updateParent(newStates);
        };
        reader.readAsDataURL(file);
    };

    const handleAddCustomSection = () => {
        const customTitle = prompt("Enter title for new design section:");
        if (!customTitle) return;

        const newSection: SectionUploadState = {
            sectionId: `custom_${Date.now()}`,
            title: customTitle,
            isDefault: false,
            mainImageUrl: "",
            mainFile: null,
            mainPreview: "",
            sketchImageUrl: "",
            sketchFile: null,
            sketchPreview: ""
        };

        const newStates = [...sectionStates, newSection];
        setSectionStates(newStates);
        updateParent(newStates);
    };

    const handleRemoveSection = (index: number) => {
        const newStates = [...sectionStates];
        newStates.splice(index, 1);
        setSectionStates(newStates);
        updateParent(newStates);
    };

    const removeSketch = (index: number) => {
        const newStates = [...sectionStates];
        newStates[index].sketchFile = null;
        newStates[index].sketchPreview = "";
        newStates[index].sketchImageUrl = "";
        setSectionStates(newStates);
        updateParent(newStates);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400">Design Sections & Sketches</p>
                <button
                    type="button"
                    onClick={handleAddCustomSection}
                    className="text-xs bg-slate-700 hover:bg-slate-600 text-cyan-400 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                >
                    <Plus className="w-3 h-3" />
                    Add Section
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {sectionStates.map((state, index) => (
                    <div
                        key={state.sectionId}
                        className={`bg-slate-700/30 rounded-lg p-3 border ${state.isDefault ? 'border-slate-600/50' : 'border-indigo-500/30'} relative group`}
                    >
                        <div className="flex items-start gap-4">
                            {/* Main Image Upload */}
                            <div className="flex-shrink-0">
                                <label className="block text-[10px] uppercase text-gray-500 mb-1 font-bold tracking-wider">
                                    {state.title} {state.isDefault && <span className="text-red-400">*</span>}
                                </label>

                                <input
                                    ref={el => { mainInputRefs.current[state.sectionId] = el; }}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleMainFileChange(index, e)}
                                />

                                {state.mainPreview ? (
                                    <div className="relative w-28 h-28 rounded-lg overflow-hidden border border-slate-500 bg-black/40 group/img">
                                        <img src={state.mainPreview} alt={state.title} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setPreviewModal(state.mainPreview)}
                                                className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full text-white"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => mainInputRefs.current[state.sectionId]?.click()}
                                                className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-[10px] text-white"
                                            >
                                                Change
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => mainInputRefs.current[state.sectionId]?.click()}
                                        className="w-28 h-28 border-2 border-dashed border-slate-600 hover:border-cyan-500 rounded-lg flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-cyan-400 transition-all bg-slate-800/50"
                                    >
                                        <Camera className="w-6 h-6" />
                                        <span className="text-[10px]">Add Photo</span>
                                    </button>
                                )}
                            </div>

                            {/* Sketch Upload (Right Side) */}
                            <div className="flex-1 border-l border-slate-700/50 pl-4 border-dashed">
                                <label className="block text-[10px] uppercase text-gray-500 mb-1 tracking-wider">
                                    Sketch / Detail (Optional)
                                </label>

                                <input
                                    ref={el => { sketchInputRefs.current[state.sectionId] = el; }}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleSketchFileChange(index, e)}
                                />

                                <div className="flex items-center gap-4">
                                    {state.sketchPreview ? (
                                        <div className="relative w-28 h-28 rounded-lg overflow-hidden border border-slate-500 bg-black/40 group/sketch">
                                            <img src={state.sketchPreview} alt="Sketch" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover/sketch:opacity-100 transition-opacity gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewModal(state.sketchPreview)}
                                                    className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full text-white"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => sketchInputRefs.current[state.sectionId]?.click()}
                                                    className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-[10px] text-white"
                                                >
                                                    Change
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => removeSketch(index)}
                                                    className="px-2 py-1 bg-red-500/50 hover:bg-red-500/70 rounded text-[10px] text-white"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => sketchInputRefs.current[state.sectionId]?.click()}
                                            className="w-28 h-28 border-2 border-dashed border-slate-600 hover:border-indigo-400 rounded-lg flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-indigo-300 transition-all bg-slate-800/30"
                                        >
                                            <Plus className="w-6 h-6" />
                                            <span className="text-[10px]">Add Sketch</span>
                                        </button>
                                    )}

                                    <div className="text-xs text-gray-500 max-w-[150px]">
                                        Upload a hand drawing or close-up detail for {state.title}.
                                    </div>
                                </div>
                            </div>

                            {/* Remove Custom Section Button */}
                            {!state.isDefault && (
                                <button
                                    onClick={() => handleRemoveSection(index)}
                                    className="text-gray-600 hover:text-red-400 p-1"
                                    title="Remove Section"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Fullscreen Preview */}
            {previewModal && (
                <div
                    className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setPreviewModal(null)}
                >
                    <button
                        className="absolute top-4 right-4 text-white/50 hover:text-white p-2"
                        onClick={() => setPreviewModal(null)}
                    >
                        <X className="w-8 h-8" />
                    </button>
                    <img
                        src={previewModal}
                        alt="Preview"
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}

// Helper to extract file objects for final upload
export function getDesignSectionUploadData(sectionStates: SectionUploadState[]): {
    sectionId: string;
    mainFile?: File;
    sketchFile?: File;
}[] {
    return sectionStates.map(s => ({
        sectionId: s.sectionId,
        mainFile: s.mainFile || undefined,
        sketchFile: s.sketchFile || undefined
    }));
}
