"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { GarmentType, StitchingTemplate, StitchingTemplateTask } from "@/types";
import { getAllStitchingTemplates, saveStitchingTemplate } from "@/lib/stitchingTemplates";
import { Shirt, Plus, Trash2, Save } from "lucide-react";
import Toast from "@/components/Toast";

const GARMENT_LABELS: Record<GarmentType, string> = {
    blouse: "Blouse",
    chudi: "Chudi / Salwar Top",
    frock: "Frock",
    pavadai_sattai: "Pavadai Sattai",
    aari_blouse: "Aari Blouse",
    aari_pavada_sattai: "Aari Pavada Sattai",
    other: "Other",
};

export default function AdminStitchingTemplatesPage() {
    const [templates, setTemplates] = useState<StitchingTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [selectedGarment, setSelectedGarment] = useState<GarmentType>("blouse");
    const [editedTasks, setEditedTasks] = useState<StitchingTemplateTask[]>([]);
    const [hasChanges, setHasChanges] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

    useEffect(() => {
        loadTemplates();
    }, []);

    useEffect(() => {
        const template = templates.find(t => t.garmentType === selectedGarment);
        if (template) {
            setEditedTasks([...template.tasks]);
            setHasChanges(false);
        }
    }, [selectedGarment, templates]);

    const loadTemplates = async () => {
        try {
            const data = await getAllStitchingTemplates();
            setTemplates(data);
        } catch (error) {
            console.error("Failed to load templates:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddTask = () => {
        const newTask: StitchingTemplateTask = {
            taskName: "",
            taskOrder: editedTasks.length + 1,
            isMandatory: true,
        };
        setEditedTasks([...editedTasks, newTask]);
        setHasChanges(true);
    };

    const handleRemoveTask = (index: number) => {
        const updated = editedTasks.filter((_, i) => i !== index);
        // Reorder remaining tasks
        updated.forEach((task, i) => {
            task.taskOrder = i + 1;
        });
        setEditedTasks(updated);
        setHasChanges(true);
    };

    const handleTaskChange = (index: number, field: keyof StitchingTemplateTask, value: string | number | boolean) => {
        const updated = [...editedTasks];
        updated[index] = { ...updated[index], [field]: value };
        setEditedTasks(updated);
        setHasChanges(true);
    };

    const handleMoveTask = (index: number, direction: "up" | "down") => {
        if (
            (direction === "up" && index === 0) ||
            (direction === "down" && index === editedTasks.length - 1)
        ) return;

        const updated = [...editedTasks];
        const newIndex = direction === "up" ? index - 1 : index + 1;
        [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];

        // Update order numbers
        updated.forEach((task, i) => {
            task.taskOrder = i + 1;
        });

        setEditedTasks(updated);
        setHasChanges(true);
    };

    const handleSave = async () => {
        const template = templates.find(t => t.garmentType === selectedGarment);
        if (!template) return;

        // Validate tasks
        const invalidTasks = editedTasks.filter(t => !t.taskName.trim());
        if (invalidTasks.length > 0) {
            setToast({ message: "All tasks must have a name", type: "error" });
            return;
        }

        setSaving(selectedGarment);
        try {
            await saveStitchingTemplate({
                ...template,
                tasks: editedTasks,
            });
            setToast({ message: "Template saved successfully!", type: "success" });
            setHasChanges(false);
            loadTemplates();
        } catch (error) {
            console.error("Failed to save template:", error);
            setToast({ message: "Failed to save template", type: "error" });
        } finally {
            setSaving(null);
        }
    };

    if (loading) {
        return (
            <ProtectedRoute allowedRoles={["admin", "supervisor"]}>
                <div className="min-h-screen bg-slate-900">
                    <TopBar />
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute allowedRoles={["admin", "supervisor"]}>
            <div className="min-h-screen bg-slate-900">
                <TopBar />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="mb-6">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-200 mb-2 flex items-center gap-2">
                            <Shirt className="w-8 h-8 text-purple-400" />
                            <span>Stitching Templates</span>
                        </h1>
                        <p className="text-slate-400">
                            Define stitching tasks for each garment type
                        </p>
                    </div>

                    {/* Garment Type Tabs */}
                    <div className="flex flex-wrap gap-2 mb-6">
                        {Object.entries(GARMENT_LABELS).map(([type, label]) => (
                            <button
                                key={type}
                                onClick={() => setSelectedGarment(type as GarmentType)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedGarment === type
                                    ? "bg-purple-600 text-white"
                                    : "bg-slate-700 text-gray-300 hover:bg-slate-600"
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Template Editor */}
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-200">
                                {GARMENT_LABELS[selectedGarment]} Stitching Tasks
                            </h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleAddTask}
                                    className="inline-flex items-center gap-1 px-3 py-2 border border-slate-600 text-gray-200 rounded-lg hover:bg-slate-700"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Add Task</span>
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!hasChanges || saving === selectedGarment}
                                    className="inline-flex items-center gap-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                                >
                                    {saving === selectedGarment ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    <span>Save</span>
                                </button>
                            </div>
                        </div>

                        {/* Tasks List */}
                        <div className="space-y-3">
                            {editedTasks.length === 0 ? (
                                <p className="text-slate-400 text-center py-8">No tasks defined. Add a task to get started.</p>
                            ) : (
                                editedTasks.map((task, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center gap-3 p-3 bg-slate-750 rounded-lg border border-slate-600"
                                    >
                                        {/* Order Handle */}
                                        <div className="flex flex-col items-center">
                                            <button
                                                onClick={() => handleMoveTask(index, "up")}
                                                disabled={index === 0}
                                                className="text-slate-400 hover:text-gray-200 disabled:opacity-30"
                                            >
                                                ▲
                                            </button>
                                            <span className="text-xs font-mono text-slate-400">{task.taskOrder}</span>
                                            <button
                                                onClick={() => handleMoveTask(index, "down")}
                                                disabled={index === editedTasks.length - 1}
                                                className="text-slate-400 hover:text-gray-200 disabled:opacity-30"
                                            >
                                                ▼
                                            </button>
                                        </div>

                                        {/* Task Name */}
                                        <input
                                            type="text"
                                            value={task.taskName}
                                            onChange={(e) => handleTaskChange(index, "taskName", e.target.value)}
                                            placeholder="Task name"
                                            className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 text-gray-200 rounded-lg placeholder-slate-400"
                                        />

                                        {/* Mandatory Toggle */}
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={task.isMandatory}
                                                onChange={(e) => handleTaskChange(index, "isMandatory", e.target.checked)}
                                                className="w-4 h-4 rounded border-slate-600 text-purple-600 focus:ring-purple-500"
                                            />
                                            <span className="text-sm text-slate-400">Required</span>
                                        </label>

                                        {/* Delete */}
                                        <button
                                            onClick={() => handleRemoveTask(index)}
                                            className="p-2 text-red-400 hover:bg-red-900/20 rounded"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {hasChanges && (
                            <div className="mt-4 p-3 bg-orange-900/20 border border-orange-800 rounded-lg">
                                <p className="text-sm text-orange-200">
                                    You have unsaved changes. Click Save to apply.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="mt-6 bg-blue-900/20 border border-blue-800 rounded-xl p-4">
                        <h3 className="font-medium text-blue-300 mb-2">About Stitching Templates</h3>
                        <ul className="text-sm text-blue-400 space-y-1">
                            <li>• Templates define which stitching tasks are created for each garment type</li>
                            <li>• Templates do NOT assign staff - assignments are done per order</li>
                            <li>• Changes apply to new orders only (existing orders keep their tasks)</li>
                            <li>• &quot;Required&quot; tasks must be completed for the stitching stage to finish</li>
                        </ul>
                    </div>
                </div>

                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </div>
        </ProtectedRoute>
    );
}
