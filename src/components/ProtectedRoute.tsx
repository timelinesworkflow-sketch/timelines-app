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
    const { user, userData, loading, effectiveRole, isImpersonating } = useAuth();
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

            // Admin with impersonation can access any page
            if (userData.role === "admin" && isImpersonating) {
                // Allow access - admin is impersonating
                return;
            }

            // Check if user's effective role is allowed
            const roleToCheck = effectiveRole || userData.role;
            if (!allowedRoles.includes(roleToCheck)) {
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
                    aari: "/aari",
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
    }, [user, userData, loading, allowedRoles, router, effectiveRole, isImpersonating]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
            </div>
        );
    }

    if (!user || !userData) {
        return null;
    }

    // Admin with impersonation can access any page
    if (userData.role === "admin" && isImpersonating) {
        return <>{children}</>;
    }

    // Check effective role for access
    const roleToCheck = effectiveRole || userData.role;
    if (!allowedRoles.includes(roleToCheck)) {
        return (
            <div className="min-h-screen flex items-center justify-center text-red-600">
                Access denied
            </div>
        );
    }

    return <>{children}</>;
}
