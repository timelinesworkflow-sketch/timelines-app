"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, X, Plus, Image as ImageIcon, Eye } from "lucide-react";
import { ItemReferenceImage } from "@/types";

interface ReferenceImageUploadProps {
    images: ItemReferenceImage[];
    onChange: (images: ItemReferenceImage[]) => void;
    onFileUpload?: (files: File[], index: number) => void;
    onFilesUpdate?: (files: { file: File | null; sketchFile: File | null }[]) => void;
    uploading?: boolean;
    allowSketch?: boolean;
    disabled?: boolean;
}

interface ImageUploadState {
    id: string;
    file: File | null;
    preview: string;
    title: string;
    description: string;
    sketchFile: File | null;
    sketchPreview: string;
}

export default function ReferenceImageUpload({
    images,
    onChange,
    onFileUpload,
    onFilesUpdate,
    uploading = false,
    allowSketch = true,
    disabled = false,
}: ReferenceImageUploadProps) {
    // We maintain purely local state for the files, but we sync metadata to parent
    const [imageStates, setImageStates] = useState<ImageUploadState[]>([
        createEmptyImageState(),
    ]);

    // Refs for file inputs
    const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const sketchInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Modal state
    const [previewModal, setPreviewModal] = useState<string | null>(null);

    function createEmptyImageState(): ImageUploadState {
        return {
            id: crypto.randomUUID(),
            file: null,
            preview: "",
            title: "",
            description: "",
            sketchFile: null,
            sketchPreview: "",
        };
    }

    // Initialize from props if we have existing images (edit mode)
    useEffect(() => {
        if (images.length > 0 && imageStates.length === 1 && !imageStates[0].file && !imageStates[0].title) {
            // Map existing stored images to state for editing
            // Note: We won't have File objects for existing images, just URLs
            const states = images.map(img => ({
                id: crypto.randomUUID(),
                file: null, // No file object for existing remote image
                preview: img.imageUrl,
                title: img.title,
                description: img.description || "",
                sketchFile: null,
                sketchPreview: img.sketchImageUrl || img.descriptionImageUrl || "",
            }));
            setImageStates(states);
        }
    }, [images]); // Added dependency

    const handleFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const newStates = [...imageStates];
            newStates[index] = {
                ...newStates[index],
                file,
                preview: reader.result as string,
            };
            setImageStates(newStates);
            emitChanges(newStates);
        };
        reader.readAsDataURL(file);
    };

    const handleSketchFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const newStates = [...imageStates];
            newStates[index] = {
                ...newStates[index],
                sketchFile: file,
                sketchPreview: reader.result as string,
            };
            setImageStates(newStates);
            emitChanges(newStates);
        };
        reader.readAsDataURL(file);
    };

    const updateField = (index: number, field: keyof ImageUploadState, value: string) => {
        const newStates = [...imageStates];
        // @ts-ignore
        newStates[index] = { ...newStates[index], [field]: value };
        setImageStates(newStates);
        emitChanges(newStates);
    };

    const emitChanges = (states: ImageUploadState[]) => {
        // We only emit the metadata structure back to parent
        const mappedImages: ItemReferenceImage[] = states.map(s => ({
            imageUrl: s.preview, // This is dataURL for new, http URL for existing
            title: s.title,
            description: s.description,
            sketchImageUrl: s.sketchPreview,
        }));

        onChange(mappedImages);

        // Also emit files if requested
        if (onFilesUpdate) {
            const filesList = states.map(s => ({
                file: s.file,
                sketchFile: s.sketchFile
            }));
            onFilesUpdate(filesList);
        }
    };

    const addNewImageSlot = () => {
        setImageStates([...imageStates, createEmptyImageState()]);
    };

    const removeImage = (index: number) => {
        if (imageStates.length <= 1) {
            const empty = createEmptyImageState();
            setImageStates([empty]);
            emitChanges([empty]);
            return;
        }
        const newStates = [...imageStates];
        newStates.splice(index, 1);
        setImageStates(newStates);
        emitChanges(newStates);
    };

    const triggerFileInput = (index: number) => {
        fileInputRefs.current[index]?.click();
    };

    const triggerSketchInput = (index: number) => {
        sketchInputRefs.current[index]?.click();
    };

    // Validation for "Add Next"
    const isCurrentSlotComplete = (state: ImageUploadState) => {
        return !!(state.preview && state.title.trim());
    };

    // Check if the last slot is complete
    const canAddMore = isCurrentSlotComplete(imageStates[imageStates.length - 1]);

    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-400">
                Upload reference images of measurement garment
            </p>

            {imageStates.map((state, index) => (
                <div
                    key={state.id}
                    className="bg-slate-700/50 rounded-lg p-4 space-y-3 border border-slate-600/50 relative group"
                >
                    <div className="flex items-start gap-4">

                        {/* 1. Main Image (Left) */}
                        <div className="flex-shrink-0">
                            <input
                                ref={(el) => { if (el) fileInputRefs.current[index] = el; }}
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFileChange(index, e)}
                                className="hidden"
                            />
                            {/* Number Badge */}
                            <div className="absolute -top-2 -left-2 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg z-10">
                                #{index + 1}
                            </div>

                            {state.preview ? (
                                <div className="group/img relative w-32 h-32 rounded-lg overflow-hidden border border-slate-500 bg-black/20">
                                    <img
                                        src={state.preview}
                                        alt="Preview"
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setPreviewModal(state.preview)}
                                            className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full text-white"
                                            title="View Fullscreen"
                                        >
                                            <Eye className="w-5 h-5" />
                                        </button>
                                        {!disabled && (
                                            <button
                                                type="button"
                                                onClick={() => triggerFileInput(index)}
                                                className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs text-white"
                                            >
                                                Change
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => !disabled && triggerFileInput(index)}
                                    disabled={disabled}
                                    className={`w-32 h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 transition-colors ${disabled ? 'border-slate-700 bg-slate-800/20 text-gray-600 cursor-not-allowed' : 'border-gray-500 text-gray-400 hover:border-cyan-500 hover:text-cyan-400 bg-slate-800/50'}`}
                                >
                                    <Camera className="w-8 h-8" />
                                    <span className="text-xs font-medium">Add Photo</span>
                                </button>
                            )}
                        </div>

                        {/* 2. Inputs (Middle) */}
                        <div className="flex-1 space-y-3 min-w-0">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">IMAGE TITLE *</label>
                                <input
                                    type="text"
                                    value={state.title}
                                    onChange={(e) => updateField(index, "title", e.target.value)}
                                    placeholder="e.g. Front View, Sleeve Detail"
                                    className="w-full px-3 py-2 bg-slate-600 text-white rounded-lg text-sm border border-slate-500 focus:border-cyan-500 focus:outline-none placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    required
                                    disabled={disabled}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">DESCRIPTION (OPTIONAL)</label>
                                <textarea
                                    value={state.description}
                                    onChange={(e) => updateField(index, "description", e.target.value)}
                                    placeholder="Any specific notes about this view..."
                                    rows={2}
                                    className="w-full px-3 py-2 bg-slate-600 text-white rounded-lg text-sm border border-slate-500 focus:border-cyan-500 focus:outline-none resize-none placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={disabled}
                                />
                            </div>
                        </div>

                        {/* 3. Sketch / Detail Image (Right) - Conditional */}
                        {allowSketch && (
                            <div className="flex-shrink-0 flex flex-col items-center">
                                <label className="text-[10px] font-medium text-gray-400 mb-2 tracking-wider">SKETCH / DETAIL</label>

                                <input
                                    ref={(el) => { if (el) sketchInputRefs.current[index] = el; }}
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleSketchFileChange(index, e)}
                                    className="hidden"
                                />

                                {state.sketchPreview ? (
                                    <div className="group/sketch relative w-24 h-24 rounded-lg overflow-hidden border border-slate-500 bg-black/20">
                                        <img
                                            src={state.sketchPreview}
                                            alt="Sketch"
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover/sketch:opacity-100 transition-opacity gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setPreviewModal(state.sketchPreview)}
                                                className="p-1 bg-white/20 hover:bg-white/30 rounded-full text-white"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            {!disabled && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => triggerSketchInput(index)}
                                                        className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-[10px] text-white"
                                                    >
                                                        Change
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newStates = [...imageStates];
                                                            newStates[index] = { ...newStates[index], sketchFile: null, sketchPreview: "" };
                                                            setImageStates(newStates);
                                                            emitChanges(newStates);
                                                        }}
                                                        className="px-2 py-0.5 bg-red-500/50 hover:bg-red-500/70 rounded text-[10px] text-white"
                                                    >
                                                        Remove
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => !disabled && triggerSketchInput(index)}
                                        disabled={disabled}
                                        className={`w-24 h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${disabled ? 'border-slate-800 bg-slate-900/20 text-gray-700 cursor-not-allowed' : 'border-slate-600 text-gray-500 hover:border-gray-400 hover:text-gray-300 bg-slate-800/30'}`}
                                    >
                                        <Plus className="w-5 h-5" />
                                        <span className="text-[10px]">Add Photo</span>
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Top Right Remove Button (for the whole row) */}
                        {!disabled && (
                            <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="absolute top-2 right-2 text-gray-500 hover:text-red-400 transition-colors"
                                title="Remove Image"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}

                    </div>

                    {/* Validation Hints */}
                    {(!state.file && index === imageStates.length - 1) && (
                        <div className="flex items-center gap-2 text-amber-500/80 text-xs px-1">
                            <span>* Main image required</span>
                        </div>
                    )}
                    {(state.file && !state.title.trim() && index === imageStates.length - 1) && (
                        <div className="flex items-center gap-2 text-amber-500/80 text-xs px-1">
                            <span>* Title required</span>
                        </div>
                    )}
                </div>
            ))}

            {/* Add More Button */}
            <div className="pt-2">
                <button
                    type="button"
                    onClick={addNewImageSlot}
                    disabled={!canAddMore || disabled}
                    className={`w-full py-4 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all group
                            ${(canAddMore && !disabled)
                            ? 'border-slate-600 hover:border-indigo-500 hover:bg-indigo-500/10 cursor-pointer text-gray-400 hover:text-indigo-400'
                            : 'border-slate-700 opacity-50 cursor-not-allowed text-gray-600'
                        }`}
                >
                    <Plus className={`w-6 h-6 ${canAddMore ? 'group-hover:scale-110 transition-transform' : ''}`} />
                    <span className="font-medium">Add Next Image</span>
                    {!canAddMore && (
                        <span className="text-xs font-normal">Complete the current image first</span>
                    )}
                </button>
            </div>

            {/* Fullscreen Preview Modal */}
            {previewModal && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setPreviewModal(null)}>
                    <button
                        className="absolute top-4 right-4 text-white/50 hover:text-white"
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

            {uploading && (
                <div className="flex items-center justify-center gap-2 text-cyan-400 text-sm py-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-cyan-400 border-t-transparent"></div>
                    Uploading images...
                </div>
            )}
        </div>
    );
}

// Export helper to get upload data
// This is used by the parent to get the actual File objects for upload
export function getImageUploadData(imageStates: ImageUploadState[]): {
    files: File[];
    metadata: Omit<ItemReferenceImage, "imageUrl" | "descriptionImageUrl" | "sketchImageUrl">[];
    sketchFiles: (File | null)[];
} {
    // We filter only "ready" items roughly, but usually the UI prevents "Add" if not ready.
    // However, the last one might be empty if user abandoned it.

    const validStates = imageStates.filter(s => s.file && s.title.trim());

    return {
        files: validStates.map(s => s.file!),
        metadata: validStates.map(s => ({
            title: s.title.trim(),
            description: s.description.trim() || undefined,
        })),
        sketchFiles: validStates.map(s => s.sketchFile),
    };
}
