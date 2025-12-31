"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { GarmentType, MarkingTemplate, MarkingTemplateTask } from "@/types";
import { getAllTemplates, saveTemplate } from "@/lib/markingTemplates";
import { Layers, Plus, Trash2, GripVertical, Save, Check } from "lucide-react";
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

export default function AdminMarkingTemplatesPage() {
    const [templates, setTemplates] = useState<MarkingTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [selectedGarment, setSelectedGarment] = useState<GarmentType>("blouse");
    const [editedTasks, setEditedTasks] = useState<MarkingTemplateTask[]>([]);
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
            const data = await getAllTemplates();
            setTemplates(data);
        } catch (error) {
            console.error("Failed to load templates:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddTask = () => {
        const newTask: MarkingTemplateTask = {
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

    const handleTaskChange = (index: number, field: keyof MarkingTemplateTask, value: string | number | boolean) => {
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
            await saveTemplate({
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
                <div className="page-container min-h-screen">
                    <TopBar />
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute allowedRoles={["admin", "supervisor"]}>
            <div className="page-container min-h-screen">
                <TopBar />

                <div className="page-content">
                    <div className="mb-6">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center space-x-2">
                            <Layers className="w-8 h-8 text-indigo-600" />
                            <span>Marking Templates</span>
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Define marking tasks for each garment type
                        </p>
                    </div>

                    {/* Garment Type Tabs */}
                    <div className="flex flex-wrap gap-2 mb-6">
                        {Object.entries(GARMENT_LABELS).map(([type, label]) => (
                            <button
                                key={type}
                                onClick={() => setSelectedGarment(type as GarmentType)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedGarment === type
                                    ? "bg-indigo-600 text-white"
                                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Template Editor */}
                    <div className="card">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {GARMENT_LABELS[selectedGarment]} Tasks
                            </h2>
                            <div className="flex space-x-2">
                                <button
                                    onClick={handleAddTask}
                                    className="btn btn-outline flex items-center space-x-1"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Add Task</span>
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!hasChanges || saving === selectedGarment}
                                    className="btn btn-primary flex items-center space-x-1 disabled:opacity-50"
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
                                <p className="text-gray-500 text-center py-8">No tasks defined. Add a task to get started.</p>
                            ) : (
                                editedTasks.map((task, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                                    >
                                        {/* Order Handle */}
                                        <div className="flex flex-col items-center">
                                            <button
                                                onClick={() => handleMoveTask(index, "up")}
                                                disabled={index === 0}
                                                className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                            >
                                                ▲
                                            </button>
                                            <span className="text-xs font-mono text-gray-500">{task.taskOrder}</span>
                                            <button
                                                onClick={() => handleMoveTask(index, "down")}
                                                disabled={index === editedTasks.length - 1}
                                                className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
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
                                            className="flex-1 input"
                                        />

                                        {/* Mandatory Toggle */}
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={task.isMandatory}
                                                onChange={(e) => handleTaskChange(index, "isMandatory", e.target.checked)}
                                                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Required</span>
                                        </label>

                                        {/* Delete */}
                                        <button
                                            onClick={() => handleRemoveTask(index)}
                                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {hasChanges && (
                            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                                    You have unsaved changes. Click Save to apply.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="mt-6 card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                        <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">About Templates</h3>
                        <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                            <li>• Templates define which tasks are created for each garment type</li>
                            <li>• Templates do NOT assign staff - assignments are done per order</li>
                            <li>• Changes apply to new orders only (existing orders keep their tasks)</li>
                            <li>• &quot;Required&quot; tasks must be completed for marking stage to finish</li>
                        </ul>
                    </div>
                </div>

                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </div>
        </ProtectedRoute>
    );
}
