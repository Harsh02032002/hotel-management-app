"""Shared infrastructure for Grand Palace Hotel Management Backend:
Event-loop aware MongoDB Atlas client, JWT & Role-Based Access Control (RBAC),
Audit Logging, Notification helpers, GST calculation, and Double-Booking Prevention."""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from pathlib import Path
import asyncio
import bcrypt
import jwt
import os
import logging

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ.get("MONGO_URL", "").strip().strip('"').strip()
db_name = os.environ.get("DB_NAME", "hotel_management").strip().strip('"').strip()

_clients: dict[int, AsyncIOMotorClient] = {}


def get_client() -> AsyncIOMotorClient:
    try:
        loop_id = id(asyncio.get_running_loop())
    except RuntimeError:
        loop_id = 0
    c = _clients.get(loop_id)
    if c is None:
        c = AsyncIOMotorClient(mongo_url)
        _clients[loop_id] = c
    return c


class _LoopAwareClient:
    def close(self):
        for c in list(_clients.values()):
            try:
                c.close()
            except Exception:
                pass
        _clients.clear()


class _NamespacedCollection:
    """Multiplexes logical Hotel PMS collections into an existing Atlas collection
    using the `_gp_col` discriminator so M0 500-collection limits are never exceeded."""

    def __init__(self, raw_col, col_name: str):
        self._col = raw_col
        self._name = col_name

    def _scoped(self, flt: dict | None = None) -> dict:
        if not flt:
            return {"_gp_col": self._name}
        return {**flt, "_gp_col": self._name}

    async def find_one(self, flt: dict | None = None, *args, **kwargs):
        return await self._col.find_one(self._scoped(flt), *args, **kwargs)

    def find(self, flt: dict | None = None, *args, **kwargs):
        return self._col.find(self._scoped(flt), *args, **kwargs)

    async def count_documents(self, flt: dict | None = None, *args, **kwargs) -> int:
        return await self._col.count_documents(self._scoped(flt), *args, **kwargs)

    async def insert_one(self, doc: dict, *args, **kwargs):
        doc["_gp_col"] = self._name
        return await self._col.insert_one(doc, *args, **kwargs)

    async def insert_many(self, docs: list[dict], *args, **kwargs):
        for d in docs:
            d["_gp_col"] = self._name
        return await self._col.insert_many(docs, *args, **kwargs)

    async def update_one(self, flt: dict, update: dict, *args, **kwargs):
        u = dict(update)
        u["$set"] = {**u.get("$set", {}), "_gp_col": self._name}
        return await self._col.update_one(self._scoped(flt), u, *args, **kwargs)

    async def update_many(self, flt: dict, update: dict, *args, **kwargs):
        u = dict(update)
        u["$set"] = {**u.get("$set", {}), "_gp_col": self._name}
        return await self._col.update_many(self._scoped(flt), u, *args, **kwargs)

    async def delete_one(self, flt: dict, *args, **kwargs):
        return await self._col.delete_one(self._scoped(flt), *args, **kwargs)

    async def create_index(self, *args, **kwargs):
        return None


class _LoopAwareDB:
    def __getattr__(self, name: str):
        return _NamespacedCollection(get_client()["hotel"]["zz_lite_test"], name)

    def __getitem__(self, name: str):
        return _NamespacedCollection(get_client()["hotel"]["zz_lite_test"], name)


client = _LoopAwareClient()
db = _LoopAwareDB()

JWT_SECRET = os.environ.get("JWT_SECRET", "grand-palace-hotel-jwt-secret-2026").strip().strip('"')
JWT_ALGORITHM = "HS256"
JWT_DAYS = 14

RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "").strip().strip('"')
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "").strip().strip('"')

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("hotel_pms")

bearer = HTTPBearer(auto_error=False)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def oid(id_str: str) -> ObjectId:
    if not ObjectId.is_valid(id_str):
        raise HTTPException(status_code=404, detail="Resource not found")
    return ObjectId(id_str)


def doc_out(doc: dict | None) -> dict:
    if not doc:
        return {}
    d = dict(doc)
    if "_id" in d:
        d["id"] = str(d.pop("_id"))
    d.pop("password_hash", None)
    d.pop("_gp_col", None)
    return d


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False


def make_token(sub: str, role: str, extra: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": sub, "role": role, "iat": now, "exp": now + timedelta(days=JWT_DAYS)}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def current_customer(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("role") != "customer":
            raise HTTPException(status_code=403, detail="Customer account required")
        user = await db.customers.find_one({"_id": ObjectId(payload["sub"])})
    except HTTPException:
        raise
    except Exception:
        user = None
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return user


ADMIN_ROLES = {"admin", "manager", "frontdesk", "housekeeping", "finance"}


async def current_admin(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Admin authentication required")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("role") not in ADMIN_ROLES:
            raise HTTPException(status_code=403, detail="Authorized hotel staff role required")
        staff = await db.staff.find_one({"_id": ObjectId(payload["sub"]), "active": True})
    except HTTPException:
        raise
    except Exception:
        staff = None
    if not staff:
        raise HTTPException(status_code=401, detail="Invalid or expired admin session")
    return staff


def parse_date(date_str: str) -> datetime:
    try:
        return datetime.strptime(date_str.strip()[:10], "%Y-%m-%d")
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid date format '{date_str}'. Use YYYY-MM-DD.")


def compute_nights_and_gst(price_per_night: int, check_in: str, check_out: str, rooms_count: int = 1, discount: int = 0) -> dict:
    d_in = parse_date(check_in)
    d_out = parse_date(check_out)
    nights = (d_out - d_in).days
    if nights <= 0:
        raise HTTPException(status_code=400, detail="Check-out date must be after check-in date")
    if nights > 60:
        raise HTTPException(status_code=400, detail="Maximum stay duration is 60 nights")
    subtotal = price_per_night * nights * rooms_count
    discount = max(0, min(discount, subtotal))
    taxable = subtotal - discount
    # Indian Hotel GST slab: 12% for tariff <= ₹7500/night, 18% above ₹7500/night
    gst_rate = 18 if price_per_night > 7500 else 12
    cgst = round(taxable * (gst_rate / 2) / 100)
    sgst = round(taxable * (gst_rate / 2) / 100)
    gst_total = cgst + sgst
    grand_total = taxable + gst_total
    return {
        "nights": nights,
        "price_per_night": price_per_night,
        "rooms_count": rooms_count,
        "subtotal": subtotal,
        "discount": discount,
        "taxable_amount": taxable,
        "gst_rate": gst_rate,
        "cgst": cgst,
        "sgst": sgst,
        "gst_total": gst_total,
        "grand_total": grand_total,
    }


ACTIVE_BOOKING_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN"]


async def find_conflicting_room_ids(check_in: str, check_out: str, exclude_booking_id: str | None = None) -> set[str]:
    """Returns set of room_ids that have overlapping active bookings in [check_in, check_out)."""
    parse_date(check_in)
    parse_date(check_out)
    query: dict = {
        "status": {"$in": ACTIVE_BOOKING_STATUSES},
        "check_in": {"$lt": check_out[:10]},
        "check_out": {"$gt": check_in[:10]},
    }
    if exclude_booking_id and ObjectId.is_valid(exclude_booking_id):
        query["_id"] = {"$ne": ObjectId(exclude_booking_id)}
    cursor = db.bookings.find(query, {"room_id": 1})
    busy_ids: set[str] = set()
    async for b in cursor:
        if b.get("room_id"):
            busy_ids.add(str(b["room_id"]))
    return busy_ids


async def log_audit(actor_name: str, actor_role: str, action: str, entity: str, entity_id: str = "", details: str = ""):
    await db.audit_logs.insert_one({
        "actor_name": actor_name,
        "actor_role": actor_role,
        "action": action,
        "entity": entity,
        "entity_id": entity_id,
        "details": details,
        "created_at": now_iso(),
    })


async def create_notification(recipient_type: str, recipient_id: str, title: str, message: str, booking_id: str = ""):
    """recipient_type: 'customer' | 'admin'"""
    await db.notifications.insert_one({
        "recipient_type": recipient_type,
        "recipient_id": recipient_id,
        "title": title,
        "message": message,
        "booking_id": booking_id,
        "read": False,
        "created_at": now_iso(),
    })
