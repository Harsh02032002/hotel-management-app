# The Grand Palace Hotel — Single-Hotel Booking & Administration Suite

A dedicated single-hotel property management and guest booking ecosystem consisting of two native Android applications connected to a shared cloud backend on Vercel and MongoDB Atlas.

## Architecture

```text
Customer Booking App (com.grandpalace.hotel.customer)
         │
         ▼
https://hotel-management-backend-beta.vercel.app (FastAPI + Motor)
         │
         ▼
MongoDB Atlas (hotel_management database)
         ▲
         │
Hotel Admin App (com.grandpalace.hotel.admin)
```

## Applications

1. **`customer-app/` — Grand Palace Customer Booking App (`com.grandpalace.hotel.customer`)**
   - Branded Splash Screen & Heritage Luxury UI
   - Customer Registration, Password Login & OTP Authentication
   - Live Room Categories, High-Resolution Gallery & Room Amenities
   - Real-Time Date-Range Availability & Guest Capacity Validation
   - Instant Room Reservation with Double-Booking Prevention
   - Online Payment Gateway (Razorpay + Hosted Checkout WebView)
   - Booking History, Policy-Based Cancellation & Printable GST Tax Invoice Download
   - Customer Profile & KYC Preferences + Real-Time Notifications

2. **`admin-app/` — Grand Palace Hotel Admin PMS (`com.grandpalace.hotel.admin`)**
   - Role-Based Staff Login (`admin`, `frontdesk`, `housekeeping`, `finance`)
   - Executive KPI Dashboard (Occupancy Rate, Today Arrivals/Departures, Revenue, Net Profit)
   - Room Inventory Management (Add/Remove/Block Rooms, Category Tariff Updates, 7-Day Availability Calendar)
   - Booking Management (Confirm/Reject Incoming Customer Bookings, Walk-In & Advance Reservations)
   - Guest Check-In with KYC Verification, In-House Guest Directory, Room Move & Stay Extension
   - Guest Checkout (Automatically transitions vacated room to `DIRTY`)
   - Housekeeping Board (`DIRTY` → `CLEANING` → `CLEAN & AVAILABLE` workflow)
   - Finance & Accounting (Income Ledger, Expense Register, Petty Cash, Vendor Payments, GST Invoices, Reports)
   - Staff Management, Notifications & Immutable Audit Logs

3. **`backend/` — Shared FastAPI + Motor Serverless Backend**
   - Deployed on Vercel: `https://hotel-management-backend-beta.vercel.app`
   - Event-loop-aware MongoDB Atlas connection pool (`core.py`)
   - Automatic initial seeding of 4 luxury room categories, 14 physical rooms (Floors 1–4), staff roles, and sample ledger entries (`seed.py`)

## Automated Android APK Builds

GitHub Actions workflows automatically compile and sign release APKs on every push to `main` or manual `workflow_dispatch`:
- `.github/workflows/customer-apk-build.yml` → `GrandPalace-Customer-Booking.apk`
- `.github/workflows/admin-apk-build.yml` → `GrandPalace-Hotel-Admin.apk`
