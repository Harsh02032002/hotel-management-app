"""Database Seeding for The Grand Palace Hotel (Single-Hotel Property Management & Customer Booking System)."""
from bson import ObjectId
from core import db, hash_password, now_iso, logger

HOTEL_PROFILE = {
    "key": "primary",
    "name": "The Grand Palace Hotel",
    "tagline": "Heritage Luxury & Bespoke Hospitality",
    "description": "Experience timeless royal hospitality at The Grand Palace Hotel. Featuring curated luxury suites, rooftop infinity pool, fine dining at Maharaja Court, and 24x7 concierge service.",
    "address": "MG Road, Royal Enclave, Jaipur, Rajasthan 302001",
    "city": "Jaipur",
    "phone": "+91 98765 43210",
    "email": "reservations@grandpalacehotel.in",
    "gstin": "08AABCT1234F1Z5",
    "check_in_time": "02:00 PM",
    "check_out_time": "11:00 AM",
    "cancellation_policy": "Free cancellation up to 24 hours before check-in. Cancellations within 24 hours incur a 20% retention charge.",
    "rating": 4.9,
    "reviews_count": 428,
    "hero_image": "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=1200&auto=format&fit=crop",
    "gallery": [
        "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=1200&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1200&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?q=80&w=1200&auto=format&fit=crop",
    ],
    "amenities": [
        "High-Speed Wi-Fi",
        "Rooftop Infinity Pool",
        "24x7 Room Service",
        "Fine Dining Restaurant",
        "Luxury Spa & Wellness",
        "Airport Chauffeur Pickup",
        "Valet Parking",
        "Smart Room Controls",
    ],
}

CATEGORIES_SEED = [
    {
        "name": "Deluxe Heritage Room",
        "slug": "deluxe-heritage",
        "description": "Elegant 380 sq.ft room with handcrafted teak furnishings, king-size plush bed, rain shower, and courtyard garden view.",
        "base_price": 4500,
        "weekend_price": 5200,
        "max_guests": 2,
        "bed_type": "King Bed",
        "size_sqft": 380,
        "amenities": ["Free Wi-Fi", "Breakfast Included", "Smart TV", "Mini Bar", "Rain Shower", "Work Desk", "Air Conditioning"],
        "images": [
            "https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=1000&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=1000&auto=format&fit=crop",
        ],
        "room_numbers": [("101", 1), ("102", 1), ("103", 1), ("104", 1), ("105", 1)],
    },
    {
        "name": "Premier Executive Club",
        "slug": "premier-executive",
        "description": "Spacious 480 sq.ft executive room with private balcony, club lounge access, espresso machine, and marble bathroom.",
        "base_price": 6800,
        "weekend_price": 7500,
        "max_guests": 3,
        "bed_type": "King Bed + Sofa Bed",
        "size_sqft": 480,
        "amenities": ["Free Wi-Fi", "Breakfast & Evening Cocktails", "Private Balcony", "Espresso Maker", "Bathtub", "Smart TV", "Mini Bar"],
        "images": [
            "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1000&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=80&w=1000&auto=format&fit=crop",
        ],
        "room_numbers": [("201", 2), ("202", 2), ("203", 2), ("204", 2)],
    },
    {
        "name": "Royal Courtyard Suite",
        "slug": "royal-courtyard-suite",
        "description": "Expansive 720 sq.ft luxury suite with separate living parlor, private sit-out overlooking the palace fountain, and jacuzzi.",
        "base_price": 11500,
        "weekend_price": 13000,
        "max_guests": 4,
        "bed_type": "california King + Twin Daybed",
        "size_sqft": 720,
        "amenities": ["24x7 Butler Service", "Airport Transfer", "Jacuzzi Bathtub", "Living Room", "Breakfast Included", "Premium Bar", "High-Speed Wi-Fi"],
        "images": [
            "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?q=80&w=1000&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=1000&auto=format&fit=crop",
        ],
        "room_numbers": [("301", 3), ("302", 3), ("303", 3)],
    },
    {
        "name": "Maharaja Presidential Suite",
        "slug": "maharaja-presidential-suite",
        "description": "Our signature 1,250 sq.ft presidential suite with private plunge pool, dining room for 6, personal butler, and panoramic terrace.",
        "base_price": 22000,
        "weekend_price": 25000,
        "max_guests": 4,
        "bed_type": "2 King Master Bedrooms",
        "size_sqft": 1250,
        "amenities": ["Private Plunge Pool", "Dedicated Butler", "Chauffeur Limousine", "All Meals Included", "Private Terrace", "Spa Credits", "Home Theatre"],
        "images": [
            "https://images.unsplash.com/photo-1591088398332-8a7791972843?q=80&w=1000&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=1000&auto=format&fit=crop",
        ],
        "room_numbers": [("401", 4), ("402", 4)],
    },
]

STAFF_SEED = [
    {
        "name": "Vikramaditya Rathore",
        "email": "admin@grandpalacehotel.in",
        "phone": "+91 98765 00001",
        "role": "admin",
        "department": "Executive Management",
        "shift": "General (9 AM - 6 PM)",
        "salary": 85000,
        "password": "admin123",
    },
    {
        "name": "Ananya Sharma",
        "email": "frontdesk@grandpalacehotel.in",
        "phone": "+91 98765 00002",
        "role": "frontdesk",
        "department": "Front Office & Reservations",
        "shift": "Morning (7 AM - 3 PM)",
        "salary": 38000,
        "password": "admin123",
    },
    {
        "name": "Rameshwar Meena",
        "email": "housekeeping@grandpalacehotel.in",
        "phone": "+91 98765 00003",
        "role": "housekeeping",
        "department": "Housekeeping",
        "shift": "Morning (8 AM - 4 PM)",
        "salary": 28000,
        "password": "admin123",
    },
    {
        "name": "Siddharth Jain",
        "email": "finance@grandpalacehotel.in",
        "phone": "+91 98765 00004",
        "role": "finance",
        "department": "Accounts & GST Billing",
        "shift": "General (9 AM - 6 PM)",
        "salary": 52000,
        "password": "admin123",
    },
]


async def ensure_seeded():
    # 1. Hotel profile
    if not await db.hotel_profile.find_one({"key": "primary"}):
        await db.hotel_profile.insert_one({**HOTEL_PROFILE, "created_at": now_iso()})

    # 2. Room Categories & Rooms (idempotent by slug & room_number)
    for cat in CATEGORIES_SEED:
        existing_cat = await db.room_categories.find_one({"slug": cat["slug"]})
        if not existing_cat:
            cat_doc = {
                "_id": ObjectId(),
                "name": cat["name"],
                "slug": cat["slug"],
                "description": cat["description"],
                "base_price": cat["base_price"],
                "weekend_price": cat["weekend_price"],
                "max_guests": cat["max_guests"],
                "bed_type": cat["bed_type"],
                "size_sqft": cat["size_sqft"],
                "amenities": cat["amenities"],
                "images": cat["images"],
                "created_at": now_iso(),
            }
            await db.room_categories.insert_one(cat_doc)
            cat_id_str = str(cat_doc["_id"])
        else:
            cat_id_str = str(existing_cat["_id"])

        for rnum, floor in cat["room_numbers"]:
            if not await db.rooms.find_one({"room_number": rnum}):
                await db.rooms.insert_one({
                    "_id": ObjectId(),
                    "room_number": rnum,
                    "floor": floor,
                    "category_id": cat_id_str,
                    "category_name": cat["name"],
                    "price_override": None,
                    "status": "AVAILABLE",
                    "housekeeping_status": "CLEAN",
                    "assigned_housekeeper": "Rameshwar Meena",
                    "last_cleaned_at": now_iso(),
                    "notes": "Ready for guest arrival",
                    "created_at": now_iso(),
                })

    # 3. Staff & Admin users (idempotent by email)
    for s in STAFF_SEED:
        if not await db.staff.find_one({"email": s["email"].lower()}):
            await db.staff.insert_one({
                "name": s["name"],
                "email": s["email"].lower(),
                "phone": s["phone"],
                "role": s["role"],
                "department": s["department"],
                "shift": s["shift"],
                "salary": s["salary"],
                "active": True,
                "password_hash": hash_password(s["password"]),
                "created_at": now_iso(),
            })

    # 4. Demo Customer User
    if not await db.customers.find_one({"email": "guest@grandpalacehotel.in"}):
        await db.customers.insert_one({
            "name": "Aarav Khanna",
            "email": "guest@grandpalacehotel.in",
            "phone": "+91 98111 22334",
            "address": "Defence Colony, New Delhi",
            "id_type": "Aadhaar Card",
            "id_number": "XXXX-XXXX-4829",
            "password_hash": hash_password("guest123"),
            "created_at": now_iso(),
        })

    # 5. Initial Finance Ledger Entries
    if await db.ledger.count_documents({}) == 0:
        await db.ledger.insert_many([
            {
                "entry_type": "INCOME",
                "category": "Room Tariff & GST",
                "title": "Corporate Advance Booking — Suite 301",
                "amount": 27140,
                "payment_mode": "BANK_TRANSFER",
                "vendor_name": "",
                "invoice_ref": "INV-GP-2026-0001",
                "notes": "2 nights Royal Courtyard Suite",
                "recorded_by": "Siddharth Jain",
                "created_at": now_iso(),
            },
            {
                "entry_type": "EXPENSE",
                "category": "Linen & Laundry",
                "title": "Monthly Luxury Linen Dry-Cleaning",
                "amount": 6400,
                "payment_mode": "UPI",
                "vendor_name": "Royal Wash Care Pvt Ltd",
                "invoice_ref": "EXP-2026-101",
                "notes": "All 4 floors bed & bath linen",
                "recorded_by": "Siddharth Jain",
                "created_at": now_iso(),
            },
            {
                "entry_type": "PETTY_CASH",
                "category": "Front Office Supplies",
                "title": "Welcome Rose Garlands & Refreshment Tray",
                "amount": 1850,
                "payment_mode": "CASH",
                "vendor_name": "Jaipur Florist Market",
                "invoice_ref": "PC-2026-042",
                "notes": "VIP arrival hospitality",
                "recorded_by": "Ananya Sharma",
                "created_at": now_iso(),
            },
            {
                "entry_type": "VENDOR_PAYMENT",
                "category": "F&B & Kitchen Supplies",
                "title": "Fresh Organic Produce & Dairy Supply",
                "amount": 14200,
                "payment_mode": "BANK_TRANSFER",
                "vendor_name": "Aravalli Agro Foods",
                "invoice_ref": "VP-2026-088",
                "notes": "Weekly kitchen restock",
                "recorded_by": "Siddharth Jain",
                "created_at": now_iso(),
            },
        ])
