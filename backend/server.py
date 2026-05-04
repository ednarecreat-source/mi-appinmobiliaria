from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Depends, Request, Response, Cookie
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import base64
import json
import re
import io
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta

import httpx
import pandas as pd
import bcrypt
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

try:
    import fitz
except Exception:
    fitz = None

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '').strip()

app = FastAPI(title="RCT Gestión Inmobiliaria")
api_router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)


def now_utc():
    return datetime.now(timezone.utc)


def now_iso():
    return now_utc().isoformat()


# ============ AUTH MODELS ============
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = ""
    auth_provider: Optional[str] = "email"  # email | google
    created_at: str = Field(default_factory=now_iso)


class RegisterIn(BaseModel):
    name: str
    email: str
    password: str


class LoginIn(BaseModel):
    email: str
    password: str


class GoogleAuthIn(BaseModel):
    credential: str  # Google ID token (JWT) from GIS


class Workspace(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    owner_id: str
    member_ids: List[str] = []  # user_ids that can access
    display_currency: str = "EUR"
    exchange_rates: Dict[str, float] = {}  # {"USD": 0.92, "GBP": 1.18}
    created_at: str = Field(default_factory=now_iso)


class WorkspaceIn(BaseModel):
    name: str
    display_currency: str = "EUR"
    exchange_rates: Dict[str, float] = {}


# ============ DOMAIN MODELS ============
class Property(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    name: str
    address: str
    category: str = "residential"
    currency: str = "EUR"
    description: Optional[str] = ""
    image_url: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class PropertyIn(BaseModel):
    name: str
    address: str
    category: str = "residential"
    currency: str = "EUR"
    description: Optional[str] = ""
    image_url: Optional[str] = ""


class Unit(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    property_id: str
    name: str
    unit_type: str
    rental_mode: str = "long_term"
    rent_amount: float = 0.0
    daily_rate: float = 0.0
    weekly_rate: float = 0.0
    monthly_rate: float = 0.0
    status: str = "vacant"
    description: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class UnitIn(BaseModel):
    property_id: str
    name: str
    unit_type: str
    rental_mode: str = "long_term"
    rent_amount: float = 0.0
    daily_rate: float = 0.0
    weekly_rate: float = 0.0
    monthly_rate: float = 0.0
    status: str = "vacant"
    description: Optional[str] = ""


class Tenant(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    name: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    unit_id: Optional[str] = ""
    property_id: Optional[str] = ""
    split_percentage: float = 100.0
    monthly_rent: float = 0.0
    start_date: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class TenantIn(BaseModel):
    name: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    unit_id: Optional[str] = ""
    property_id: Optional[str] = ""
    split_percentage: float = 100.0
    monthly_rent: float = 0.0
    start_date: Optional[str] = ""


class InvoiceSplit(BaseModel):
    tenant_id: str
    tenant_name: str
    percentage: float
    amount: float


class Invoice(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    vendor: str = ""
    invoice_date: str = ""
    concept: str = ""
    gross_amount: float = 0.0
    iva: float = 0.0
    iva_rate: float = 21.0
    retenciones: float = 0.0
    retenciones_rate: float = 0.0
    net_amount: float = 0.0
    currency: str = "EUR"
    property_id: Optional[str] = ""
    splits: List[InvoiceSplit] = []
    image_base64: Optional[str] = ""
    raw_ai_response: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class Reservation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    unit_id: str
    guest_name: str
    guest_contact: Optional[str] = ""
    check_in: str
    check_out: str
    rate_type: str = "daily"
    nights: int = 1
    total_amount: float = 0.0
    status: str = "confirmed"
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class ReservationIn(BaseModel):
    unit_id: str
    guest_name: str
    guest_contact: Optional[str] = ""
    check_in: str
    check_out: str
    rate_type: str = "daily"
    nights: int = 1
    total_amount: float = 0.0
    status: str = "confirmed"
    notes: Optional[str] = ""


class FixedExpense(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    property_id: str
    name: str
    category: str = "other"
    amount: float = 0.0
    frequency: str = "monthly"
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class FixedExpenseIn(BaseModel):
    property_id: str
    name: str
    category: str = "other"
    amount: float = 0.0
    frequency: str = "monthly"
    notes: Optional[str] = ""


class BankTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    statement_id: Optional[str] = ""
    date: str
    description: str
    amount: float
    direction: str = "in"  # in | out
    category: str = "other"  # rent | invoice | mortgage | utility | other
    matched_property_id: Optional[str] = ""
    matched_tenant_id: Optional[str] = ""
    matched_invoice_id: Optional[str] = ""
    reconciled: bool = False
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class BankTransactionIn(BaseModel):
    date: str
    description: str
    amount: float
    direction: str = "in"
    category: str = "other"
    matched_property_id: Optional[str] = ""
    matched_tenant_id: Optional[str] = ""
    matched_invoice_id: Optional[str] = ""
    reconciled: bool = False
    notes: Optional[str] = ""


class MonthlySnapshot(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workspace_id: str
    year_month: str  # YYYY-MM
    stats: Dict = {}
    closed_at: str = Field(default_factory=now_iso)


# ============ AUTH HELPERS ============
async def get_current_user_optional(
    request: Request,
    session_token: Optional[str] = Cookie(None),
) -> Optional[User]:
    token = session_token
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        return None
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        return None
    expires_at = sess.get("expires_at")
    if isinstance(expires_at, str):
        try:
            expires_at = datetime.fromisoformat(expires_at)
        except Exception:
            return None
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < now_utc():
        return None
    user_doc = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not user_doc:
        return None
    return User(**user_doc)


async def get_current_user(
    request: Request,
    session_token: Optional[str] = Cookie(None),
) -> User:
    user = await get_current_user_optional(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="No autenticado")
    return user


async def ensure_default_workspace(user: User) -> Workspace:
    """Get user's first accessible workspace (creating one if needed)."""
    ws = await db.workspaces.find_one(
        {"$or": [{"owner_id": user.user_id}, {"member_ids": user.user_id}]},
        {"_id": 0},
    )
    if ws:
        return Workspace(**ws)
    new_ws = Workspace(name="Mi Cartera", owner_id=user.user_id, member_ids=[user.user_id])
    await db.workspaces.insert_one(new_ws.model_dump())
    return new_ws


async def get_workspace(
    request: Request,
    user: User = Depends(get_current_user),
) -> Workspace:
    """Resolve workspace from header X-Workspace-Id, query, or default."""
    ws_id = request.headers.get("X-Workspace-Id") or request.query_params.get("workspace_id")
    if ws_id:
        ws = await db.workspaces.find_one(
            {"id": ws_id, "$or": [{"owner_id": user.user_id}, {"member_ids": user.user_id}]},
            {"_id": 0},
        )
        if not ws:
            raise HTTPException(403, "Sin acceso a este workspace")
        return Workspace(**ws)
    return await ensure_default_workspace(user)


# ============ AUTH ENDPOINTS ============
def _hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(pw: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), h.encode("utf-8"))
    except Exception:
        return False


async def _create_session(user_id: str, response: Response) -> str:
    token = f"sess_{uuid.uuid4().hex}{uuid.uuid4().hex}"
    expires = (now_utc() + timedelta(days=7)).isoformat()
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": token,
        "expires_at": expires, "created_at": now_iso(),
    })
    response.set_cookie(
        key="session_token", value=token, max_age=7 * 24 * 3600,
        httponly=True, secure=True, samesite="none", path="/",
    )
    return token


def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


@api_router.get("/auth/config")
async def auth_config():
    return {"google_enabled": bool(GOOGLE_CLIENT_ID), "google_client_id": GOOGLE_CLIENT_ID}


@api_router.post("/auth/register")
async def auth_register(payload: RegisterIn, response: Response):
    email = _normalize_email(payload.email)
    if not email or "@" not in email:
        raise HTTPException(400, "Email inválido")
    if len(payload.password) < 6:
        raise HTTPException(400, "La contraseña debe tener al menos 6 caracteres")
    if not payload.name.strip():
        raise HTTPException(400, "Nombre requerido")
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(409, "Ya existe una cuenta con ese email")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    await db.users.insert_one({
        "user_id": user_id, "email": email, "name": payload.name.strip(),
        "picture": "", "password_hash": _hash_password(payload.password),
        "auth_provider": "email", "created_at": now_iso(),
    })
    user_obj = User(user_id=user_id, email=email, name=payload.name.strip(), picture="", auth_provider="email")
    await ensure_default_workspace(user_obj)
    await _create_session(user_id, response)
    return {"user_id": user_id, "email": email, "name": payload.name.strip(), "picture": ""}


@api_router.post("/auth/login")
async def auth_login(payload: LoginIn, response: Response):
    email = _normalize_email(payload.email)
    user_doc = await db.users.find_one({"email": email}, {"_id": 0})
    if not user_doc or not user_doc.get("password_hash"):
        raise HTTPException(401, "Email o contraseña incorrectos")
    if not _verify_password(payload.password, user_doc["password_hash"]):
        raise HTTPException(401, "Email o contraseña incorrectos")
    user_obj = User(
        user_id=user_doc["user_id"], email=user_doc["email"], name=user_doc.get("name", ""),
        picture=user_doc.get("picture", ""), auth_provider=user_doc.get("auth_provider", "email"),
    )
    await ensure_default_workspace(user_obj)
    await _create_session(user_doc["user_id"], response)
    return {"user_id": user_doc["user_id"], "email": user_doc["email"], "name": user_doc.get("name", ""), "picture": user_doc.get("picture", "")}


@api_router.post("/auth/google")
async def auth_google(payload: GoogleAuthIn, response: Response):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(500, "GOOGLE_CLIENT_ID no configurado en el servidor")
    try:
        info = google_id_token.verify_oauth2_token(
            payload.credential, google_requests.Request(), GOOGLE_CLIENT_ID,
        )
    except Exception as e:
        raise HTTPException(401, f"Token de Google inválido: {e}")
    email = _normalize_email(info.get("email", ""))
    if not email or not info.get("email_verified", False):
        raise HTTPException(401, "Email de Google no verificado")
    name = info.get("name") or email.split("@")[0]
    picture = info.get("picture", "")
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture, "auth_provider": existing.get("auth_provider") or "google"}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": email, "name": name, "picture": picture,
            "auth_provider": "google", "created_at": now_iso(),
        })
    user_obj = User(user_id=user_id, email=email, name=name, picture=picture, auth_provider="google")
    await ensure_default_workspace(user_obj)
    await _create_session(user_id, response)
    return {"user_id": user_id, "email": email, "name": name, "picture": picture}


@api_router.get("/auth/me")
async def auth_me(user: User = Depends(get_current_user)):
    return user.model_dump()


@api_router.post("/auth/logout")
async def auth_logout(request: Request, response: Response, session_token: Optional[str] = Cookie(None)):
    token = session_token
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ============ WORKSPACES ============
@api_router.get("/workspaces", response_model=List[Workspace])
async def list_workspaces(user: User = Depends(get_current_user)):
    rows = await db.workspaces.find(
        {"$or": [{"owner_id": user.user_id}, {"member_ids": user.user_id}]},
        {"_id": 0},
    ).to_list(100)
    if not rows:
        await ensure_default_workspace(user)
        rows = await db.workspaces.find(
            {"$or": [{"owner_id": user.user_id}, {"member_ids": user.user_id}]},
            {"_id": 0},
        ).to_list(100)
    return rows


@api_router.post("/workspaces", response_model=Workspace)
async def create_workspace(payload: WorkspaceIn, user: User = Depends(get_current_user)):
    obj = Workspace(name=payload.name, owner_id=user.user_id, member_ids=[user.user_id],
                    display_currency=payload.display_currency, exchange_rates=payload.exchange_rates)
    await db.workspaces.insert_one(obj.model_dump())
    return obj


@api_router.put("/workspaces/{wid}", response_model=Workspace)
async def update_workspace(wid: str, payload: WorkspaceIn, user: User = Depends(get_current_user)):
    existing = await db.workspaces.find_one({"id": wid, "owner_id": user.user_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Workspace no encontrado o sin permisos")
    upd = {"name": payload.name, "display_currency": payload.display_currency, "exchange_rates": payload.exchange_rates}
    await db.workspaces.update_one({"id": wid}, {"$set": upd})
    existing.update(upd)
    return Workspace(**existing)


@api_router.post("/workspaces/{wid}/invite")
async def invite_member(wid: str, payload: dict, user: User = Depends(get_current_user)):
    email = (payload.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(400, "Email requerido")
    ws = await db.workspaces.find_one({"id": wid, "owner_id": user.user_id}, {"_id": 0})
    if not ws:
        raise HTTPException(404, "Workspace no encontrado")
    invitee = await db.users.find_one({"email": email}, {"_id": 0})
    if not invitee:
        raise HTTPException(404, "El usuario debe registrarse primero (login con Google)")
    member_ids = list(set([*(ws.get("member_ids") or []), invitee["user_id"]]))
    await db.workspaces.update_one({"id": wid}, {"$set": {"member_ids": member_ids}})
    return {"ok": True, "added": invitee["user_id"]}


@api_router.delete("/workspaces/{wid}/members/{uid}")
async def remove_member(wid: str, uid: str, user: User = Depends(get_current_user)):
    ws = await db.workspaces.find_one({"id": wid, "owner_id": user.user_id}, {"_id": 0})
    if not ws:
        raise HTTPException(404, "Workspace no encontrado")
    member_ids = [m for m in (ws.get("member_ids") or []) if m != uid and m != ws["owner_id"]]
    member_ids.append(ws["owner_id"])
    await db.workspaces.update_one({"id": wid}, {"$set": {"member_ids": list(set(member_ids))}})
    return {"ok": True}


# ============ Currency conversion helper ============
def to_display(amount: float, currency: str, ws: Workspace) -> float:
    if currency == ws.display_currency:
        return amount
    rate = ws.exchange_rates.get(currency)
    if rate:
        # exchange_rates entry: 1 unit of `currency` -> X display_currency
        return amount * rate
    return amount  # if no rate, return as-is


# ============ PROPERTIES ============
@api_router.get("/properties", response_model=List[Property])
async def list_properties(ws: Workspace = Depends(get_workspace)):
    return await db.properties.find({"workspace_id": ws.id}, {"_id": 0}).to_list(1000)


@api_router.post("/properties", response_model=Property)
async def create_property(payload: PropertyIn, ws: Workspace = Depends(get_workspace)):
    obj = Property(workspace_id=ws.id, **payload.model_dump())
    await db.properties.insert_one(obj.model_dump())
    return obj


@api_router.put("/properties/{prop_id}", response_model=Property)
async def update_property(prop_id: str, payload: PropertyIn, ws: Workspace = Depends(get_workspace)):
    existing = await db.properties.find_one({"id": prop_id, "workspace_id": ws.id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Inmueble no encontrado")
    upd = payload.model_dump()
    await db.properties.update_one({"id": prop_id}, {"$set": upd})
    existing.update(upd)
    return Property(**existing)


@api_router.delete("/properties/{prop_id}")
async def delete_property(prop_id: str, ws: Workspace = Depends(get_workspace)):
    await db.properties.delete_one({"id": prop_id, "workspace_id": ws.id})
    await db.units.delete_many({"property_id": prop_id, "workspace_id": ws.id})
    await db.tenants.delete_many({"property_id": prop_id, "workspace_id": ws.id})
    await db.fixed_expenses.delete_many({"property_id": prop_id, "workspace_id": ws.id})
    return {"ok": True}


# ============ UNITS ============
@api_router.get("/units", response_model=List[Unit])
async def list_units(property_id: Optional[str] = None, ws: Workspace = Depends(get_workspace)):
    q = {"workspace_id": ws.id}
    if property_id:
        q["property_id"] = property_id
    return await db.units.find(q, {"_id": 0}).to_list(1000)


@api_router.post("/units", response_model=Unit)
async def create_unit(payload: UnitIn, ws: Workspace = Depends(get_workspace)):
    obj = Unit(workspace_id=ws.id, **payload.model_dump())
    await db.units.insert_one(obj.model_dump())
    return obj


@api_router.put("/units/{unit_id}", response_model=Unit)
async def update_unit(unit_id: str, payload: UnitIn, ws: Workspace = Depends(get_workspace)):
    existing = await db.units.find_one({"id": unit_id, "workspace_id": ws.id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Unidad no encontrada")
    upd = payload.model_dump()
    await db.units.update_one({"id": unit_id}, {"$set": upd})
    existing.update(upd)
    return Unit(**existing)


@api_router.delete("/units/{unit_id}")
async def delete_unit(unit_id: str, ws: Workspace = Depends(get_workspace)):
    await db.units.delete_one({"id": unit_id, "workspace_id": ws.id})
    return {"ok": True}


# ============ TENANTS ============
@api_router.get("/tenants", response_model=List[Tenant])
async def list_tenants(property_id: Optional[str] = None, ws: Workspace = Depends(get_workspace)):
    q = {"workspace_id": ws.id}
    if property_id:
        q["property_id"] = property_id
    return await db.tenants.find(q, {"_id": 0}).to_list(1000)


@api_router.get("/tenants/percentage-summary")
async def tenants_percentage_summary(ws: Workspace = Depends(get_workspace)):
    summary: dict = {}
    async for t in db.tenants.find({"workspace_id": ws.id}, {"_id": 0, "property_id": 1, "split_percentage": 1}):
        pid = t.get("property_id") or ""
        if not pid:
            continue
        summary[pid] = summary.get(pid, 0.0) + float(t.get("split_percentage", 0))
    return summary


@api_router.post("/tenants", response_model=Tenant)
async def create_tenant(payload: TenantIn, ws: Workspace = Depends(get_workspace)):
    obj = Tenant(workspace_id=ws.id, **payload.model_dump())
    await db.tenants.insert_one(obj.model_dump())
    return obj


@api_router.put("/tenants/{tenant_id}", response_model=Tenant)
async def update_tenant(tenant_id: str, payload: TenantIn, ws: Workspace = Depends(get_workspace)):
    existing = await db.tenants.find_one({"id": tenant_id, "workspace_id": ws.id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Inquilino no encontrado")
    upd = payload.model_dump()
    await db.tenants.update_one({"id": tenant_id}, {"$set": upd})
    existing.update(upd)
    return Tenant(**existing)


@api_router.delete("/tenants/{tenant_id}")
async def delete_tenant(tenant_id: str, ws: Workspace = Depends(get_workspace)):
    await db.tenants.delete_one({"id": tenant_id, "workspace_id": ws.id})
    return {"ok": True}


# ============ INVOICE AI ============
def _parse_llm_json(text: str) -> dict:
    try:
        return json.loads(text)
    except Exception:
        pass
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            pass
    return {}


@api_router.post("/invoices/analyze")
async def analyze_invoice(
    file: UploadFile = File(...),
    property_id: Optional[str] = Form(""),
    ws: Workspace = Depends(get_workspace),
):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "Falta EMERGENT_LLM_KEY")

    content = await file.read()
    if not content:
        raise HTTPException(400, "Archivo vacío")

    mime = (file.content_type or "").lower()
    filename = (file.filename or "").lower()
    is_pdf = mime == "application/pdf" or filename.endswith(".pdf") or content[:5] == b"%PDF-"

    if is_pdf:
        if fitz is None:
            raise HTTPException(500, "Soporte PDF no disponible")
        try:
            doc = fitz.open(stream=content, filetype="pdf")
            if doc.page_count == 0:
                raise HTTPException(400, "PDF vacío")
            page = doc.load_page(0)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
            content = pix.tobytes("jpeg")
            doc.close()
            mime = "image/jpeg"
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(400, f"No se pudo leer el PDF: {e}")
    elif mime not in ("image/jpeg", "image/png", "image/webp", "image/jpg"):
        mime = "image/jpeg"

    b64 = base64.b64encode(content).decode("utf-8")

    system_prompt = (
        "Eres un asistente experto en contabilidad y facturas españolas. "
        "Analiza la imagen de la factura/recibo y devuelve EXCLUSIVAMENTE un JSON con esta estructura:\n"
        "{\n"
        '  "vendor": "nombre del emisor",\n'
        '  "invoice_date": "YYYY-MM-DD",\n'
        '  "concept": "descripción",\n'
        '  "gross_amount": base_imponible_numero,\n'
        '  "iva_rate": porcentaje_iva_numero,\n'
        '  "iva": importe_iva_numero,\n'
        '  "retenciones_rate": porcentaje_retencion_numero,\n'
        '  "retenciones": importe_retencion_numero,\n'
        '  "net_amount": total_a_pagar_numero,\n'
        '  "currency": "EUR|USD|GBP|MXN|ARS|COP"\n'
        "}\n"
        "Si un campo no aparece, usa 0/cadena vacía. Default currency EUR."
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"invoice-{uuid.uuid4()}",
        system_message=system_prompt,
    ).with_model("openai", "gpt-4o")

    img = ImageContent(image_base64=b64)
    msg = UserMessage(text="Extrae los datos de esta factura.", file_contents=[img])

    try:
        response_text = await chat.send_message(msg)
    except Exception as e:
        logging.exception("Error LLM")
        raise HTTPException(502, f"Error al analizar con IA: {e}")

    parsed = _parse_llm_json(response_text if isinstance(response_text, str) else str(response_text))

    def _n(v, default=0.0):
        try:
            return float(v)
        except Exception:
            return default

    gross = _n(parsed.get("gross_amount"))
    iva = _n(parsed.get("iva"))
    iva_rate = _n(parsed.get("iva_rate"), 21.0)
    ret = _n(parsed.get("retenciones"))
    ret_rate = _n(parsed.get("retenciones_rate"))
    net = _n(parsed.get("net_amount"))
    if net == 0 and gross:
        net = round(gross + iva - ret, 2)

    cur = (parsed.get("currency") or "EUR").upper()
    if cur not in ("EUR", "USD", "GBP", "MXN", "ARS", "COP"):
        cur = "EUR"

    tenant_query = {"workspace_id": ws.id}
    if property_id:
        tenant_query["property_id"] = property_id
    tenants = await db.tenants.find(tenant_query, {"_id": 0}).to_list(1000)
    splits = []
    for t in tenants:
        pct = float(t.get("split_percentage", 0))
        splits.append(InvoiceSplit(
            tenant_id=t["id"], tenant_name=t["name"], percentage=pct,
            amount=round(net * pct / 100.0, 2),
        ))

    invoice = Invoice(
        workspace_id=ws.id,
        vendor=parsed.get("vendor", "") or "",
        invoice_date=parsed.get("invoice_date", "") or "",
        concept=parsed.get("concept", "") or "",
        gross_amount=gross, iva=iva, iva_rate=iva_rate,
        retenciones=ret, retenciones_rate=ret_rate,
        net_amount=net, currency=cur,
        property_id=property_id or "",
        splits=splits,
        image_base64=b64[:200000],
        raw_ai_response=response_text if isinstance(response_text, str) else str(response_text),
    )
    await db.invoices.insert_one(invoice.model_dump())
    return invoice


@api_router.get("/invoices", response_model=List[Invoice])
async def list_invoices(ws: Workspace = Depends(get_workspace)):
    return await db.invoices.find({"workspace_id": ws.id}, {"_id": 0, "image_base64": 0}).to_list(1000)


@api_router.get("/invoices/{invoice_id}", response_model=Invoice)
async def get_invoice(invoice_id: str, ws: Workspace = Depends(get_workspace)):
    row = await db.invoices.find_one({"id": invoice_id, "workspace_id": ws.id}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Factura no encontrada")
    return row


@api_router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, ws: Workspace = Depends(get_workspace)):
    await db.invoices.delete_one({"id": invoice_id, "workspace_id": ws.id})
    return {"ok": True}


# ============ RESERVATIONS ============
@api_router.get("/reservations", response_model=List[Reservation])
async def list_reservations(unit_id: Optional[str] = None, ws: Workspace = Depends(get_workspace)):
    q = {"workspace_id": ws.id}
    if unit_id:
        q["unit_id"] = unit_id
    return await db.reservations.find(q, {"_id": 0}).to_list(1000)


@api_router.post("/reservations", response_model=Reservation)
async def create_reservation(payload: ReservationIn, ws: Workspace = Depends(get_workspace)):
    obj = Reservation(workspace_id=ws.id, **payload.model_dump())
    await db.reservations.insert_one(obj.model_dump())
    return obj


@api_router.put("/reservations/{rid}", response_model=Reservation)
async def update_reservation(rid: str, payload: ReservationIn, ws: Workspace = Depends(get_workspace)):
    existing = await db.reservations.find_one({"id": rid, "workspace_id": ws.id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Reserva no encontrada")
    upd = payload.model_dump()
    await db.reservations.update_one({"id": rid}, {"$set": upd})
    existing.update(upd)
    return Reservation(**existing)


@api_router.delete("/reservations/{rid}")
async def delete_reservation(rid: str, ws: Workspace = Depends(get_workspace)):
    await db.reservations.delete_one({"id": rid, "workspace_id": ws.id})
    return {"ok": True}


# ============ FIXED EXPENSES ============
@api_router.get("/fixed-expenses", response_model=List[FixedExpense])
async def list_fixed_expenses(property_id: Optional[str] = None, ws: Workspace = Depends(get_workspace)):
    q = {"workspace_id": ws.id}
    if property_id:
        q["property_id"] = property_id
    return await db.fixed_expenses.find(q, {"_id": 0}).to_list(1000)


@api_router.post("/fixed-expenses", response_model=FixedExpense)
async def create_fixed_expense(payload: FixedExpenseIn, ws: Workspace = Depends(get_workspace)):
    obj = FixedExpense(workspace_id=ws.id, **payload.model_dump())
    await db.fixed_expenses.insert_one(obj.model_dump())
    return obj


@api_router.put("/fixed-expenses/{fid}", response_model=FixedExpense)
async def update_fixed_expense(fid: str, payload: FixedExpenseIn, ws: Workspace = Depends(get_workspace)):
    existing = await db.fixed_expenses.find_one({"id": fid, "workspace_id": ws.id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Gasto fijo no encontrado")
    upd = payload.model_dump()
    await db.fixed_expenses.update_one({"id": fid}, {"$set": upd})
    existing.update(upd)
    return FixedExpense(**existing)


@api_router.delete("/fixed-expenses/{fid}")
async def delete_fixed_expense(fid: str, ws: Workspace = Depends(get_workspace)):
    await db.fixed_expenses.delete_one({"id": fid, "workspace_id": ws.id})
    return {"ok": True}


def _monthly(amount: float, frequency: str) -> float:
    if frequency == "monthly":
        return amount
    if frequency == "quarterly":
        return amount / 3.0
    if frequency == "yearly":
        return amount / 12.0
    return amount


# ============ DASHBOARD ============
async def _stats_for_month(ws: Workspace, ym: str) -> dict:
    props = await db.properties.count_documents({"workspace_id": ws.id})
    units = await db.units.count_documents({"workspace_id": ws.id})
    occupied = await db.units.count_documents({"workspace_id": ws.id, "status": {"$in": ["occupied", "vacation"]}})
    tenants = await db.tenants.count_documents({"workspace_id": ws.id})

    # property currency map
    cur_map = {}
    async for p in db.properties.find({"workspace_id": ws.id}, {"_id": 0, "id": 1, "currency": 1}):
        cur_map[p["id"]] = p.get("currency", ws.display_currency)

    # unit → property map (avoid N+1 query in reservations loop)
    unit_to_property = {}
    async for u in db.units.find({"workspace_id": ws.id}, {"_id": 0, "id": 1, "property_id": 1}):
        unit_to_property[u["id"]] = u.get("property_id", "")

    total_monthly = 0.0
    async for t in db.tenants.find({"workspace_id": ws.id}, {"_id": 0, "monthly_rent": 1, "property_id": 1}):
        amt = float(t.get("monthly_rent", 0))
        cur = cur_map.get(t.get("property_id", ""), ws.display_currency)
        total_monthly += to_display(amt, cur, ws)

    invoice_gross = invoice_iva = invoice_retenciones = invoice_net = 0.0
    async for inv in db.invoices.find({"workspace_id": ws.id}, {"_id": 0, "invoice_date": 1, "gross_amount": 1, "iva": 1, "retenciones": 1, "net_amount": 1, "currency": 1}):
        d = str(inv.get("invoice_date", ""))
        if d.startswith(ym):
            cur = inv.get("currency", ws.display_currency)
            invoice_gross += to_display(float(inv.get("gross_amount", 0)), cur, ws)
            invoice_iva += to_display(float(inv.get("iva", 0)), cur, ws)
            invoice_retenciones += to_display(float(inv.get("retenciones", 0)), cur, ws)
            invoice_net += to_display(float(inv.get("net_amount", 0)), cur, ws)

    fixed_monthly = 0.0
    async for fe in db.fixed_expenses.find({"workspace_id": ws.id}, {"_id": 0, "amount": 1, "frequency": 1, "property_id": 1}):
        cur = cur_map.get(fe.get("property_id", ""), ws.display_currency)
        amt_disp = to_display(float(fe.get("amount", 0)), cur, ws)
        fixed_monthly += _monthly(amt_disp, str(fe.get("frequency", "monthly")))

    vacation_income = 0.0
    async for r in db.reservations.find({"workspace_id": ws.id, "status": {"$ne": "cancelled"}}, {"_id": 0, "check_in": 1, "total_amount": 1, "unit_id": 1}):
        if str(r.get("check_in", "")).startswith(ym):
            property_id = unit_to_property.get(r.get("unit_id"), "")
            cur = cur_map.get(property_id, ws.display_currency) if property_id else ws.display_currency
            vacation_income += to_display(float(r.get("total_amount", 0)), cur, ws)

    total_expenses = invoice_net + fixed_monthly
    total_income = total_monthly + vacation_income
    net_clean = total_income - total_expenses
    occupancy = round((occupied / units) * 100, 1) if units else 0.0

    return {
        "year_month": ym,
        "display_currency": ws.display_currency,
        "total_properties": props,
        "total_units": units,
        "total_tenants": tenants,
        "monthly_income": round(total_monthly, 2),
        "vacation_income": round(vacation_income, 2),
        "total_income": round(total_income, 2),
        "invoice_gross": round(invoice_gross, 2),
        "invoice_iva": round(invoice_iva, 2),
        "invoice_retenciones": round(invoice_retenciones, 2),
        "invoice_net": round(invoice_net, 2),
        "fixed_expenses_monthly": round(fixed_monthly, 2),
        "monthly_expenses": round(total_expenses, 2),
        "net_income": round(net_clean, 2),
        "occupancy_rate": occupancy,
    }


@api_router.get("/dashboard/stats")
async def dashboard_stats(year_month: Optional[str] = None, ws: Workspace = Depends(get_workspace)):
    ym = year_month or now_utc().strftime("%Y-%m")
    return await _stats_for_month(ws, ym)


# ============ HISTORY (snapshots) ============
@api_router.post("/history/close")
async def close_month(payload: dict, ws: Workspace = Depends(get_workspace)):
    """Cierra un mes (genera snapshot y lo guarda)."""
    ym = payload.get("year_month") or now_utc().strftime("%Y-%m")
    stats = await _stats_for_month(ws, ym)
    snap_doc = {
        "id": str(uuid.uuid4()),
        "workspace_id": ws.id,
        "year_month": ym,
        "stats": stats,
        "closed_at": now_iso(),
    }
    # upsert
    await db.monthly_snapshots.update_one(
        {"workspace_id": ws.id, "year_month": ym},
        {"$set": snap_doc},
        upsert=True,
    )
    return snap_doc


@api_router.get("/history/months")
async def history_months(ws: Workspace = Depends(get_workspace)):
    rows = await db.monthly_snapshots.find({"workspace_id": ws.id}, {"_id": 0}).sort("year_month", -1).to_list(120)
    return rows


@api_router.delete("/history/{snap_id}")
async def history_delete(snap_id: str, ws: Workspace = Depends(get_workspace)):
    await db.monthly_snapshots.delete_one({"id": snap_id, "workspace_id": ws.id})
    return {"ok": True}


@api_router.get("/history/year/{year}")
async def history_year(year: int, ws: Workspace = Depends(get_workspace)):
    prefix = f"{year:04d}"
    snaps = await db.monthly_snapshots.find({"workspace_id": ws.id, "year_month": {"$regex": f"^{prefix}-"}}, {"_id": 0}).sort("year_month", 1).to_list(12)
    if not snaps:
        return {"year": year, "months": [], "totals": {}}
    totals = {"total_income": 0, "monthly_expenses": 0, "invoice_iva": 0, "invoice_retenciones": 0, "net_income": 0}
    for s in snaps:
        st = s.get("stats", {})
        for k in totals:
            totals[k] += float(st.get(k, 0))
    for k in totals:
        totals[k] = round(totals[k], 2)
    return {"year": year, "months": snaps, "totals": totals, "display_currency": ws.display_currency}


# ============ BANK RECONCILIATION ============
@api_router.post("/bank/upload")
async def bank_upload(file: UploadFile = File(...), ws: Workspace = Depends(get_workspace)):
    """Parse CSV/Excel/PDF bank statement → extract transactions → AI categorize → return list."""
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Archivo vacío")

    fname = (file.filename or "").lower()
    rows: List[dict] = []

    try:
        if fname.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(raw), sep=None, engine="python")
        elif fname.endswith((".xls", ".xlsx")):
            df = pd.read_excel(io.BytesIO(raw))
        elif fname.endswith(".pdf") or raw[:5] == b"%PDF-":
            if fitz is None:
                raise HTTPException(500, "PDF no soportado")
            text = ""
            with fitz.open(stream=raw, filetype="pdf") as doc:
                for page in doc:
                    text += page.get_text() + "\n"
            # Use AI to parse PDF text into structured transactions
            return await _ai_parse_bank_pdf(text, ws)
        else:
            # try CSV anyway
            df = pd.read_csv(io.BytesIO(raw), sep=None, engine="python")

        df.columns = [str(c).strip().lower() for c in df.columns]
        # Try to map common Spanish bank columns
        date_col = next((c for c in df.columns if c in ("fecha", "fecha operación", "fecha operacion", "date", "fecha valor")), df.columns[0])
        desc_col = next((c for c in df.columns if c in ("concepto", "descripción", "descripcion", "description", "detalle", "movimiento")), df.columns[1] if len(df.columns) > 1 else df.columns[0])
        amount_col = next((c for c in df.columns if c in ("importe", "amount", "cantidad", "valor")), None)

        for _, r in df.iterrows():
            try:
                date = str(r.get(date_col, ""))[:10]
                desc = str(r.get(desc_col, ""))
                if amount_col:
                    amt = float(str(r.get(amount_col, 0)).replace(",", "."))
                else:
                    amt = 0.0
                if not desc.strip():
                    continue
                rows.append({
                    "date": date, "description": desc, "amount": abs(amt),
                    "direction": "in" if amt > 0 else "out",
                })
            except Exception:
                continue

        # AI categorize each
        return await _ai_categorize_transactions(rows, ws)
    except HTTPException:
        raise
    except Exception as e:
        logging.exception("bank parse")
        raise HTTPException(400, f"No se pudo procesar: {e}")


async def _ai_parse_bank_pdf(text: str, ws: Workspace) -> List[dict]:
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "Falta EMERGENT_LLM_KEY")
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"bank-pdf-{uuid.uuid4()}",
        system_message=(
            "Eres un parser de extractos bancarios. Extrae las transacciones del texto y devuelve "
            "EXCLUSIVAMENTE un JSON array: "
            '[{"date":"YYYY-MM-DD","description":"...","amount":number,"direction":"in"|"out"}]. '
            "Sin texto adicional."
        ),
    ).with_model("openai", "gpt-4o")
    try:
        resp = await chat.send_message(UserMessage(text=text[:50000]))
    except Exception as e:
        raise HTTPException(502, f"IA error: {e}")
    try:
        m = re.search(r"\[.*\]", resp if isinstance(resp, str) else str(resp), re.DOTALL)
        items = json.loads(m.group(0)) if m else []
    except Exception:
        items = []
    rows = []
    for it in items:
        try:
            rows.append({
                "date": str(it.get("date", ""))[:10],
                "description": str(it.get("description", "")),
                "amount": abs(float(it.get("amount", 0))),
                "direction": "in" if str(it.get("direction", "in")).lower() == "in" else "out",
            })
        except Exception:
            continue
    return await _ai_categorize_transactions(rows, ws)


async def _ai_categorize_transactions(rows: List[dict], ws: Workspace) -> List[dict]:
    if not rows:
        return []
    properties = await db.properties.find({"workspace_id": ws.id}, {"_id": 0, "id": 1, "name": 1}).to_list(200)
    tenants = await db.tenants.find({"workspace_id": ws.id}, {"_id": 0, "id": 1, "name": 1, "property_id": 1}).to_list(500)

    if not EMERGENT_LLM_KEY:
        return rows  # graceful degradation

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"bank-cat-{uuid.uuid4()}",
        system_message=(
            "Eres un asistente que categoriza transacciones bancarias para una gestoría inmobiliaria. "
            "Para cada transacción decide categoría (rent, invoice, mortgage, utility, other) y, si la descripción "
            "coincide claramente con el nombre de un inquilino o inmueble dado, devuelve ese match. Devuelve sólo JSON array."
        ),
    ).with_model("openai", "gpt-4o")

    payload = {
        "properties": properties,
        "tenants": tenants,
        "transactions": rows[:200],
        "instructions": (
            "Devuelve un JSON array con la misma longitud que transactions. "
            'Cada elemento: {"category":"rent|invoice|mortgage|utility|other","matched_property_id":"|id","matched_tenant_id":"|id"}. '
            "Si no hay match claro deja cadenas vacías."
        ),
    }
    try:
        resp = await chat.send_message(UserMessage(text=json.dumps(payload, ensure_ascii=False)))
        m = re.search(r"\[.*\]", resp if isinstance(resp, str) else str(resp), re.DOTALL)
        cats = json.loads(m.group(0)) if m else []
    except Exception:
        cats = []

    out = []
    for i, r in enumerate(rows):
        c = cats[i] if i < len(cats) else {}
        out.append({
            **r,
            "category": c.get("category", "other"),
            "matched_property_id": c.get("matched_property_id", "") or "",
            "matched_tenant_id": c.get("matched_tenant_id", "") or "",
            "matched_invoice_id": "",
            "reconciled": False,
        })
    return out


@api_router.get("/bank/transactions", response_model=List[BankTransaction])
async def list_bank(ws: Workspace = Depends(get_workspace)):
    return await db.bank_transactions.find({"workspace_id": ws.id}, {"_id": 0}).sort("date", -1).to_list(2000)


@api_router.post("/bank/transactions", response_model=BankTransaction)
async def create_bank(payload: BankTransactionIn, ws: Workspace = Depends(get_workspace)):
    obj = BankTransaction(workspace_id=ws.id, **payload.model_dump())
    await db.bank_transactions.insert_one(obj.model_dump())
    return obj


@api_router.post("/bank/transactions/bulk")
async def create_bank_bulk(payload: List[BankTransactionIn], ws: Workspace = Depends(get_workspace)):
    docs = [BankTransaction(workspace_id=ws.id, **p.model_dump()).model_dump() for p in payload]
    if docs:
        await db.bank_transactions.insert_many(docs)
    return {"ok": True, "count": len(docs)}


@api_router.put("/bank/transactions/{bid}", response_model=BankTransaction)
async def update_bank(bid: str, payload: BankTransactionIn, ws: Workspace = Depends(get_workspace)):
    existing = await db.bank_transactions.find_one({"id": bid, "workspace_id": ws.id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Transacción no encontrada")
    upd = payload.model_dump()
    await db.bank_transactions.update_one({"id": bid}, {"$set": upd})
    existing.update(upd)
    return BankTransaction(**existing)


@api_router.delete("/bank/transactions/{bid}")
async def delete_bank(bid: str, ws: Workspace = Depends(get_workspace)):
    await db.bank_transactions.delete_one({"id": bid, "workspace_id": ws.id})
    return {"ok": True}


@api_router.get("/")
async def root():
    return {"app": "RCT Gestión Inmobiliaria", "version": "2.0"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
