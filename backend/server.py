import logging
import os
from pathlib import Path

import pyotp
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorClient
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse

from app.auth import create_access_token, hash_password, read_token, request_ip, require_roles, verify_password
from app.asset_jobs import asset_pipeline_ready, build_asset_job
from app.chat_service import stream_design_guidance
from app.payments import create_gateway_order, payment_ready, verify_webhook
from app.schemas import AssetGenerationInput, ContentSettingsUpdate, DesignGuidanceInput, DesignInput, LoginInput, PaymentStartInput, ProfileUpdateInput, QuoteInput, RegisterInput, StaffVerifyInput, StatusUpdateInput
from app.services import build_concepts, clean_document, new_id, utc_now


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
app = FastAPI(title="Clelia & Co. Design Studio")
api_router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)


async def audit(actor_id: str, action: str, entity_type: str, entity_id: str, ip: str, metadata: dict | None = None) -> None:
    await db.audit_logs.insert_one({"id": new_id(), "actor_id": actor_id, "action": action, "entity_type": entity_type, "entity_id": entity_id, "ip": ip, "metadata": metadata or {}, "created_at": utc_now()})


DEFAULT_CONTENT = {"id": "customer_tool", "jewellery_types": [{"name": item, "visible": True} for item in ["Ring", "Pendant", "Bracelet", "Earrings", "Necklace", "Bangle"]], "example_ideas": {"Ring": ["A slim rose-gold band with a single oval ruby and tiny milgrain detailing along the edges.", "A timeless yellow-gold ring with a round diamond for our tenth anniversary.", "A simple platinum band with our initials hidden inside.", "A floral-inspired ring in white gold with a delicate sapphire centre."], "Pendant": ["A small yellow-gold pendant inspired by a lotus, with a single diamond at its heart.", "A modern rose-gold initial pendant for my daughter.", "A temple-style pendant with antique finish and ruby accents.", "A simple everyday pendant with an emerald-cut sapphire."]}, "metals": ["18K Yellow Gold", "18K Rose Gold", "18K White Gold", "Platinum", "925 Silver"], "payment_mode": "self_contained", "gold_rate_per_gram": 7420.0, "updated_at": utc_now()}


async def get_content_settings() -> dict:
    settings = await db.content_settings.find_one({"id": "customer_tool"}, {"_id": 0})
    if settings:
        return settings
    await db.content_settings.insert_one(DEFAULT_CONTENT.copy())
    return DEFAULT_CONTENT.copy()


@app.on_event("startup")
async def ensure_manager_account():
    await db.users.create_index("email", unique=True)
    accounts = [("Clelia Studio Manager", os.environ["MANAGER_EMAIL"], os.environ["MANAGER_PASSWORD"], "manager"), ("Production Coordinator", os.environ["STAFF_ONE_EMAIL"], os.environ["STAFF_PASSWORD"], "staff"), ("Atelier Coordinator", os.environ["STAFF_TWO_EMAIL"], os.environ["STAFF_PASSWORD"], "staff")]
    for name, email, password, role in accounts:
        if not await db.users.find_one({"email": email.lower()}, {"_id": 0}):
            await db.users.insert_one({"id": new_id(), "name": name, "email": email.lower(), "role": role, "password_hash": hash_password(password), "totp_secret": os.environ["MANAGER_TOTP_SECRET"] if role == "manager" else os.environ["STAFF_TOTP_SECRET"], "status": "active", "created_at": utc_now()})
    if not await db.orders.find_one({"sample_data": True}, {"_id": 0}):
        customer_id = new_id()
        await db.users.insert_one({"id": customer_id, "name": "Aarohi Shah", "email": "aarohi@cleliastudio-demo.com", "role": "customer", "password_hash": hash_password("Customer!2026Studio"), "status": "active", "created_at": utc_now()})
        for index, stage in enumerate(["New", "In Production", "QC"]):
            design_id = new_id()
            await db.designs.insert_one({"id": design_id, "customer_id": customer_id, "jewellery_type": ["Ring", "Pendant", "Bracelet"][index], "prompt": "Sample atelier commission", "specs": {"metal": "18K Yellow Gold"}, "version": 1, "status": "approved", "created_at": utc_now()})
            await db.orders.insert_one({"id": new_id(), "sample_data": True, "design_id": design_id, "customer_id": customer_id, "total": [184000, 94500, 276000][index], "currency": "INR", "payment_status": "confirmed", "production_status": stage, "due_date": ["2026-07-15", "2026-07-22", "2026-07-29"][index], "created_at": utc_now(), "timeline": [{"label": stage, "at": utc_now()}]})


@api_router.get("/health")
async def health():
    return {"status": "healthy", "service": "clelia-design-studio"}


@api_router.get("/content")
async def public_content():
    return await get_content_settings()


@api_router.get("/manager/content")
async def manager_content(token: dict = Depends(require_roles("manager"))):
    return await get_content_settings()


@api_router.put("/manager/content")
async def update_manager_content(payload: ContentSettingsUpdate, request: Request, token: dict = Depends(require_roles("manager"))):
    changes = {key: value for key, value in payload.model_dump(exclude_none=True).items()}
    if not changes:
        raise HTTPException(status_code=422, detail="Choose at least one setting to update")
    if "jewellery_types" in changes and not any(item.get("visible") for item in changes["jewellery_types"]):
        raise HTTPException(status_code=422, detail="At least one jewellery type must remain visible")
    changes["updated_at"] = utc_now()
    await db.content_settings.update_one({"id": "customer_tool"}, {"$set": changes, "$setOnInsert": {"id": "customer_tool"}}, upsert=True)
    await audit(token["sub"], "customer_content_updated", "content_settings", "customer_tool", request_ip(request), {"fields": list(changes.keys())})
    return await get_content_settings()


@api_router.post("/design-guidance/stream")
async def design_guidance(payload: DesignGuidanceInput, request: Request):
    async def event_stream():
        await db.design_guidance_messages.insert_one({"id": new_id(), "session_id": payload.session_id, "role": "customer", "jewellery_type": payload.jewellery_type, "body": payload.description, "specifications": payload.specifications, "created_at": utc_now()})
        response_parts: list[str] = []
        try:
            async for token in stream_design_guidance(payload.session_id, payload.jewellery_type, payload.description, payload.specifications):
                response_parts.append(token)
                yield f"data: {token}\n\n"
            await db.design_guidance_messages.insert_one({"id": new_id(), "session_id": payload.session_id, "role": "guide", "jewellery_type": payload.jewellery_type, "body": "".join(response_parts), "created_at": utc_now()})
            yield "event: done\ndata: complete\n\n"
        except Exception:
            logger.exception("Design guidance provider request failed")
            yield "event: error\ndata: We could not shape your idea just now. Please try again or adjust your description.\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


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


@api_router.patch("/profile")
async def update_profile(payload: ProfileUpdateInput, request: Request, token: dict = Depends(read_token)):
    if token["role"] != "customer":
        raise HTTPException(status_code=403, detail="Only customer accounts can update this profile")
    await db.users.update_one({"id": token["sub"]}, {"$set": payload.model_dump()})
    user = await db.users.find_one({"id": token["sub"]}, {"_id": 0})
    await audit(token["sub"], "customer_profile_updated", "user", token["sub"], request_ip(request))
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


@api_router.post("/designs/assets")
async def queue_design_assets(payload: AssetGenerationInput, request: Request, token: dict = Depends(read_token)):
    design = await db.designs.find_one({"id": payload.design_id, "customer_id": token["sub"]}, {"_id": 0})
    if not design:
        raise HTTPException(status_code=404, detail="Design not found")
    if not asset_pipeline_ready():
        raise HTTPException(status_code=503, detail="3D asset preparation is not configured yet. Please contact the atelier for help.")
    job = build_asset_job(payload.design_id, payload.approved_concept_url, token["sub"], new_id(), utc_now())
    await db.asset_jobs.insert_one(job.copy())
    await db.designs.update_one({"id": payload.design_id}, {"$set": {"asset_status": "queued"}})
    await audit(token["sub"], "design_asset_job_queued", "design", payload.design_id, request_ip(request), {"job_id": job["id"]})
    return {"id": job["id"], "status": job["status"]}


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


@api_router.post("/orders/{order_id}/payment")
async def start_payment(order_id: str, payload: PaymentStartInput, token: dict = Depends(read_token)):
    order = await db.orders.find_one({"id": order_id, "customer_id": token["sub"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_status") == "confirmed":
        raise HTTPException(status_code=409, detail="This order has already been paid")
    total = int(order.get("total") or 0)
    if total <= 0:
        raise HTTPException(status_code=422, detail="A Manager must approve the order total before payment")
    if not payment_ready():
        raise HTTPException(status_code=503, detail="Secure checkout is not configured yet. Please contact the atelier for help.")
    amount = total if payload.payment_option == "full" else round(total * 0.3)
    try:
        gateway_order = create_gateway_order(amount * 100, f"CC-{order_id[:20]}")
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    payment = {"id": new_id(), "order_id": order_id, "gateway": "razorpay", "gateway_ref": gateway_order["id"], "amount": amount, "status": "created", "payment_option": payload.payment_option, "created_at": utc_now()}
    await db.payments.insert_one(payment.copy())
    return {"gateway_order_id": gateway_order["id"], "amount": amount * 100, "currency": "INR", "key_id": os.environ.get("RAZORPAY_KEY_ID")}


@api_router.post("/payments/razorpay/webhook")
async def razorpay_webhook(request: Request):
    payload = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    if not payment_ready() or not verify_webhook(payload, signature):
        raise HTTPException(status_code=401, detail="Webhook signature is invalid")
    event = await request.json()
    if event.get("event") != "payment.captured":
        return {"status": "ignored"}
    gateway_order_id = event["payload"]["payment"]["entity"].get("order_id")
    payment = await db.payments.find_one({"gateway_ref": gateway_order_id}, {"_id": 0})
    if not payment:
        return {"status": "ignored"}
    if payment.get("status") == "captured":
        return {"status": "already_processed"}
    await db.payments.update_one({"id": payment["id"]}, {"$set": {"status": "captured", "webhook_payload": event, "captured_at": utc_now()}})
    await db.orders.update_one({"id": payment["order_id"]}, {"$set": {"payment_status": "confirmed"}, "$push": {"timeline": {"label": "Payment Confirmed", "at": utc_now()}}})
    await db.asset_jobs.update_many({"order_id": payment["order_id"], "status": "waiting_for_payment"}, {"$set": {"status": "queued"}})
    return {"status": "processed"}


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
app.add_middleware(CORSMiddleware, allow_credentials=False, allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","), allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"], allow_headers=["Authorization", "Content-Type"])


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()