"""Main FastAPI entry point for The Grand Palace Hotel Management Backend (Shared by Customer Booking App & Hotel Admin App)."""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
import os
import traceback

from core import client, db, logger
from seed import ensure_seeded
from customer_routes import router as customer_router
from admin_routes import router as admin_router

app = FastAPI(
    title="The Grand Palace Hotel — Shared Live Backend API",
    version="1.0.0",
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error on %s: %s\n%s", request.url.path, exc, traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__, "path": request.url.path},
    )



@app.get("/")
async def root():
    return {
        "status": "ok",
        "service": "The Grand Palace Hotel — Shared Customer & Admin API",
        "api": "/api",
    }


@app.get("/api")
@app.get("/api/")
async def api_root():
    return {
        "status": "ok",
        "hotel": "The Grand Palace Hotel",
        "endpoints": {
            "customer": "/api/hotel, /api/room-categories, /api/availability, /api/bookings, /api/payments/verify",
            "admin": "/api/admin/dashboard, /api/admin/rooms, /api/admin/bookings, /api/admin/housekeeping, /api/admin/finance",
        },
    }


@app.on_event("startup")
async def startup():
    try:
        await db.customers.create_index("email", unique=True)
        await db.staff.create_index("email", unique=True)
        await db.rooms.create_index("room_number", unique=True)
        await db.bookings.create_index([("room_id", 1), ("check_in", 1), ("check_out", 1)])
        await ensure_seeded()
    except Exception as e:
        logger.error("Startup seed/index warning: %s", e)


@app.on_event("shutdown")
async def shutdown():
    if not os.environ.get("VERCEL"):
        client.close()


app.include_router(customer_router)
app.include_router(admin_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
