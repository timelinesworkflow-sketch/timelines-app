# ✅ Testing Checklist - Measurement Fields Update

## Pre-Testing Setup

- [ ] Dependencies installed (`npm install`)
- [ ] Firebase configuration added to `.env.local`
- [ ] Development server running (`npm run dev`)
- [ ] Admin user created in Firebase
- [ ] At least one Intake role user created

---

## 🧪 Test Cases

### 1. Intake Form - Dynamic Field Rendering

#### Test 1.1: Blouse Measurements
- [ ] Navigate to Intake page
- [ ] Click "Create New Order"
- [ ] Select "Blouse" from Garment Type dropdown
- [ ] **Verify**: Exactly 10 measurement fields appear
- [ ] **Verify**: Fields show proper labels (e.g., "Blouse Length (BL)", not "blouseLength")
- [ ] **Verify**: All fields from Blouse list are present:
  - [ ] Blouse Length (BL)
  - [ ] Front Length (FL)
  - [ ] Back Neck (BN)
  - [ ] Front Neck (FN)
  - [ ] Chest
  - [ ] Hip
  - [ ] Sleeve Length (SL)
  - [ ] Sleeve Around (SA)
  - [ ] Arm Hole (ARM H)
  - [ ] PK

#### Test 1.2: Chudi Measurements
- [ ] Change Garment Type to "Chudi"
- [ ] **Verify**: Fields update smoothly (no page reload)
- [ ] **Verify**: Exactly 13 measurement fields appear
- [ ] **Verify**: All fields from Chudi list are present:
  - [ ] Top Length
  - [ ] Upper Chest
  - [ ] Chest
  - [ ] Hip
  - [ ] Seat
  - [ ] Back Neck
  - [ ] Front Neck
  - [ ] Sleeve Length
  - [ ] Sleeve Around
  - [ ] Arm
  - [ ] Pant Length
  - [ ] Leg Around
  - [ ] PK

#### Test 1.3: Frock Measurements
- [ ] Change Garment Type to "Frock"
- [ ] **Verify**: Exactly 10 measurement fields appear
- [ ] **Verify**: All fields from Frock list are present:
  - [ ] Frock Full Length
  - [ ] Front Height
  - [ ] Front Loose
  - [ ] Chest
  - [ ] Back Neck
  - [ ] Front Neck
  - [ ] Arm
  - [ ] Sleeve Length
  - [ ] Sleeve Loose
  - [ ] PK

#### Test 1.4: Pavadai/Sattai Measurements
- [ ] Change Garment Type to "Pavadai Sattai"
- [ ] **Verify**: Exactly 13 measurement fields appear
- [ ] **Verify**: All fields from Pavadai/Sattai list are present:
  - [ ] Pavadai Full Length
  - [ ] Hip Loose
  - [ ] Body Pavadai Length
  - [ ] Sattai Height
  - [ ] Sattai Loose
  - [ ] Hip
  - [ ] Chest
  - [ ] Back Neck
  - [ ] Front Neck
  - [ ] Arm
  - [ ] Sleeve Length
  - [ ] Sleeve Loose
  - [ ] PK

---

### 2. Data Entry & Validation

#### Test 2.1: Fill Measurements
- [ ] Select "Blouse" garment type
- [ ] Fill in sample measurements:
  ```
  Blouse Length: 38
  Front Length: 15
  Back Neck: 6
  Front Neck: 8
  Chest: 36
  Hip: 40
  Sleeve Length: 12
  Sleeve Around: 14
  Arm Hole: 18
  PK: 2
  ```
- [ ] **Verify**: All values are accepted
- [ ] **Verify**: No validation errors

#### Test 2.2: Switch Garment Type with Data
- [ ] Fill some measurements for Blouse
- [ ] Switch to Chudi
- [ ] **Verify**: Previous Blouse measurements are cleared
- [ ] **Verify**: New Chudi fields are empty
- [ ] Switch back to Blouse
- [ ] **Verify**: Fields are empty (not preserved from before)

---

### 3. Order Creation & Storage

#### Test 3.1: Create Complete Order
- [ ] Fill all required fields:
  - [ ] Customer Name
  - [ ] Phone Number
  - [ ] Address (optional)
  - [ ] Garment Type: Blouse
  - [ ] Due Date
  - [ ] All 10 Blouse measurements
- [ ] Upload sample image (optional)
- [ ] Select required stages
- [ ] Click "Send OTP & Review"
- [ ] **Verify**: OTP sent successfully
- [ ] **Verify**: Review screen shows correct measurements

#### Test 3.2: Verify OTP & Confirm
- [ ] Enter OTP (check console for mock OTP if using mock service)
- [ ] Click "Confirm Order"
- [ ] **Verify**: Order created successfully
- [ ] **Verify**: Redirected back to Intake page

#### Test 3.3: Check Firestore Data
- [ ] Open Firebase Console
- [ ] Navigate to Firestore Database
- [ ] Find the created order
- [ ] **Verify**: `garmentType` is "blouse"
- [ ] **Verify**: `measurements` object contains all 10 fields
- [ ] **Verify**: Field names are in camelCase (e.g., `blouseLength`, not "Blouse Length")
- [ ] **Verify**: Values are stored correctly

---

### 4. Workflow Stage Display

#### Test 4.1: Materials Stage
- [ ] Login as Materials role user
- [ ] Navigate to Materials page
- [ ] **Verify**: Order appears in queue
- [ ] **Verify**: Measurements section shows all fields
- [ ] **Verify**: Labels are human-readable (e.g., "Blouse Length (BL)")
- [ ] **Verify**: Measurements are read-only (no input fields)

#### Test 4.2: Marking Stage
- [ ] Complete Materials stage
- [ ] Login as Marking role user
- [ ] Navigate to Marking page
- [ ] **Verify**: Measurements display correctly
- [ ] **Verify**: Labels match Intake form labels

#### Test 4.3: Other Stages
- [ ] Test at least 2 more stages (Cutting, Stitching, etc.)
- [ ] **Verify**: Measurements display consistently across all stages
- [ ] **Verify**: No edit capability (read-only)

---

### 5. Mobile Responsiveness

#### Test 5.1: Mobile View (< 640px)
- [ ] Resize browser to mobile width or use device emulator
- [ ] Open Intake form
- [ ] **Verify**: Measurements display in 2 columns
- [ ] **Verify**: All fields are accessible
- [ ] **Verify**: Labels are not truncated
- [ ] **Verify**: Input fields are touch-friendly

#### Test 5.2: Tablet View (640px - 1024px)
- [ ] Resize to tablet width
- [ ] **Verify**: Measurements display in 3 columns
- [ ] **Verify**: Layout looks balanced

#### Test 5.3: Desktop View (> 1024px)
- [ ] Resize to desktop width
- [ ] **Verify**: Measurements display in 3 columns
- [ ] **Verify**: Form is centered and readable

---

### 6. Edge Cases

#### Test 6.1: Empty Measurements
- [ ] Create order without filling any measurements
- [ ] **Verify**: Order can be created (measurements are optional)
- [ ] **Verify**: Empty measurements object or empty strings stored

#### Test 6.2: Partial Measurements
- [ ] Fill only 5 out of 10 Blouse measurements
- [ ] Create order
- [ ] **Verify**: Only filled measurements are stored
- [ ] **Verify**: Empty fields are stored as empty strings or not included

#### Test 6.3: Special Characters
- [ ] Try entering special characters in measurement fields
- [ ] **Verify**: System handles gracefully (accepts or rejects appropriately)

#### Test 6.4: Very Long Values
- [ ] Try entering very long numbers (e.g., "123456789")
- [ ] **Verify**: System handles appropriately

---

### 7. Backwards Compatibility

#### Test 7.1: Old Orders (if any exist)
- [ ] Check if any orders exist from before the update
- [ ] View these orders in workflow stages
- [ ] **Verify**: Old measurements display correctly
- [ ] **Verify**: No errors or crashes

---

### 8. Admin Dashboard

#### Test 8.1: Orders Viewer
- [ ] Login as Admin
- [ ] Navigate to Admin > Orders
- [ ] Click on a Blouse order
- [ ] **Verify**: Measurements display with proper labels
- [ ] **Verify**: All measurement fields are visible

#### Test 8.2: Order Timeline
- [ ] View order timeline
- [ ] **Verify**: No errors related to measurements
- [ ] **Verify**: Timeline displays correctly

---

## 🐛 Bug Tracking

Use this section to note any issues found during testing:

| Test Case | Issue Description | Severity | Status |
|-----------|------------------|----------|--------|
| Example: 1.1 | Label not showing for PK field | Low | Fixed |
|           |                  |          |        |
|           |                  |          |        |

**Severity Levels:**
- **Critical**: App crashes or data loss
- **High**: Feature doesn't work as expected
- **Medium**: UI/UX issue but feature works
- **Low**: Minor cosmetic issue

---

## ✅ Sign-Off

Once all tests pass, complete this section:

- [ ] All test cases executed
- [ ] All critical/high severity bugs fixed
- [ ] Documentation reviewed and accurate
- [ ] Ready for production deployment

**Tested By**: ___________________  
**Date**: ___________________  
**Environment**: Development / Staging / Production  
**Browser(s) Tested**: ___________________  
**Device(s) Tested**: ___________________

---

## 📝 Notes

Add any additional observations or comments here:

```
[Your notes here]
```

---

**Testing Guide Version**: 1.0  
**Last Updated**: December 13, 2025
