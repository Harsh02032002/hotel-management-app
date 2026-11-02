"""Hotel Admin Application API Routes:
Admin Auth, Dashboard, Room Categories & Pricing, Room Inventory & Calendar,
Advance & Walk-in Bookings, Confirm/Reject Bookings, Guest Check-in with KYC,
In-House Guests, Room Change, Stay Extension, Guest Checkout (marks room DIRTY),
Housekeeping (marks room CLEAN & AVAILABLE), Payments & GST Invoices,
Staff Management, Finance Overview (Income Ledger, Expense Register, Petty Cash,
Vendor Payments), Reports, Notifications & Audit Logs."""
from fastapi import APIRouter, Depends, HTTPException, Query
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import random

from core import (
    db, oid, doc_out, now_iso, hash_password, verify_password, make_token,
    current_admin, compute_nights_and_gst, find_conflicting_room_ids,
    log_audit, create_notification
)
from seed import ensure_seeded
from models import (
    AdminLoginIn, RoomCategoryIn, RoomCategoryPriceUpdateIn, RoomIn, RoomStatusUpdateIn,
    WalkInBookingIn, RejectBookingIn, CheckInKycIn, RoomChangeIn, StayExtensionIn,
    CheckoutIn, AdminRecordPaymentIn, HousekeepingUpdateIn, StaffCreateIn, LedgerEntryIn
)

router = APIRouter(prefix="/api/admin")


# ------------------------------------------------------------------
# 1. Admin & Staff Authentication
# ------------------------------------------------------------------
@router.post("/auth/login")
async def admin_login(body: AdminLoginIn):
    email = body.email.lower().strip()
    staff = await db.staff.find_one({"email": email, "active": True})
    if not staff and await db.staff.count_documents({}) == 0:
        await ensure_seeded()
        staff = await db.staff.find_one({"email": email, "active": True})
    if not staff or not verify_password(body.password, staff.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid admin email or password")
    token = make_token(str(staff["_id"]), staff.get("role", "admin"), {"name": staff["name"]})
    await log_audit(staff["name"], staff["role"], "ADMIN_LOGIN", "staff", str(staff["_id"]), email)
    return {"token": token, "admin": doc_out(staff)}


@router.get("/auth/me")
async def admin_me(staff: dict = Depends(current_admin)):
    return doc_out(staff)


# ------------------------------------------------------------------
# 2. Executive Dashboard
# ------------------------------------------------------------------
@router.get("/dashboard")
async def admin_dashboard(staff: dict = Depends(current_admin)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    rooms = [doc_out(r) async for r in db.rooms.find().sort("room_number", 1)]
    bookings = [doc_out(b) async for b in db.bookings.find().sort("created_at", -1).limit(300)]
    ledger_entries = [doc_out(l) async for l in db.ledger.find().sort("created_at", -1).limit(500)]
    recent_logs = [doc_out(a) async for a in db.audit_logs.find().sort("created_at", -1).limit(15)]

    total_rooms = len(rooms)
    available_rooms = sum(1 for r in rooms if r["status"] == "AVAILABLE")
    occupied_rooms = sum(1 for r in rooms if r["status"] == "OCCUPIED")
    dirty_rooms = sum(1 for r in rooms if r["status"] in ("DIRTY", "CLEANING"))
    blocked_rooms = sum(1 for r in rooms if r["status"] == "BLOCKED")
    occupancy_rate = round((occupied_rooms / total_rooms) * 100, 1) if total_rooms else 0.0

    pending_bookings = sum(1 for b in bookings if b["status"] == "PENDING")
    confirmed_bookings = sum(1 for b in bookings if b["status"] == "CONFIRMED")
    in_house_guests = sum(1 for b in bookings if b["status"] == "CHECKED_IN")
    today_arrivals = sum(1 for b in bookings if b["check_in"] == today and b["status"] in ("PENDING", "CONFIRMED", "CHECKED_IN"))
    today_departures = sum(1 for b in bookings if b["check_out"] == today and b["status"] in ("CHECKED_IN", "CHECKED_OUT"))

    total_income = sum(l["amount"] for l in ledger_entries if l["entry_type"] == "INCOME")
    today_income = sum(l["amount"] for l in ledger_entries if l["entry_type"] == "INCOME" and l["created_at"].startswith(today))
    total_expenses = sum(l["amount"] for l in ledger_entries if l["entry_type"] in ("EXPENSE", "PETTY_CASH", "VENDOR_PAYMENT"))

    return {
        "kpis": {
            "total_rooms": total_rooms,
            "available_rooms": available_rooms,
            "occupied_rooms": occupied_rooms,
            "dirty_rooms": dirty_rooms,
            "blocked_rooms": blocked_rooms,
            "occupancy_rate": occupancy_rate,
            "pending_bookings": pending_bookings,
            "confirmed_bookings": confirmed_bookings,
            "in_house_guests": in_house_guests,
            "today_arrivals": today_arrivals,
            "today_departures": today_departures,
            "today_revenue": today_income,
            "total_revenue": total_income,
            "total_expenses": total_expenses,
            "net_profit": total_income - total_expenses,
        },
        "recent_bookings": bookings[:10],
        "rooms_overview": rooms,
        "recent_audit_logs": recent_logs,
    }


# ------------------------------------------------------------------
# 3. Room Categories & Pricing Management
# ------------------------------------------------------------------
@router.get("/categories")
async def list_categories(staff: dict = Depends(current_admin)):
    cats = [doc_out(c) async for c in db.room_categories.find().sort("base_price", 1)]
    rooms = [doc_out(r) async for r in db.rooms.find().sort("room_number", 1)]
    for c in cats:
        cat_rooms = [r for r in rooms if r["category_id"] == c["id"]]
        c["total_rooms"] = len(cat_rooms)
        c["available_rooms"] = sum(1 for r in cat_rooms if r["status"] == "AVAILABLE")
    return {"categories": cats}


@router.post("/categories", status_code=201)
async def create_category(body: RoomCategoryIn, staff: dict = Depends(current_admin)):
    doc = {
        **body.model_dump(),
        "weekend_price": round(body.base_price * 1.15),
        "created_at": now_iso(),
    }
    res = await db.room_categories.insert_one(doc)
    created = await db.room_categories.find_one({"_id": res.inserted_id})
    await log_audit(staff["name"], staff["role"], "CATEGORY_CREATED", "room_category", str(created["_id"]), body.name)
    return doc_out(created)


@router.patch("/categories/{category_id}/pricing")
async def update_category_pricing(category_id: str, body: RoomCategoryPriceUpdateIn, staff: dict = Depends(current_admin)):
    patch = {"base_price": body.base_price}
    if body.weekend_price is not None:
        patch["weekend_price"] = body.weekend_price
    res = await db.room_categories.update_one({"_id": oid(category_id)}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Room category not found")
    updated = await db.room_categories.find_one({"_id": oid(category_id)})
    await log_audit(
        staff["name"], staff["role"], "CATEGORY_PRICE_UPDATED", "room_category",
        category_id, f"{updated['name']} -> ₹{body.base_price}/night"
    )
    return doc_out(updated)


# ------------------------------------------------------------------
# 4. Room Inventory & Availability Calendar
# ------------------------------------------------------------------
@router.get("/rooms")
async def list_rooms(staff: dict = Depends(current_admin)):
    rooms = [doc_out(r) async for r in db.rooms.find().sort("room_number", 1)]
    cats = {str(c["_id"]): c["base_price"] async for c in db.room_categories.find()}
    for r in rooms:
        r["effective_price"] = r.get("price_override") or cats.get(r["category_id"], 4500)
    return {"rooms": rooms}


@router.post("/rooms", status_code=201)
async def add_room(body: RoomIn, staff: dict = Depends(current_admin)):
    rnum = body.room_number.strip()
    if await db.rooms.find_one({"room_number": rnum}):
        raise HTTPException(status_code=409, detail=f"Room {rnum} already exists")
    cat = await db.room_categories.find_one({"_id": oid(body.category_id)})
    if not cat:
        raise HTTPException(status_code=404, detail="Room category not found")
    doc = {
        "room_number": rnum,
        "floor": body.floor,
        "category_id": str(cat["_id"]),
        "category_name": cat["name"],
        "price_override": body.price_override,
        "status": body.status,
        "housekeeping_status": "CLEAN" if body.status == "AVAILABLE" else body.status,
        "assigned_housekeeper": "Rameshwar Meena",
        "last_cleaned_at": now_iso(),
        "notes": body.notes,
        "created_at": now_iso(),
    }
    res = await db.rooms.insert_one(doc)
    created = await db.rooms.find_one({"_id": res.inserted_id})
    await log_audit(staff["name"], staff["role"], "ROOM_ADDED", "room", str(created["_id"]), f"Room {rnum} ({cat['name']})")
    return doc_out(created)


@router.patch("/rooms/{room_id}")
async def update_room_status_or_price(room_id: str, body: RoomStatusUpdateIn, staff: dict = Depends(current_admin)):
    room = await db.rooms.find_one({"_id": oid(room_id)})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    patch: dict = {"status": body.status}
    if body.status == "AVAILABLE":
        patch["housekeeping_status"] = "CLEAN"
    elif body.status in ("DIRTY", "CLEANING"):
        patch["housekeeping_status"] = body.status
    if body.notes is not None:
        patch["notes"] = body.notes
    if body.price_override is not None:
        patch["price_override"] = body.price_override if body.price_override > 0 else None
    await db.rooms.update_one({"_id": room["_id"]}, {"$set": patch})
    updated = await db.rooms.find_one({"_id": room["_id"]})
    await log_audit(
        staff["name"], staff["role"], "ROOM_UPDATED", "room",
        room_id, f"Room {room['room_number']} -> {body.status}"
    )
    return doc_out(updated)


@router.delete("/rooms/{room_id}")
async def delete_room(room_id: str, staff: dict = Depends(current_admin)):
    room = await db.rooms.find_one({"_id": oid(room_id)})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    active = await db.bookings.find_one({"room_id": room_id, "status": {"$in": ["PENDING", "CONFIRMED", "CHECKED_IN"]}})
    if active:
        raise HTTPException(status_code=400, detail=f"Cannot remove Room {room['room_number']}: has active booking {active['booking_ref']}")
    await db.rooms.delete_one({"_id": room["_id"]})
    await log_audit(staff["name"], staff["role"], "ROOM_REMOVED", "room", room_id, f"Room {room['room_number']}")
    return {"ok": True}


@router.get("/calendar")
async def availability_calendar(
    start_date: str = Query(default=""),
    days: int = Query(default=10, ge=1, le=31),
    staff: dict = Depends(current_admin),
):
    base = datetime.strptime(start_date[:10], "%Y-%m-%d") if start_date else datetime.now(timezone.utc)
    dates = [(base + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days)]
    end_date = (base + timedelta(days=days)).strftime("%Y-%m-%d")

    rooms = [doc_out(r) async for r in db.rooms.find().sort("room_number", 1)]
    bookings = [
        doc_out(b)
        async for b in db.bookings.find({
            "status": {"$in": ["PENDING", "CONFIRMED", "CHECKED_IN"]},
            "check_in": {"$lt": end_date},
            "check_out": {"$gt": dates[0]},
        })
    ]

    matrix = []
    for r in rooms:
        day_cells = []
        for d in dates:
            matching = next((b for b in bookings if b["room_id"] == r["id"] and b["check_in"] <= d < b["check_out"]), None)
            if matching:
                day_cells.append({
                    "date": d,
                    "state": matching["status"],
                    "booking_ref": matching["booking_ref"],
                    "guest_name": matching["guest"]["name"],
                })
            elif r["status"] == "BLOCKED":
                day_cells.append({"date": d, "state": "BLOCKED", "booking_ref": "", "guest_name": ""})
            elif r["status"] in ("DIRTY", "CLEANING") and d == dates[0]:
                day_cells.append({"date": d, "state": r["status"], "booking_ref": "", "guest_name": ""})
            else:
                day_cells.append({"date": d, "state": "AVAILABLE", "booking_ref": "", "guest_name": ""})
        matrix.append({
            "room_id": r["id"],
            "room_number": r["room_number"],
            "category_name": r["category_name"],
            "current_status": r["status"],
            "days": day_cells,
        })
    return {"dates": dates, "calendar": matrix}


# ------------------------------------------------------------------
# 5. Booking Management (Confirm, Reject, Walk-in, Check-in, KYC, Room Change, Extend, Checkout)
# ------------------------------------------------------------------
@router.get("/bookings")
async def admin_list_bookings(
    status: str = Query(default=""),
    q: str = Query(default=""),
    staff: dict = Depends(current_admin),
):
    query: dict = {}
    if status and status != "ALL":
        query["status"] = status
    docs = [doc_out(b) async for b in db.bookings.find(query).sort("created_at", -1).limit(300)]
    if q.strip():
        needle = q.strip().lower()
        docs = [
            b for b in docs
            if needle in b["booking_ref"].lower()
            or needle in b["guest"]["name"].lower()
            or needle in b["guest"].get("phone", "").lower()
            or needle in b["room_number"].lower()
        ]
    return {"bookings": docs}


@router.get("/bookings/{booking_id}")
async def admin_get_booking(booking_id: str, staff: dict = Depends(current_admin)):
    b = await db.bookings.find_one({"_id": oid(booking_id)})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    return doc_out(b)


@router.post("/bookings/{booking_id}/confirm")
async def confirm_booking(booking_id: str, staff: dict = Depends(current_admin)):
    b = await db.bookings.find_one({"_id": oid(booking_id)})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b["status"] != "PENDING":
        raise HTTPException(status_code=400, detail=f"Booking is already {b['status']}")

    await db.bookings.update_one(
        {"_id": b["_id"]},
        {
            "$set": {"status": "CONFIRMED", "confirmed_by": staff["name"], "confirmed_at": now_iso()},
            "$push": {
                "timeline": {
                    "status": "CONFIRMED",
                    "note": f"Confirmed by {staff['name']} ({staff['role']})",
                    "at": now_iso(),
                }
            },
        },
    )
    if b.get("customer_id"):
        await create_notification(
            "customer", b["customer_id"],
            f"Booking {b['booking_ref']} Confirmed!",
            f"Your reservation for {b['category_name']} (Room {b['room_number']}) from {b['check_in']} to {b['check_out']} has been confirmed by hotel management.",
            booking_id,
        )
    await log_audit(staff["name"], staff["role"], "BOOKING_CONFIRMED", "booking", booking_id, b["booking_ref"])
    updated = await db.bookings.find_one({"_id": b["_id"]})
    return doc_out(updated)


@router.post("/bookings/{booking_id}/reject")
async def reject_booking(booking_id: str, body: RejectBookingIn, staff: dict = Depends(current_admin)):
    b = await db.bookings.find_one({"_id": oid(booking_id)})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b["status"] in ("CHECKED_IN", "CHECKED_OUT", "CANCELLED"):
        raise HTTPException(status_code=400, detail=f"Cannot reject booking in {b['status']} state")

    payment_status = "REFUND_INITIATED" if b.get("payment_status") == "PAID" else b.get("payment_status", "UNPAID")
    await db.bookings.update_one(
        {"_id": b["_id"]},
        {
            "$set": {
                "status": "CANCELLED",
                "payment_status": payment_status,
                "cancel_reason": body.reason,
                "cancelled_at": now_iso(),
            },
            "$push": {
                "timeline": {
                    "status": "CANCELLED",
                    "note": f"Rejected by {staff['name']}: {body.reason}",
                    "at": now_iso(),
                }
            },
        },
    )
    if b.get("room_id"):
        await db.rooms.update_one({"_id": oid(b["room_id"])}, {"$set": {"status": "AVAILABLE"}})
    if b.get("customer_id"):
        await create_notification(
            "customer", b["customer_id"],
            f"Update on Booking {b['booking_ref']}",
            f"Your booking could not be confirmed: {body.reason}",
            booking_id,
        )
    await log_audit(staff["name"], staff["role"], "BOOKING_REJECTED", "booking", booking_id, f"{b['booking_ref']}: {body.reason}")
    updated = await db.bookings.find_one({"_id": b["_id"]})
    return doc_out(updated)


@router.post("/bookings/walk-in", status_code=201)
async def create_walk_in_or_advance_booking(body: WalkInBookingIn, staff: dict = Depends(current_admin)):
    cat = await db.room_categories.find_one({"_id": oid(body.category_id)})
    if not cat:
        raise HTTPException(status_code=404, detail="Room category not found")

    check_in = body.check_in.strip()[:10]
    check_out = body.check_out.strip()[:10]
    busy_ids = await find_conflicting_room_ids(check_in, check_out)

    if body.room_id:
        room = await db.rooms.find_one({"_id": oid(body.room_id)})
        if not room or room["status"] != "AVAILABLE" or str(room["_id"]) in busy_ids:
            raise HTTPException(status_code=409, detail="Selected room is not available for these dates")
    else:
        candidates = await db.rooms.find({"category_id": str(cat["_id"]), "status": "AVAILABLE"}).sort("room_number", 1).to_list(100)
        free = [r for r in candidates if str(r["_id"]) not in busy_ids]
        if not free:
            raise HTTPException(status_code=409, detail=f"No available {cat['name']} rooms for {check_in} → {check_out}")
        room = free[0]

    tariff = room.get("price_override") or cat["base_price"]
    pricing = compute_nights_and_gst(tariff, check_in, check_out, discount=body.discount)
    booking_ref = f"GP-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{random.randint(1000, 9999)}"
    invoice_number = f"INV-{booking_ref}"

    advance_paid = max(0, min(body.advance_paid, pricing["grand_total"]))
    balance_due = pricing["grand_total"] - advance_paid
    payment_status = "PAID" if balance_due == 0 else ("PARTIAL" if advance_paid > 0 else "UNPAID")
    initial_status = "CHECKED_IN" if body.auto_check_in else "CONFIRMED"

    booking_doc = {
        "_id": ObjectId(),
        "booking_ref": booking_ref,
        "invoice_number": invoice_number,
        "booking_source": body.booking_type,  # WALK_IN | ADVANCE
        "customer_id": "",
        "guest": {
            "name": body.guest_name.strip(),
            "email": body.guest_email.strip(),
            "phone": body.guest_phone.strip(),
            "address": "",
        },
        "kyc": {
            "id_type": body.id_type,
            "id_number": body.id_number.strip(),
            "document_url": "",
            "verified": bool(body.id_number.strip()),
        },
        "category_id": str(cat["_id"]),
        "category_name": cat["name"],
        "category_image": (cat.get("images") or [""])[0],
        "room_id": str(room["_id"]),
        "room_number": room["room_number"],
        "floor": room.get("floor", 1),
        "check_in": check_in,
        "check_out": check_out,
        "guests": body.guests,
        "special_requests": body.special_requests.strip(),
        "pricing": pricing,
        "payment_method": body.payment_method,
        "payment_status": payment_status,
        "amount_paid": advance_paid,
        "balance_due": balance_due,
        "status": initial_status,
        "timeline": [
            {
                "status": initial_status,
                "note": f"{body.booking_type} reservation created by {staff['name']}",
                "at": now_iso(),
            }
        ],
        "created_at": now_iso(),
    }
    await db.bookings.insert_one(booking_doc)

    if body.auto_check_in:
        await db.rooms.update_one({"_id": room["_id"]}, {"$set": {"status": "OCCUPIED"}})

    if advance_paid > 0:
        await db.payments.insert_one({
            "booking_id": str(booking_doc["_id"]),
            "booking_ref": booking_ref,
            "guest_name": body.guest_name.strip(),
            "amount": advance_paid,
            "payment_method": body.payment_method,
            "transaction_id": f"POS-{random.randint(100000, 999999)}",
            "status": "SUCCESS",
            "created_at": now_iso(),
        })
        await db.ledger.insert_one({
            "entry_type": "INCOME",
            "category": f"{body.booking_type} Room Booking",
            "title": f"{booking_ref} — Room {room['room_number']} ({body.guest_name.strip()})",
            "amount": advance_paid,
            "payment_mode": body.payment_method,
            "vendor_name": body.guest_name.strip(),
            "invoice_ref": invoice_number,
            "notes": f"Recorded by {staff['name']}",
            "recorded_by": staff["name"],
            "created_at": now_iso(),
        })

    await log_audit(
        staff["name"], staff["role"], f"{body.booking_type}_CREATED", "booking",
        str(booking_doc["_id"]), f"{booking_ref} Room {room['room_number']} ({body.guest_name})"
    )
    return doc_out(booking_doc)


@router.post("/bookings/{booking_id}/check-in")
async def guest_check_in(booking_id: str, body: CheckInKycIn, staff: dict = Depends(current_admin)):
    b = await db.bookings.find_one({"_id": oid(booking_id)})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b["status"] not in ("PENDING", "CONFIRMED"):
        raise HTTPException(status_code=400, detail=f"Booking is currently in {b['status']} state")

    target_room_id = body.room_id or b["room_id"]
    room = await db.rooms.find_one({"_id": oid(target_room_id)})
    if not room:
        raise HTTPException(status_code=404, detail="Assigned room not found")
    if room["status"] not in ("AVAILABLE", "OCCUPIED") and str(room["_id"]) != b["room_id"]:
        raise HTTPException(status_code=400, detail=f"Room {room['room_number']} is currently {room['status']} (must be clean & available)")

    kyc_data = {
        "id_type": body.id_type,
        "id_number": body.id_number.strip(),
        "document_url": body.document_url.strip(),
        "nationality": body.nationality.strip(),
        "address": body.address.strip(),
        "additional_guests": body.additional_guests,
        "verified": True,
        "verified_by": staff["name"],
        "verified_at": now_iso(),
    }

    amount_paid = b.get("amount_paid", 0) + max(0, body.deposit_collected)
    grand_total = b["pricing"]["grand_total"]
    balance_due = max(0, grand_total - amount_paid)
    payment_status = "PAID" if balance_due == 0 else ("PARTIAL" if amount_paid > 0 else "UNPAID")

    await db.bookings.update_one(
        {"_id": b["_id"]},
        {
            "$set": {
                "status": "CHECKED_IN",
                "room_id": str(room["_id"]),
                "room_number": room["room_number"],
                "kyc": kyc_data,
                "amount_paid": amount_paid,
                "balance_due": balance_due,
                "payment_status": payment_status,
                "checked_in_at": now_iso(),
                "checked_in_by": staff["name"],
            },
            "$push": {
                "timeline": {
                    "status": "CHECKED_IN",
                    "note": f"Checked in to Room {room['room_number']} by {staff['name']} (KYC: {body.id_type} {body.id_number})",
                    "at": now_iso(),
                }
            },
        },
    )

    # Mark physical room as OCCUPIED
    await db.rooms.update_one({"_id": room["_id"]}, {"$set": {"status": "OCCUPIED"}})

    if body.deposit_collected > 0:
        await db.payments.insert_one({
            "booking_id": booking_id,
            "booking_ref": b["booking_ref"],
            "guest_name": b["guest"]["name"],
            "amount": body.deposit_collected,
            "payment_method": body.payment_mode,
            "transaction_id": f"CHK-{random.randint(100000, 999999)}",
            "status": "SUCCESS",
            "created_at": now_iso(),
        })
        await db.ledger.insert_one({
            "entry_type": "INCOME",
            "category": "Check-in Deposit",
            "title": f"Check-in payment — {b['booking_ref']} (Room {room['room_number']})",
            "amount": body.deposit_collected,
            "payment_mode": body.payment_mode,
            "vendor_name": b["guest"]["name"],
            "invoice_ref": b["invoice_number"],
            "notes": f"Collected at check-in by {staff['name']}",
            "recorded_by": staff["name"],
            "created_at": now_iso(),
        })

    if b.get("customer_id"):
        await create_notification(
            "customer", b["customer_id"],
            f"Welcome to Room {room['room_number']}!",
            f"You are now checked in to {b['category_name']} (Room {room['room_number']}). Dial 9 from your room phone for 24x7 concierge.",
            booking_id,
        )
    await log_audit(
        staff["name"], staff["role"], "GUEST_CHECKED_IN", "booking",
        booking_id, f"{b['booking_ref']} -> Room {room['room_number']}"
    )
    updated = await db.bookings.find_one({"_id": b["_id"]})
    return doc_out(updated)


@router.get("/guests/in-house")
async def list_in_house_guests(staff: dict = Depends(current_admin)):
    guests = [doc_out(b) async for b in db.bookings.find({"status": "CHECKED_IN"}).sort("room_number", 1)]
    return {"in_house_guests": guests}


@router.post("/bookings/{booking_id}/room-change")
async def change_guest_room(booking_id: str, body: RoomChangeIn, staff: dict = Depends(current_admin)):
    b = await db.bookings.find_one({"_id": oid(booking_id)})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b["status"] not in ("CONFIRMED", "CHECKED_IN"):
        raise HTTPException(status_code=400, detail="Room change is only allowed for CONFIRMED or CHECKED_IN bookings")

    new_room = await db.rooms.find_one({"_id": oid(body.new_room_id)})
    if not new_room:
        raise HTTPException(status_code=404, detail="Target room not found")
    if new_room["status"] != "AVAILABLE":
        raise HTTPException(status_code=400, detail=f"Room {new_room['room_number']} is currently {new_room['status']}")

    old_room_id = b["room_id"]
    old_room_number = b["room_number"]

    await db.bookings.update_one(
        {"_id": b["_id"]},
        {
            "$set": {
                "room_id": str(new_room["_id"]),
                "room_number": new_room["room_number"],
                "floor": new_room.get("floor", 1),
                "category_id": new_room["category_id"],
                "category_name": new_room["category_name"],
            },
            "$push": {
                "timeline": {
                    "status": b["status"],
                    "note": f"Room changed from #{old_room_number} to #{new_room['room_number']} ({body.reason}) by {staff['name']}",
                    "at": now_iso(),
                }
            },
        },
    )

    if b["status"] == "CHECKED_IN":
        await db.rooms.update_one(
            {"_id": oid(old_room_id)},
            {"$set": {"status": "DIRTY", "housekeeping_status": "DIRTY", "notes": f"Vacated via room move to #{new_room['room_number']}"}},
        )
        await db.rooms.update_one({"_id": new_room["_id"]}, {"$set": {"status": "OCCUPIED"}})

    if b.get("customer_id"):
        await create_notification(
            "customer", b["customer_id"],
            f"Room Updated to #{new_room['room_number']}",
            f"Your room for booking {b['booking_ref']} has been updated from Room {old_room_number} to Room {new_room['room_number']}.",
            booking_id,
        )
    await log_audit(
        staff["name"], staff["role"], "ROOM_CHANGED", "booking",
        booking_id, f"{b['booking_ref']}: Room {old_room_number} -> Room {new_room['room_number']}"
    )
    updated = await db.bookings.find_one({"_id": b["_id"]})
    return doc_out(updated)


@router.post("/bookings/{booking_id}/extend-stay")
async def extend_guest_stay(booking_id: str, body: StayExtensionIn, staff: dict = Depends(current_admin)):
    b = await db.bookings.find_one({"_id": oid(booking_id)})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b["status"] not in ("CONFIRMED", "CHECKED_IN"):
        raise HTTPException(status_code=400, detail="Stay can only be extended for active reservations")

    new_out = body.new_check_out.strip()[:10]
    busy_ids = await find_conflicting_room_ids(b["check_in"], new_out, exclude_booking_id=booking_id)
    if b["room_id"] in busy_ids:
        raise HTTPException(status_code=409, detail=f"Room {b['room_number']} has another reservation conflicting with {new_out}")

    total_discount = b["pricing"].get("discount", 0) + max(0, body.extra_discount)
    new_pricing = compute_nights_and_gst(b["pricing"]["price_per_night"], b["check_in"], new_out, discount=total_discount)
    extra_charges = b["pricing"].get("extra_charges", 0)
    new_pricing["extra_charges"] = extra_charges
    new_pricing["grand_total"] += extra_charges

    amount_paid = b.get("amount_paid", 0)
    balance_due = max(0, new_pricing["grand_total"] - amount_paid)
    payment_status = "PAID" if balance_due == 0 else ("PARTIAL" if amount_paid > 0 else "UNPAID")

    await db.bookings.update_one(
        {"_id": b["_id"]},
        {
            "$set": {
                "check_out": new_out,
                "pricing": new_pricing,
                "balance_due": balance_due,
                "payment_status": payment_status,
            },
            "$push": {
                "timeline": {
                    "status": b["status"],
                    "note": f"Stay extended to {new_out} ({new_pricing['nights']} nights, Total ₹{new_pricing['grand_total']}) by {staff['name']}",
                    "at": now_iso(),
                }
            },
        },
    )
    await log_audit(staff["name"], staff["role"], "STAY_EXTENDED", "booking", booking_id, f"{b['booking_ref']} -> {new_out}")
    updated = await db.bookings.find_one({"_id": b["_id"]})
    return doc_out(updated)


@router.post("/bookings/{booking_id}/check-out")
async def guest_check_out(booking_id: str, body: CheckoutIn, staff: dict = Depends(current_admin)):
    b = await db.bookings.find_one({"_id": oid(booking_id)})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b["status"] != "CHECKED_IN":
        raise HTTPException(status_code=400, detail="Only CHECKED_IN guests can be checked out")

    pricing = dict(b["pricing"])
    if body.extra_charges > 0:
        pricing["extra_charges"] = pricing.get("extra_charges", 0) + body.extra_charges
        pricing["grand_total"] += body.extra_charges

    amount_paid = b.get("amount_paid", 0)
    remaining = max(0, pricing["grand_total"] - amount_paid)
    collected_now = remaining if body.collect_balance else 0
    final_paid = amount_paid + collected_now
    final_balance = max(0, pricing["grand_total"] - final_paid)
    final_pay_status = "PAID" if final_balance == 0 else ("PARTIAL" if final_paid > 0 else "UNPAID")

    await db.bookings.update_one(
        {"_id": b["_id"]},
        {
            "$set": {
                "status": "CHECKED_OUT",
                "pricing": pricing,
                "amount_paid": final_paid,
                "balance_due": final_balance,
                "payment_status": final_pay_status,
                "checked_out_at": now_iso(),
                "checked_out_by": staff["name"],
            },
            "$push": {
                "timeline": {
                    "status": "CHECKED_OUT",
                    "note": f"Checked out by {staff['name']}. Room #{b['room_number']} marked DIRTY for housekeeping.",
                    "at": now_iso(),
                }
            },
        },
    )

    # CRITICAL WORKFLOW REQUIREMENT:
    # Admin completes checkout -> Room becomes DIRTY -> Housekeeping completes cleaning -> Room becomes Clean & Available
    await db.rooms.update_one(
        {"_id": oid(b["room_id"])},
        {
            "$set": {
                "status": "DIRTY",
                "housekeeping_status": "DIRTY",
                "notes": f"Guest {b['guest']['name']} checked out at {now_iso()[:16].replace('T', ' ')}",
            }
        },
    )

    if collected_now > 0:
        tx_id = f"OUT-{random.randint(100000, 999999)}"
        await db.payments.insert_one({
            "booking_id": booking_id,
            "booking_ref": b["booking_ref"],
            "guest_name": b["guest"]["name"],
            "amount": collected_now,
            "payment_method": body.payment_method,
            "transaction_id": tx_id,
            "status": "SUCCESS",
            "created_at": now_iso(),
        })
        await db.ledger.insert_one({
            "entry_type": "INCOME",
            "category": "Checkout Settlement",
            "title": f"Checkout settlement — {b['booking_ref']} (Room {b['room_number']})",
            "amount": collected_now,
            "payment_mode": body.payment_method,
            "vendor_name": b["guest"]["name"],
            "invoice_ref": b["invoice_number"],
            "notes": body.extra_charges_note or "Final bill settlement at checkout",
            "recorded_by": staff["name"],
            "created_at": now_iso(),
        })

    if b.get("customer_id"):
        await create_notification(
            "customer", b["customer_id"],
            f"Thank You for Staying at The Grand Palace!",
            f"Checkout complete for {b['booking_ref']}. Your GST invoice {b['invoice_number']} is ready for download.",
            booking_id,
        )
    await create_notification(
        "admin", "all",
        f"Housekeeping Required — Room {b['room_number']}",
        f"Room {b['room_number']} is now DIRTY after checkout of {b['guest']['name']}.",
        booking_id,
    )
    await log_audit(
        staff["name"], staff["role"], "GUEST_CHECKED_OUT", "booking",
        booking_id, f"{b['booking_ref']} Room {b['room_number']} -> DIRTY"
    )
    updated = await db.bookings.find_one({"_id": b["_id"]})
    return doc_out(updated)


# ------------------------------------------------------------------
# 6. Housekeeping Management
# ------------------------------------------------------------------
@router.get("/housekeeping")
async def list_housekeeping(staff: dict = Depends(current_admin)):
    rooms = [doc_out(r) async for r in db.rooms.find().sort("room_number", 1)]
    summary = {
        "dirty": sum(1 for r in rooms if r["status"] == "DIRTY"),
        "cleaning": sum(1 for r in rooms if r["status"] == "CLEANING"),
        "clean_available": sum(1 for r in rooms if r["status"] == "AVAILABLE"),
        "occupied": sum(1 for r in rooms if r["status"] == "OCCUPIED"),
    }
    return {"summary": summary, "rooms": rooms}


@router.post("/housekeeping/{room_id}/status")
async def update_housekeeping_status(room_id: str, body: HousekeepingUpdateIn, staff: dict = Depends(current_admin)):
    room = await db.rooms.find_one({"_id": oid(room_id)})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    target = body.status.upper()
    if target in ("CLEAN", "AVAILABLE"):
        new_room_status = "AVAILABLE"
        new_hk_status = "CLEAN"
    elif target == "CLEANING":
        new_room_status = "CLEANING"
        new_hk_status = "CLEANING"
    else:
        new_room_status = "DIRTY"
        new_hk_status = "DIRTY"

    patch: dict = {
        "status": new_room_status,
        "housekeeping_status": new_hk_status,
        "notes": body.notes or (
            "Cleaned & inspected — Ready for guest" if new_room_status == "AVAILABLE" else f"Housekeeping: {new_hk_status}"
        ),
    }
    if body.assigned_to:
        patch["assigned_housekeeper"] = body.assigned_to
    if new_room_status == "AVAILABLE":
        patch["last_cleaned_at"] = now_iso()

    await db.rooms.update_one({"_id": room["_id"]}, {"$set": patch})
    updated = await db.rooms.find_one({"_id": room["_id"]})
    await log_audit(
        staff["name"], staff["role"], "HOUSEKEEPING_UPDATED", "room",
        room_id, f"Room {room['room_number']} -> {new_room_status} ({new_hk_status})"
    )
    return doc_out(updated)


# ------------------------------------------------------------------
# 7. Payment Management & GST Invoice Management
# ------------------------------------------------------------------
@router.get("/payments")
async def list_payments(staff: dict = Depends(current_admin)):
    payments = [doc_out(p) async for p in db.payments.find().sort("created_at", -1).limit(200)]
    bookings = [doc_out(b) async for b in db.bookings.find().sort("created_at", -1).limit(200)]
    total_collected = sum(p["amount"] for p in payments)
    pending_dues = sum(b.get("balance_due", 0) for b in bookings if b["status"] not in ("CANCELLED",))
    return {
        "total_collected": total_collected,
        "pending_dues": pending_dues,
        "payments": payments,
        "invoices": [
            {
                "booking_id": b["id"],
                "invoice_number": b["invoice_number"],
                "booking_ref": b["booking_ref"],
                "guest_name": b["guest"]["name"],
                "room_number": b["room_number"],
                "category_name": b["category_name"],
                "check_in": b["check_in"],
                "check_out": b["check_out"],
                "subtotal": b["pricing"]["subtotal"],
                "gst_rate": b["pricing"]["gst_rate"],
                "cgst": b["pricing"]["cgst"],
                "sgst": b["pricing"]["sgst"],
                "gst_total": b["pricing"]["gst_total"],
                "grand_total": b["pricing"]["grand_total"],
                "amount_paid": b.get("amount_paid", 0),
                "balance_due": b.get("balance_due", 0),
                "payment_status": b["payment_status"],
                "created_at": b["created_at"],
            }
            for b in bookings
        ],
    }


@router.post("/payments/record", status_code=201)
async def record_manual_payment(body: AdminRecordPaymentIn, staff: dict = Depends(current_admin)):
    b = await db.bookings.find_one({"_id": oid(body.booking_id)})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")

    new_paid = b.get("amount_paid", 0) + body.amount
    grand_total = b["pricing"]["grand_total"]
    new_balance = max(0, grand_total - new_paid)
    new_status = "PAID" if new_balance == 0 else "PARTIAL"

    tx_id = body.reference.strip() or f"POS-{random.randint(100000, 999999)}"
    await db.bookings.update_one(
        {"_id": b["_id"]},
        {
            "$set": {
                "amount_paid": new_paid,
                "balance_due": new_balance,
                "payment_status": new_status,
            },
            "$push": {
                "timeline": {
                    "status": "PAYMENT_RECEIVED",
                    "note": f"₹{body.amount} collected via {body.payment_method} ({tx_id}) by {staff['name']}",
                    "at": now_iso(),
                }
            },
        },
    )

    payment_doc = {
        "booking_id": body.booking_id,
        "booking_ref": b["booking_ref"],
        "guest_name": b["guest"]["name"],
        "amount": body.amount,
        "payment_method": body.payment_method,
        "transaction_id": tx_id,
        "notes": body.notes,
        "status": "SUCCESS",
        "created_at": now_iso(),
    }
    await db.payments.insert_one(payment_doc)
    await db.ledger.insert_one({
        "entry_type": "INCOME",
        "category": "Room Tariff Collection",
        "title": f"Payment for {b['booking_ref']} — Room {b['room_number']}",
        "amount": body.amount,
        "payment_mode": body.payment_method,
        "vendor_name": b["guest"]["name"],
        "invoice_ref": b["invoice_number"],
        "notes": body.notes or f"Ref: {tx_id}",
        "recorded_by": staff["name"],
        "created_at": now_iso(),
    })

    await log_audit(staff["name"], staff["role"], "PAYMENT_RECORDED", "booking", body.booking_id, f"₹{body.amount} ({body.payment_method})")
    return doc_out(payment_doc)


# ------------------------------------------------------------------
# 8. Staff Management
# ------------------------------------------------------------------
@router.get("/staff")
async def list_staff(staff: dict = Depends(current_admin)):
    members = [doc_out(s) async for s in db.staff.find().sort("created_at", 1)]
    return {"staff": members}


@router.post("/staff", status_code=201)
async def add_staff_member(body: StaffCreateIn, staff: dict = Depends(current_admin)):
    email = body.email.lower().strip()
    if await db.staff.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Staff email already exists")
    doc = {
        "name": body.name.strip(),
        "email": email,
        "phone": body.phone.strip(),
        "role": body.role,
        "department": body.department,
        "shift": body.shift,
        "salary": body.salary,
        "active": True,
        "password_hash": hash_password(body.password),
        "created_at": now_iso(),
    }
    res = await db.staff.insert_one(doc)
    created = await db.staff.find_one({"_id": res.inserted_id})
    await log_audit(staff["name"], staff["role"], "STAFF_ADDED", "staff", str(created["_id"]), f"{body.name} ({body.role})")
    return doc_out(created)


@router.delete("/staff/{staff_id}")
async def remove_staff_member(staff_id: str, staff: dict = Depends(current_admin)):
    if str(staff["_id"]) == staff_id:
        raise HTTPException(status_code=400, detail="Cannot remove your own active admin account")
    target = await db.staff.find_one({"_id": oid(staff_id)})
    if not target:
        raise HTTPException(status_code=404, detail="Staff member not found")
    await db.staff.delete_one({"_id": target["_id"]})
    await log_audit(staff["name"], staff["role"], "STAFF_REMOVED", "staff", staff_id, target["name"])
    return {"ok": True}


# ------------------------------------------------------------------
# 9. Finance Overview (Income Ledger, Expense Register, Petty Cash, Vendor Payments, Reports)
# ------------------------------------------------------------------
@router.get("/finance")
async def get_finance_overview(staff: dict = Depends(current_admin)):
    entries = [doc_out(e) async for e in db.ledger.find().sort("created_at", -1).limit(500)]
    income_ledger = [e for e in entries if e["entry_type"] == "INCOME"]
    expense_register = [e for e in entries if e["entry_type"] == "EXPENSE"]
    petty_cash = [e for e in entries if e["entry_type"] == "PETTY_CASH"]
    vendor_payments = [e for e in entries if e["entry_type"] == "VENDOR_PAYMENT"]

    total_income = sum(e["amount"] for e in income_ledger)
    total_expense = sum(e["amount"] for e in expense_register)
    total_petty = sum(e["amount"] for e in petty_cash)
    total_vendor = sum(e["amount"] for e in vendor_payments)
    total_outflow = total_expense + total_petty + total_vendor

    return {
        "summary": {
            "total_income": total_income,
            "total_expenses": total_expense,
            "total_petty_cash": total_petty,
            "total_vendor_payments": total_vendor,
            "total_outflow": total_outflow,
            "net_balance": total_income - total_outflow,
        },
        "income_ledger": income_ledger,
        "expense_register": expense_register,
        "petty_cash": petty_cash,
        "vendor_payments": vendor_payments,
        "all_entries": entries,
    }


@router.post("/finance/ledger", status_code=201)
async def create_ledger_entry(body: LedgerEntryIn, staff: dict = Depends(current_admin)):
    doc = {
        **body.model_dump(),
        "recorded_by": staff["name"],
        "created_at": now_iso(),
    }
    res = await db.ledger.insert_one(doc)
    created = await db.ledger.find_one({"_id": res.inserted_id})
    await log_audit(
        staff["name"], staff["role"], f"FINANCE_{body.entry_type}", "ledger",
        str(created["_id"]), f"{body.title}: ₹{body.amount}"
    )
    return doc_out(created)


@router.get("/reports")
async def get_hotel_reports(staff: dict = Depends(current_admin)):
    bookings = [doc_out(b) async for b in db.bookings.find().limit(1000)]
    rooms = [doc_out(r) async for r in db.rooms.find()]
    entries = [doc_out(e) async for e in db.ledger.find().limit(1000)]

    by_category: dict[str, dict] = {}
    for b in bookings:
        if b["status"] == "CANCELLED":
            continue
        cname = b["category_name"]
        slot = by_category.setdefault(cname, {"category": cname, "bookings": 0, "nights": 0, "revenue": 0})
        slot["bookings"] += 1
        slot["nights"] += b["pricing"].get("nights", 1)
        slot["revenue"] += b["pricing"].get("grand_total", 0)

    by_source: dict[str, int] = {}
    for b in bookings:
        src = b.get("booking_source", "CUSTOMER_APP")
        by_source[src] = by_source.get(src, 0) + 1

    return {
        "total_bookings": len(bookings),
        "active_bookings": sum(1 for b in bookings if b["status"] in ("PENDING", "CONFIRMED", "CHECKED_IN")),
        "completed_checkouts": sum(1 for b in bookings if b["status"] == "CHECKED_OUT"),
        "cancelled_bookings": sum(1 for b in bookings if b["status"] == "CANCELLED"),
        "total_gst_billed": sum(b["pricing"].get("gst_total", 0) for b in bookings if b["status"] != "CANCELLED"),
        "revenue_by_category": list(by_category.values()),
        "bookings_by_source": by_source,
        "room_status_breakdown": {
            "AVAILABLE": sum(1 for r in rooms if r["status"] == "AVAILABLE"),
            "OCCUPIED": sum(1 for r in rooms if r["status"] == "OCCUPIED"),
            "DIRTY": sum(1 for r in rooms if r["status"] == "DIRTY"),
            "CLEANING": sum(1 for r in rooms if r["status"] == "CLEANING"),
            "BLOCKED": sum(1 for r in rooms if r["status"] == "BLOCKED"),
        },
        "finance_totals": {
            "income": sum(e["amount"] for e in entries if e["entry_type"] == "INCOME"),
            "expenses": sum(e["amount"] for e in entries if e["entry_type"] != "INCOME"),
        },
    }


# ------------------------------------------------------------------
# 10. Notifications & Audit Logs
# ------------------------------------------------------------------
@router.get("/notifications")
async def list_admin_notifications(staff: dict = Depends(current_admin)):
    items = [
        doc_out(n)
        async for n in db.notifications.find({"recipient_type": "admin"}).sort("created_at", -1).limit(60)
    ]
    return {"notifications": items}


@router.post("/notifications/read-all")
async def mark_admin_notifications_read(staff: dict = Depends(current_admin)):
    await db.notifications.update_many({"recipient_type": "admin"}, {"$set": {"read": True}})
    return {"ok": True}


@router.get("/audit-logs")
async def list_audit_logs(staff: dict = Depends(current_admin)):
    logs = [doc_out(a) async for a in db.audit_logs.find().sort("created_at", -1).limit(100)]
    return {"audit_logs": logs}
