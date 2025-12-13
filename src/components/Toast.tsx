"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

interface ToastProps {
    message: string;
    type?: "success" | "error" | "info" | "warning";
    onClose: () => void;
    duration?: number;
}

export default function Toast({ message, type = "info", onClose, duration = 3000 }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(onClose, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const bgColors = {
        success: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
        error: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
        info: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
        warning: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800",
    };

    const textColors = {
        success: "text-green-800 dark:text-green-400",
        error: "text-red-800 dark:text-red-400",
        info: "text-blue-800 dark:text-blue-400",
        warning: "text-yellow-800 dark:text-yellow-400",
    };

    return (
        <div
            className={`fixed top-4 right-4 left-4 sm:left-auto sm:min-w-96 z-50 flex items-center justify-between p-4 rounded-lg border ${bgColors[type]} ${textColors[type]} shadow-lg animate-fadeIn`}
        >
            <p className="text-sm font-medium">{message}</p>
            <button
                onClick={onClose}
                className="ml-4 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}
