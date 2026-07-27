import os
from pathlib import Path

import pyotp
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorClient
from starlette.middleware.cors import CORSMiddleware

from app.auth import create_access_token, hash_password, read_token, request_ip, require_roles, verify_password
from app.schemas import DesignInput, LoginInput, QuoteInput, RegisterInput, StaffVerifyInput, StatusUpdateInput
from app.services import build_concepts, clean_document, new_id, utc_now


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
app = FastAPI(title="Clelia & Co. Design Studio")
api_router = APIRouter(prefix="/api")


async def audit(actor_id: str, action: str, entity_type: str, entity_id: str, ip: str, metadata: dict | None = None) -> None:
    await db.audit_logs.insert_one({"id": new_id(), "actor_id": actor_id, "action": action, "entity_type": entity_type, "entity_id": entity_id, "ip": ip, "metadata": metadata or {}, "created_at": utc_now()})


@api_router.get("/health")
async def health():
    return {"status": "healthy", "service": "clelia-design-studio"}


@api_router.post("/auth/register")
async def register(payload: RegisterInput, request: Request):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}, {"_id": 0}):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = {"id": new_id(), "name": payload.name, "email": email, "role": "customer", "password_hash": hash_password(payload.password), "status": "active", "created_at": utc_now()}
    await db.users.insert_one(user.copy())
    await audit(user["id"], "customer_registered", "user", user["id"], request_ip(request))
    return {"user": clean_document(user), "token": create_access_token(user)}


@api_router.post("/auth/login")
async def customer_login(payload: LoginInput, request: Request):
    user = await db.users.find_one({"email": payload.email.lower(), "role": "customer"}, {"_id": 0})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email or password is incorrect")
    await audit(user["id"], "customer_login", "user", user["id"], request_ip(request))
    return {"user": clean_document(user), "token": create_access_token(user)}


@api_router.post("/auth/staff/login")
async def staff_login(payload: StaffVerifyInput, request: Request):
    user = await db.users.find_one({"email": payload.email.lower(), "role": {"$in": ["staff", "manager"]}}, {"_id": 0})
    is_valid = bool(user and verify_password(payload.password, user["password_hash"]) and user.get("totp_secret") and pyotp.TOTP(user["totp_secret"]).verify(payload.otp, valid_window=1))
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Your staff credentials or verification code are incorrect")
    await audit(user["id"], "staff_login", "user", user["id"], request_ip(request))
    return {"user": clean_document(user), "token": create_access_token(user)}


@api_router.get("/auth/me")
async def me(token: dict = Depends(read_token)):
    user = await db.users.find_one({"id": token["sub"]}, {"_id": 0})
    return clean_document(user)


@api_router.post("/designs")
async def create_design(payload: DesignInput, request: Request, token: dict = Depends(read_token)):
    if token["role"] != "customer":
        raise HTTPException(status_code=403, detail="Only customer accounts can create designs")
    design_id = new_id()
    design = {"id": design_id, "customer_id": token["sub"], "jewellery_type": payload.jewellery_type, "prompt": payload.prompt, "model": payload.model, "specs": payload.specs, "references": payload.references[:5], "version": 1, "status": "concepts_ready", "concepts": build_concepts(design_id), "preview_glb_url": None, "created_at": utc_now()}
    await db.designs.insert_one(design.copy())
    await audit(token["sub"], "design_created", "design", design_id, request_ip(request), {"model": payload.model})
    return clean_document(design)


@api_router.get("/designs")
async def list_designs(token: dict = Depends(read_token)):
    query = {} if token["role"] in ["staff", "manager"] else {"customer_id": token["sub"]}
    designs = await db.designs.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return designs


@api_router.post("/quotes")
async def request_quote(payload: QuoteInput, request: Request, token: dict = Depends(read_token)):
    design = await db.designs.find_one({"id": payload.design_id, "customer_id": token["sub"]}, {"_id": 0})
    if not design:
        raise HTTPException(status_code=404, detail="Design not found")
    order = {"id": new_id(), "design_id": design["id"], "customer_id": token["sub"], "total": None, "currency": "INR", "payment_status": "quote_requested", "production_status": "New", "delivery_city": payload.delivery_city, "budget": payload.budget, "note": payload.note, "created_at": utc_now(), "timeline": [{"label": "Quote requested", "at": utc_now()}]}
    await db.orders.insert_one(order.copy())
    await audit(token["sub"], "quote_requested", "order", order["id"], request_ip(request))
    return clean_document(order)


@api_router.get("/orders")
async def list_orders(token: dict = Depends(read_token)):
    query = {} if token["role"] in ["staff", "manager"] else {"customer_id": token["sub"]}
    return await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)


@api_router.patch("/staff/orders/{order_id}")
async def update_order(order_id: str, payload: StatusUpdateInput, request: Request, token: dict = Depends(require_roles("staff", "manager"))):
    result = await db.orders.update_one({"id": order_id}, {"$set": {"production_status": payload.production_status}, "$push": {"timeline": {"label": payload.production_status, "at": utc_now()}}})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Order not found")
    await audit(token["sub"], "production_status_updated", "order", order_id, request_ip(request), {"status": payload.production_status})
    return {"ok": True}


@api_router.get("/staff/orders")
async def staff_orders(token: dict = Depends(require_roles("staff", "manager"))):
    return await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)


@api_router.get("/staff/orders/{order_id}/print-file")
async def print_file(order_id: str, request: Request, token: dict = Depends(require_roles("staff", "manager"))):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order or order.get("payment_status") != "confirmed":
        raise HTTPException(status_code=404, detail="Manufacturing file is not available")
    await audit(token["sub"], "print_file_link_requested", "order", order_id, request_ip(request))
    raise HTTPException(status_code=503, detail="Secure manufacturing storage is not configured yet")


@api_router.get("/manager/audit-logs")
async def audit_logs(token: dict = Depends(require_roles("manager"))):
    return await db.audit_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=False, allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","), allow_methods=["GET", "POST", "PATCH"], allow_headers=["Authorization", "Content-Type"])


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()