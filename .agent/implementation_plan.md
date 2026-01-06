# Implementation Plan - Item Workflow Refactor

The goal of this refactor is to transition the production workflow from an Order-centric model to an Item-centric model, allowing independent tracking and progression of individual garments.

## User Review Required

> [!IMPORTANT]
> **Materials Stage & Inventory Logic**: The `MaterialsPage` currently operates on the `Order` level to handle aggregate material planning and inventory deductions. I have preserved this logic (`src/app/materials/page.tsx` was not modified) to ensure inventory calculations remain accurate ("Do NOT alter inventory logic"). However, this creates a momentary desync where the Materials stage tracks the *Order*, while subsequent stages (Marking, Cutting, etc.) track *Items*. 
>
> **Recommendation**: A dedicated follow-up task should refactor `MaterialsPage` to allow per-item material allocation without breaking bulk inventory tracking.

## Proposed Changes

### 1. Data Model Updates (`src/type/index.ts`)
- [x] Refactored `OrderItem` to be the primary workflow unit.
  - Added `status`, `currentStage`, `timeline`, `referenceImages`, `measurementType`.
  - Added links to parent `Order` (`orderId`) and `Customer` (`customerId`, `customerName`).
- [x] Updated `Order` interface to act as a container.
- [x] Defined `WorkflowStage` and `ItemStatus` types.

### 2. Logic & Library Updates (`src/lib/orderItems.ts`, `src/lib/orders.ts`)
- [x] Created `createOrderItems` to save independent item documents.
- [x] Created `getItemsForStage` to fetch items for dashboards.
- [x] Created `updateItemStage` to handle independent item progression.
- [x] Updated workflow rules in `WORKFLOW_STAGES` (Intake -> Materials -> ... -> Delivery).

### 3. Intake / Item Creation (`src/app/intake/CreateOrderForm.tsx`)
- [x] implemented **Per-Item Configuration**:
  - Independent `Measurement Mode` toggle (`Measurements` vs `Pattern Garment`).
  - Conditional rendering of measurement fields or image upload.
- [x] implemented **Item-Centric Image Upload**:
  - Images attached to specific items.
  - Metadata (Title, Description) per image.
- [x] Updated submission logic to:
  - Create parent `Order` (for grouping/billing).
  - Create independent `OrderItem` documents (for workflow).
  - Initialize items at `materials` stage (auto-completing `intake`).

### 4. Stage Dashboards (`src/components/StagePageContent.tsx`)
- [x] Refactored to fetch and display **Items** instead of Orders.
- [x] Updated UI to show item details (Garment Type, ID, Parent Customer).
- [x] Updated Actions (`Complete`, `Approve`, `Reject`) to operate on `OrderItem`s.
- [x] Preserved `logStaffWork` (mapped to parent `orderId`) to maintain salary logic compatibility.

## Verification Plan

### Automated Tests
- N/A (Manual validation required for UI interactions).

### Manual Verification Steps
1.  **Create Order**:
    - Go to Intake.
    - Add Item 1 (Blouse, Measurements).
    - Add Item 2 (Frock, Pattern Garment -> Upload Image).
    - Submit.
2.  **Verify Data**:
    - Check Firestore `orderItems` collection: Ensure 2 documents exist with correct `currentStage` ("materials").
3.  **Check Stages**:
    - Go to **Marking/Cutting/Stitching** (use a stage page that uses `StagePageContent`).
    - Verify Item 1 and Item 2 appear as **separate rows/cards**.
    - "Complete" Item 1. verify it moves to next stage, while Item 2 stays.
4.  **Salary Check**:
    - Verify `staffWorkLogs` collection contains entries for the item completion (linked to `orderId`).

## Rollback Plan
- Revert `src/app/intake/CreateOrderForm.tsx` to previous version (Order-level state).
- Revert `src/components/StagePageContent.tsx` to use `getOrdersForStage`.
- Revert `src/lib/orderItems.ts` logic.
