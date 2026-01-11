# Firebase Setup Guide - URGENT FIX FOR PERMISSIONS ERROR

## 🚨 PROBLEM: "Missing or insufficient permissions" Error

The error you're seeing happens because **Firebase Firestore Security Rules are not configured**.

## ✅ SOLUTION: Configure Firestore Security Rules

### Step 1: Go to Firebase Console
1. Open [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **studio-8475348312-9c32d**
3. Click **"Firestore Database"** in the left sidebar
4. Click the **"Rules"** tab at the top

### Step 2: Replace the Rules
Copy the rules from `firestore.rules` file and paste them into the Firebase Console.

**Current Rules (WRONG - BLOCKING EVERYTHING):**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;  // ❌ BLOCKS EVERYTHING
    }
  }
}
```

**New Rules (CORRECT - ROLE-BASED ACCESS):**
See the `firestore.rules` file in the project root.

### Step 3: Publish the Rules
1. Click **"Publish"** button in Firebase Console
2. Wait for confirmation message
3. **Refresh your app** - the error should be gone!

## 🔒 What These Rules Do

- **Users Collection**: Users can read their own data, admins can read/write all users
- **Orders Collection**: All authenticated staff can read, specific roles can create/update
- **Customers, Inventory, Materials**: Role-based read/write access
- **Salary/Wages**: Staff can read their own, accountants can manage all
- **Templates**: All staff can read, only admins can modify

## 🎯 Quick Test After Setup

1. Try logging in again
2. The error should disappear
3. You should be redirected to your role's dashboard

## 📝 Alternative: Use Test Mode (NOT RECOMMENDED FOR PRODUCTION)

If you just want to test quickly (NOT SECURE):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;  // ⚠️ Anyone logged in can do anything
    }
  }
}
```

## ⚠️ IMPORTANT
- The `firestore.rules` file provides **proper security** with role-based access
- **DO NOT use test mode** for production
- After publishing rules, it may take 1-2 minutes to propagate
