"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { auth, db } from "@/lib/firebase";
import {
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { User, UserRole } from "@/types";

interface AuthContextType {
    user: FirebaseUser | null;
    userData: User | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signOut: () => Promise<void>;
    // Admin impersonation feature
    impersonatedRole: UserRole | null;
    setImpersonatedRole: (role: UserRole | null) => void;
    effectiveRole: UserRole | null;
    isImpersonating: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    userData: null,
    loading: true,
    signIn: async () => ({ success: false }),
    signOut: async () => { },
    impersonatedRole: null,
    setImpersonatedRole: () => { },
    effectiveRole: null,
    isImpersonating: false,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [userData, setUserData] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [impersonatedRole, setImpersonatedRole] = useState<UserRole | null>(null);

    // Compute effective role: impersonated role if set, otherwise actual user role
    const effectiveRole = useMemo(() => {
        if (impersonatedRole) return impersonatedRole;
        return userData?.role || null;
    }, [impersonatedRole, userData?.role]);

    // Check if currently impersonating
    const isImpersonating = useMemo(() => {
        return impersonatedRole !== null && userData?.role === "admin";
    }, [impersonatedRole, userData?.role]);

    useEffect(() => {
        // Fallback: If Firebase takes too long to respond, force loading to false
        // so the user can at least see the login UI.
        const timeoutId = setTimeout(() => {
            if (loading) {
                console.warn("[AuthContext] Auth state check timed out. Forcing loading false.");
                setLoading(false);
            }
        }, 10000); // 10 seconds

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            console.log(`[AuthContext] State changed: ${firebaseUser ? 'Logged In (' + firebaseUser.email + ')' : 'Logged Out'}`);

            try {
                setUser(firebaseUser);

                if (firebaseUser) {
                    // Fetch user data from Firestore
                    const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
                    if (userDoc.exists()) {
                        const data = userDoc.data() as User;
                        setUserData(data);
                    } else {
                        console.warn(`[AuthContext] No user document found for UID: ${firebaseUser.uid}`);
                        setUserData(null);
                    }
                } else {
                    setUserData(null);
                    setImpersonatedRole(null); // Clear impersonation on logout
                }
            } catch (error) {
                console.error("[AuthContext] Error in onAuthStateChanged:", error);
            } finally {
                setLoading(false);
                clearTimeout(timeoutId);
            }
        });

        return () => {
            unsubscribe();
            clearTimeout(timeoutId);
        };
    }, []);

    const signIn = async (email: string, password: string) => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);

            // Check if user exists in Firestore
            const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));

            if (!userDoc.exists()) {
                await firebaseSignOut(auth);
                return { success: false, error: "Account not configured. Contact admin." };
            }

            const userData = userDoc.data() as User;

            if (!userData.isActive) {
                await firebaseSignOut(auth);
                return { success: false, error: "Your access has been disabled by admin." };
            }

            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || "Login failed" };
        }
    };

    const signOut = async () => {
        setImpersonatedRole(null); // Clear impersonation first
        await firebaseSignOut(auth);
        setUser(null);
        setUserData(null);
    };

    return (
        <AuthContext.Provider value={{
            user,      // Contains firebase uid
            userData,  // Contains custom staffId
            loading,
            signIn,
            signOut,
            impersonatedRole,
            setImpersonatedRole,
            effectiveRole,
            isImpersonating,
        }}>
            {children}
        </AuthContext.Provider>
    );
}
