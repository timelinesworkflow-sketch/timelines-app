# 🔧 Fixing Firebase Storage

The error you are seeing confirms that the **CORS issue is fixed** (the request is reaching Google), but the **Storage Bucket does not exist**.

## 1. Create the Bucket
1. Go to the [Firebase Console Storage Tab](https://console.firebase.google.com/project/studio-8475348312-9c32d/storage).
2. Click **Get started**.
3. Accept the default security rules (Click Next).
4. Select your location (e.g., `nam5` or `us-east1`) and click **Done**.

## 2. Verify the Name
Once created, you will see a URL at the top of the files list, usually starting with `gs://`.

*   **Standard Name**: `gs://studio-8475348312-9c32d.firebasestorage.app`
*   **Legacy Name**: `gs://studio-8475348312-9c32d.appspot.com`

## 3. Update Configuration
If the name is different from what is in `src/lib/firebase.ts`, update it:

```typescript
// src/lib/firebase.ts
export const firebaseConfig = {
  // ...
  storageBucket: "your-new-bucket-name.firebasestorage.app", // Remove gs:// prefix
  // ...
};
```

**Note:** The Proxy I implemented (`src/app/api/proxy-upload/route.ts`) automatically attempts to upload to both `.appspot.com` and `.firebasestorage.app` domains, so it should work automatically once the bucket exists.
