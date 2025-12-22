"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/types";

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles: UserRole[];
    redirectTo?: string;
}

export default function ProtectedRoute({
    children,
    allowedRoles,
    redirectTo = "/",
}: ProtectedRouteProps) {
    const { user, userData, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (!user || !userData) {
                router.replace("/");
                return;
            }

            if (!userData.isActive) {
                router.replace("/");
                return;
            }

            // Check if user's role is allowed
            if (!allowedRoles.includes(userData.role)) {
                // Redirect to their own main page
                const roleRoutes: Record<string, string> = {
                    admin: "/admin",
                    supervisor: "/supervisor",
                    intake: "/intake",
                    materials: "/materials",
                    purchase: "/purchase",
                    marking: "/marking",
                    marking_checker: "/marking-check",
                    cutting: "/cutting",
                    cutting_checker: "/cutting-check",
                    stitching: "/stitching",
                    stitching_checker: "/stitching-check",
                    hooks: "/hooks",
                    ironing: "/ironing",
                    billing: "/billing",
                    delivery: "/delivery",
                };

                router.replace(roleRoutes[userData.role] || "/");
            }
        }
    }, [user, userData, loading, allowedRoles, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
            </div>
        );
    }

    if (!user || !userData || !allowedRoles.includes(userData.role)) {
        return null;
    }

    return <>{children}</>;
}
