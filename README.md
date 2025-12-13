# Timelines Workflow System

A comprehensive internal tailoring shop workflow management system built with Next.js, TypeScript, Tailwind CSS, and Firebase.

## Features

### 🔐 Authentication & Access Control
- Email/Password based authentication (no Google Sign-In)
- Role-based access control with 14 different roles
- Admin-controlled staff account creation
- Active/inactive user status management

### 👔 Staff Roles
- **Admin**: Full system access, staff management, reports
- **Supervisor**: Access to all workflow stages
- **Intake**: Order creation with OTP verification
- **Materials**: Materials preparation
- **Marking & Marking Checker**: Marking tasks and quality control
- **Cutting & Cutting Checker**: Cutting tasks and quality control
- **Stitching & Stitching Checker**: Stitching tasks and quality control
- **Hooks**: Hooks and finishing
- **Ironing**: Final ironing and QC
- **Billing**: Manual billing and payment processing
- **Delivery**: Delivery management (placeholder)

### 📋 Order Management
- Complete intake form with measurements based on garment type
- OTP verification for order confirmation and edits
- Sample image upload for customer reference
- Queue-based order assignment by due date
- Real-time workflow status tracking
- Complete order history and timeline

### 💰 Billing System
- Manual pricing entry for all services
- Automatic calculations (total, discount, balance)
- Payment tracking (cash, UPI, card, other)
- Payment status: paid, partially paid, not paid
- Delivery marking

### 📊 Admin Dashboard
- **Staff Management**: Create, edit, manage staff accounts and roles
- **Staff Work Logs**: View detailed work history by staff and date range
- **Orders Viewer**: Complete order history with full details
- **Reports**: Revenue, materials cost, and basic profit calculations
- **Settings**: Default stage staff assignments

### 📱 Mobile-First Design
- Responsive layouts for all screen sizes
- Touch-friendly interface
- Optimized for mobile workflow
- Modern, premium UI with animations

### 🔒 Privacy & Security
- Personal customer data visible only to Intake & Billing roles
- Other stages see only technical data (IDs, measurements, images)
- Protected routes with role-based middleware
- Secure Firebase Authentication

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Hosting**: Vercel-ready
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Firebase project created
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
cd timelines
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Firebase Setup

1. **Authentication**:
   - Enable Email/Password authentication in Firebase Console

2. **Firestore Collections**:
   - `users`: Staff user accounts
   - `orders`: Customer orders
   - `orders/{orderId}/timeline`: Order timeline entries
   - `staffWorkLogs`: Work logs for all staff
   - `staffPayments`: Payment records (future)
   - `settings`: System settings

3. **Storage**:
   - Set up Firebase Storage for image uploads
   - Configure security rules for authenticated access

4. **Initial Admin User**:
   - Manually create the first admin user in Firebase Console (Authentication + Firestore)

### Firestore Security Rules Example

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Orders collection
    match /orders/{orderId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
    }
    
    // Other collections...
  }
}
```

## Project Structure

```
timelines/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── admin/             # Admin dashboard pages
│   │   ├── intake/            # Intake page
│   │   ├── materials/         # Materials stage
│   │   ├── marking/           # Marking stage
│   │   ├── cutting/           # Cutting stage
│   │   ├── stitching/         # Stitching stage
│   │   ├── hooks/             # Hooks stage
│   │   ├── ironing/           # Ironing stage
│   │   ├── billing/           # Billing page
│   │   └── ...                # Other stages
│   ├── components/            # Reusable React components
│   ├── contexts/              # React contexts (Auth)
│   ├── lib/                   # Utility libraries
│   │   ├── firebase.ts        # Firebase configuration
│   │   ├── orders.ts          # Order management utilities
│   │   ├── otp.ts             # OTP utilities
│   │   └── storage.ts         # Firebase Storage utilities
│   └── types/                 # TypeScript type definitions
├── public/                    # Static assets
├── .env.example              # Environment variables template
├── next.config.ts            # Next.js configuration
├── tailwind.config.ts        # Tailwind CSS configuration
└── package.json              # Dependencies

```

## Key Features Explained

### Queue-Based Workflow
- Orders are automatically prioritized by due date and confirmation time
- Each stage worker sees only their assigned orders
- Navigation through Previous/Next buttons for efficiency

### OTP Verification System
- Mock OTP sending (ready for MSG91/Fast2SMS integration)
- Secure order confirmation before locking
- OTP-required edits for confirmed orders
- Temporary OTP storage with expiry

### Staff Work Logging
- Automatic logging of all actions (completed, approved, rejected)
- Timeline tracking for each order
- Admin visibility into staff productivity
- Foundation for future payment automation

### Flexible Billing
- All prices manually entered by billing staff
- Live calculation of totals and balance
- Optional discount feature
- Multiple payment modes supported
- Payment status tracking

## Deployment

### Vercel Deployment

1. Push your code to GitHub

2. Import project in Vercel dashboard

3. Add environment variables in Vercel:
   - All `NEXT_PUBLIC_FIREBASE_*` variables

4. Deploy!

## Future Enhancements

- SMS API integration (MSG91/Fast2SMS) for real OTP sending
- Staff payment automation based on work logs
- Advanced analytics and charts
- Bulk order import/export
- WhatsApp notifications
- Invoice PDF generation improvements
- Customer portal for order tracking

## Support

For issues or questions, please contact the development team.

## License

Proprietary - Internal use only for Timelines Costume Designers

---

Built with ❤️ for efficient tailoring shop management
