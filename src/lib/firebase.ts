// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAjHW3jEC2gixEhlzpQQq_DU1TPNtTQqhY",
    authDomain: "studio-8475348312-9c32d.firebaseapp.com",
    projectId: "studio-8475348312-9c32d",
    storageBucket: "studio-8475348312-9c32d.appspot.com",
    messagingSenderId: "765518118750",
    appId: "1:765518118750:web:a6cba79c8eff5d964419cf"
};

// Initialize Firebase (prevent multiple initializations)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Secondary app instance for creating users without affecting current session
// This prevents admin from being logged out when creating new staff
import type { Auth } from "firebase/auth";

let secondaryAuth: Auth;

try {
    const existingSecondary = getApps().find(a => a.name === "Secondary");
    const secondaryApp = existingSecondary || initializeApp(firebaseConfig, "Secondary");
    secondaryAuth = getAuth(secondaryApp);
} catch (error) {
    console.warn("Secondary app initialization failed, using primary auth");
    secondaryAuth = auth;
}

// Export services for use in other parts of the app
export { app, auth, db, storage, secondaryAuth };