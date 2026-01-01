"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { LogIn } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { signIn, userData, loading: authLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // Redirect if already logged in
        if (!authLoading && userData) {
            redirectBasedOnRole(userData.role);
        }
    }, [authLoading, userData]);

    const redirectBasedOnRole = (role: string) => {
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

        router.replace(roleRoutes[role] || "/");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const result = await signIn(email, password);

        if (result.success) {
            // Redirect will happen via useEffect
        } else {
            setError(result.error || "Login failed");
            setLoading(false);
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 dark:from-slate-900 dark:to-slate-800">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 dark:from-slate-900 dark:to-slate-800">
            <div className="w-full max-w-md">
                {/* Logo/Header */}
                <div className="text-center mb-8 animate-fadeIn">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 mb-4 shadow-lg">
                        <LogIn className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        Timelines Workflow
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">Sign in to continue</p>
                </div>

                {/* Login Card */}
                <div className="card animate-fadeIn">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="label">
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input"
                                placeholder="staff@timelines.com"
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="label">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input"
                                placeholder="Enter your password"
                                required
                                autoComplete="current-password"
                            />
                        </div>

                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-red-700 dark:text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn btn-primary text-lg py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center">
                                    <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></span>
                                    Signing In...
                                </span>
                            ) : (
                                "Sign In"
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
                    Contact your administrator for account access
                </p>
            </div>
        </div>
    );
}
