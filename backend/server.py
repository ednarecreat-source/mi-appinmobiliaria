from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import base64
import json
import re
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, date

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

try:
    import fitz  # PyMuPDF
except Exception:
    fitz = None

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI(title="RCT Gestión Inmobiliaria")
api_router = APIRouter(prefix="/api")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ============ MODELS ============
class Property(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str
    category: str = "residential"  # residential | commercial | vacation
    description: Optional[str] = ""
    image_url: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class PropertyIn(BaseModel):
    name: str
    address: str
    category: str = "residential"
    description: Optional[str] = ""
    image_url: Optional[str] = ""


class Unit(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    property_id: str
    name: str
    unit_type: str  # Local | Estudio | Duplex | Dormitorio
    rental_mode: str = "long_term"  # long_term | vacation
    rent_amount: float = 0.0
    daily_rate: float = 0.0
    weekly_rate: float = 0.0
    monthly_rate: float = 0.0
    status: str = "vacant"  # vacant | occupied | vacation
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
    vendor: str = ""
    invoice_date: str = ""
    concept: str = ""
    gross_amount: float = 0.0
    iva: float = 0.0
    iva_rate: float = 21.0
    retenciones: float = 0.0
    retenciones_rate: float = 0.0
    net_amount: float = 0.0
    property_id: Optional[str] = ""
    splits: List[InvoiceSplit] = []
    image_base64: Optional[str] = ""
    raw_ai_response: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class Reservation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    unit_id: str
    guest_name: str
    guest_contact: Optional[str] = ""
    check_in: str
    check_out: str
    rate_type: str = "daily"  # daily | weekly | monthly
    nights: int = 1
    total_amount: float = 0.0
    status: str = "confirmed"  # confirmed | pending | cancelled
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


# ============ PROPERTIES ============
@api_router.get("/properties", response_model=List[Property])
async def list_properties():
    rows = await db.properties.find({}, {"_id": 0}).to_list(1000)
    return rows


@api_router.post("/properties", response_model=Property)
async def create_property(payload: PropertyIn):
    obj = Property(**payload.model_dump())
    await db.properties.insert_one(obj.model_dump())
    return obj


@api_router.put("/properties/{prop_id}", response_model=Property)
async def update_property(prop_id: str, payload: PropertyIn):
    existing = await db.properties.find_one({"id": prop_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Inmueble no encontrado")
    existing.update(payload.model_dump())
    await db.properties.update_one({"id": prop_id}, {"$set": payload.model_dump()})
    return Property(**existing)


@api_router.delete("/properties/{prop_id}")
async def delete_property(prop_id: str):
    await db.properties.delete_one({"id": prop_id})
    await db.units.delete_many({"property_id": prop_id})
    return {"ok": True}


# ============ UNITS ============
@api_router.get("/units", response_model=List[Unit])
async def list_units(property_id: Optional[str] = None):
    q = {"property_id": property_id} if property_id else {}
    rows = await db.units.find(q, {"_id": 0}).to_list(1000)
    return rows


@api_router.post("/units", response_model=Unit)
async def create_unit(payload: UnitIn):
    obj = Unit(**payload.model_dump())
    await db.units.insert_one(obj.model_dump())
    return obj


@api_router.put("/units/{unit_id}", response_model=Unit)
async def update_unit(unit_id: str, payload: UnitIn):
    existing = await db.units.find_one({"id": unit_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Unidad no encontrada")
    await db.units.update_one({"id": unit_id}, {"$set": payload.model_dump()})
    existing.update(payload.model_dump())
    return Unit(**existing)


@api_router.delete("/units/{unit_id}")
async def delete_unit(unit_id: str):
    await db.units.delete_one({"id": unit_id})
    return {"ok": True}


# ============ TENANTS ============
@api_router.get("/tenants", response_model=List[Tenant])
async def list_tenants(property_id: Optional[str] = None):
    q = {"property_id": property_id} if property_id else {}
    rows = await db.tenants.find(q, {"_id": 0}).to_list(1000)
    return rows


@api_router.get("/tenants/percentage-summary")
async def tenants_percentage_summary():
    """Returns sum of split_percentage per property_id."""
    summary: dict = {}
    async for t in db.tenants.find({}, {"_id": 0, "property_id": 1, "split_percentage": 1}):
        pid = t.get("property_id") or ""
        if not pid:
            continue
        summary[pid] = summary.get(pid, 0.0) + float(t.get("split_percentage", 0))
    return summary


@api_router.post("/tenants", response_model=Tenant)
async def create_tenant(payload: TenantIn):
    obj = Tenant(**payload.model_dump())
    await db.tenants.insert_one(obj.model_dump())
    return obj


@api_router.put("/tenants/{tenant_id}", response_model=Tenant)
async def update_tenant(tenant_id: str, payload: TenantIn):
    existing = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Inquilino no encontrado")
    await db.tenants.update_one({"id": tenant_id}, {"$set": payload.model_dump()})
    existing.update(payload.model_dump())
    return Tenant(**existing)


@api_router.delete("/tenants/{tenant_id}")
async def delete_tenant(tenant_id: str):
    await db.tenants.delete_one({"id": tenant_id})
    return {"ok": True}


# ============ INVOICE AI ============
def _parse_llm_json(text: str) -> dict:
    """Extract JSON object from LLM response."""
    # try direct json
    try:
        return json.loads(text)
    except Exception:
        pass
    # try to find a fenced json block
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    # try to find any { ... }
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
):
    """Upload an invoice image, analyze with GPT-4o vision, return extracted fields + split per tenant."""
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
            raise HTTPException(500, "Soporte PDF no disponible (PyMuPDF)")
        try:
            doc = fitz.open(stream=content, filetype="pdf")
            if doc.page_count == 0:
                raise HTTPException(400, "PDF vacío")
            page = doc.load_page(0)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # ~150dpi
            img_bytes = pix.tobytes("jpeg")
            doc.close()
            content = img_bytes
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
        "Analiza la imagen de la factura/recibo y devuelve EXCLUSIVAMENTE un JSON con esta estructura "
        "(sin texto adicional, sin markdown):\n"
        "{\n"
        '  "vendor": "nombre del emisor/proveedor",\n'
        '  "invoice_date": "YYYY-MM-DD",\n'
        '  "concept": "descripción corta del servicio/producto",\n'
        '  "gross_amount": base_imponible_sin_iva_en_numero,\n'
        '  "iva_rate": porcentaje_iva_numero,\n'
        '  "iva": importe_iva_numero,\n'
        '  "retenciones_rate": porcentaje_retencion_numero,\n'
        '  "retenciones": importe_retencion_numero,\n'
        '  "net_amount": total_a_pagar_numero\n'
        "}\n"
        "Si un campo no aparece, usa 0 para números y cadena vacía para texto. "
        "Los importes son en EUR. IVA típico en España: 21, 10 o 4."
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"invoice-{uuid.uuid4()}",
        system_message=system_prompt,
    ).with_model("openai", "gpt-4o")

    img = ImageContent(image_base64=b64)
    msg = UserMessage(
        text="Extrae los datos de esta factura y devuelve sólo el JSON indicado.",
        file_contents=[img],
    )

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

    # Compute split per tenant
    tenant_query = {"property_id": property_id} if property_id else {}
    tenants = await db.tenants.find(tenant_query, {"_id": 0}).to_list(1000)
    splits = []
    for t in tenants:
        pct = float(t.get("split_percentage", 0))
        splits.append(
            InvoiceSplit(
                tenant_id=t["id"],
                tenant_name=t["name"],
                percentage=pct,
                amount=round(net * pct / 100.0, 2),
            )
        )

    invoice = Invoice(
        vendor=parsed.get("vendor", "") or "",
        invoice_date=parsed.get("invoice_date", "") or "",
        concept=parsed.get("concept", "") or "",
        gross_amount=gross,
        iva=iva,
        iva_rate=iva_rate,
        retenciones=ret,
        retenciones_rate=ret_rate,
        net_amount=net,
        property_id=property_id or "",
        splits=splits,
        image_base64=b64[:200000],  # store capped
        raw_ai_response=response_text if isinstance(response_text, str) else str(response_text),
    )
    await db.invoices.insert_one(invoice.model_dump())
    return invoice


@api_router.get("/invoices", response_model=List[Invoice])
async def list_invoices():
    rows = await db.invoices.find({}, {"_id": 0, "image_base64": 0}).to_list(1000)
    return rows


@api_router.get("/invoices/{invoice_id}", response_model=Invoice)
async def get_invoice(invoice_id: str):
    row = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Factura no encontrada")
    return row


@api_router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str):
    await db.invoices.delete_one({"id": invoice_id})
    return {"ok": True}


# ============ RESERVATIONS (Vacation) ============
@api_router.get("/reservations", response_model=List[Reservation])
async def list_reservations(unit_id: Optional[str] = None):
    q = {"unit_id": unit_id} if unit_id else {}
    rows = await db.reservations.find(q, {"_id": 0}).to_list(1000)
    return rows


@api_router.post("/reservations", response_model=Reservation)
async def create_reservation(payload: ReservationIn):
    obj = Reservation(**payload.model_dump())
    await db.reservations.insert_one(obj.model_dump())
    return obj


@api_router.put("/reservations/{rid}", response_model=Reservation)
async def update_reservation(rid: str, payload: ReservationIn):
    existing = await db.reservations.find_one({"id": rid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Reserva no encontrada")
    await db.reservations.update_one({"id": rid}, {"$set": payload.model_dump()})
    existing.update(payload.model_dump())
    return Reservation(**existing)


@api_router.delete("/reservations/{rid}")
async def delete_reservation(rid: str):
    await db.reservations.delete_one({"id": rid})
    return {"ok": True}


# ============ DASHBOARD ============
@api_router.get("/dashboard/stats")
async def dashboard_stats():
    props = await db.properties.count_documents({})
    units = await db.units.count_documents({})
    occupied = await db.units.count_documents({"status": {"$in": ["occupied", "vacation"]}})
    tenants = await db.tenants.count_documents({})

    # Monthly income = sum of monthly_rent of tenants
    total_monthly = 0.0
    async for t in db.tenants.find({}, {"_id": 0, "monthly_rent": 1}):
        total_monthly += float(t.get("monthly_rent", 0))

    # Net expenses this month from invoices
    now = datetime.now(timezone.utc)
    ym = now.strftime("%Y-%m")
    total_expenses = 0.0
    async for inv in db.invoices.find({}, {"_id": 0, "invoice_date": 1, "net_amount": 1}):
        d = str(inv.get("invoice_date", ""))
        if d.startswith(ym):
            total_expenses += float(inv.get("net_amount", 0))

    occupancy = round((occupied / units) * 100, 1) if units else 0.0

    return {
        "total_properties": props,
        "total_units": units,
        "total_tenants": tenants,
        "monthly_income": round(total_monthly, 2),
        "monthly_expenses": round(total_expenses, 2),
        "net_income": round(total_monthly - total_expenses, 2),
        "occupancy_rate": occupancy,
    }


@api_router.get("/")
async def root():
    return {"app": "RCT Gestión Inmobiliaria", "version": "1.0"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
