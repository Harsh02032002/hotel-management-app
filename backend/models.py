"""Pydantic request/response models for the Hotel Customer & Admin applications."""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List


# ---------------- Customer Auth ----------------
class CustomerRegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    phone: str = Field(min_length=8, max_length=20)
    password: str = Field(min_length=6, max_length=128)


class CustomerLoginIn(BaseModel):
    email: EmailStr
    password: str


class OtpRequestIn(BaseModel):
    phone_or_email: str


class OtpVerifyIn(BaseModel):
    phone_or_email: str
    otp: str = Field(min_length=4, max_length=8)


class CustomerProfileUpdateIn(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    id_type: Optional[str] = None
    id_number: Optional[str] = None


# ---------------- Admin Auth ----------------
class AdminLoginIn(BaseModel):
    email: EmailStr
    password: str


# ---------------- Room Categories & Rooms ----------------
class RoomCategoryIn(BaseModel):
    name: str
    slug: str
    description: str
    base_price: int = Field(gt=0)  # INR per night
    max_guests: int = Field(ge=1, le=10, default=2)
    bed_type: str = "King Bed"
    size_sqft: int = 380
    amenities: List[str] = []
    images: List[str] = []


class RoomCategoryPriceUpdateIn(BaseModel):
    base_price: int = Field(gt=0)
    weekend_price: Optional[int] = None


class RoomIn(BaseModel):
    room_number: str
    floor: int = 1
    category_id: str
    price_override: Optional[int] = None
    status: str = "AVAILABLE"  # AVAILABLE | OCCUPIED | DIRTY | CLEANING | BLOCKED
    notes: str = ""


class RoomStatusUpdateIn(BaseModel):
    status: str  # AVAILABLE | OCCUPIED | DIRTY | CLEANING | BLOCKED
    notes: Optional[str] = None
    price_override: Optional[int] = None


# ---------------- Bookings ----------------
class BookingCreateIn(BaseModel):
    category_id: str
    room_id: Optional[str] = None
    check_in: str   # YYYY-MM-DD
    check_out: str  # YYYY-MM-DD
    guests: int = Field(ge=1, le=10, default=2)
    special_requests: str = ""
    payment_method: str = "ONLINE"  # ONLINE | PAY_AT_HOTEL


class CancelBookingIn(BaseModel):
    reason: str = "Change of travel plans"


class WalkInBookingIn(BaseModel):
    guest_name: str
    guest_email: str = ""
    guest_phone: str
    category_id: str
    room_id: Optional[str] = None
    check_in: str
    check_out: str
    guests: int = 2
    booking_type: str = "WALK_IN"  # WALK_IN | ADVANCE
    discount: int = 0
    advance_paid: int = 0
    payment_method: str = "CASH"  # CASH | UPI | CARD | ONLINE
    special_requests: str = ""
    auto_check_in: bool = False
    id_type: str = "Aadhaar Card"
    id_number: str = ""


class RejectBookingIn(BaseModel):
    reason: str = "Selected room category unavailable due to maintenance"


class CheckInKycIn(BaseModel):
    room_id: Optional[str] = None
    id_type: str = "Aadhaar Card"  # Aadhaar Card | Passport | Driving License | Voter ID
    id_number: str
    document_url: str = ""
    nationality: str = "Indian"
    address: str = ""
    additional_guests: List[str] = []
    deposit_collected: int = 0
    payment_mode: str = "UPI"


class RoomChangeIn(BaseModel):
    new_room_id: str
    reason: str = "Guest requested room upgrade / change"


class StayExtensionIn(BaseModel):
    new_check_out: str  # YYYY-MM-DD
    extra_discount: int = 0


class CheckoutIn(BaseModel):
    collect_balance: bool = True
    payment_method: str = "UPI"
    extra_charges: int = 0
    extra_charges_note: str = ""
    notes: str = ""


# ---------------- Payments ----------------
class PaymentVerifyIn(BaseModel):
    booking_id: str
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None
    payment_mode: str = "RAZORPAY"


class AdminRecordPaymentIn(BaseModel):
    booking_id: str
    amount: int = Field(gt=0)
    payment_method: str = "UPI"  # CASH | UPI | CARD | BANK_TRANSFER
    reference: str = ""
    notes: str = ""


# ---------------- Housekeeping ----------------
class HousekeepingUpdateIn(BaseModel):
    status: str  # DIRTY | CLEANING | AVAILABLE
    assigned_to: str = ""
    notes: str = ""


# ---------------- Staff & Finance ----------------
class StaffCreateIn(BaseModel):
    name: str
    email: EmailStr
    phone: str
    role: str = "frontdesk"  # admin | manager | frontdesk | housekeeping | finance
    department: str = "Front Office"
    shift: str = "Morning (7 AM - 3 PM)"
    salary: int = 25000
    password: str = "staff123"


class LedgerEntryIn(BaseModel):
    entry_type: str  # INCOME | EXPENSE | PETTY_CASH | VENDOR_PAYMENT
    category: str
    title: str
    amount: int = Field(gt=0)
    payment_mode: str = "UPI"
    vendor_name: str = ""
    invoice_ref: str = ""
    notes: str = ""
