"""Backend test suite for RCT Gestión Inmobiliaria.

Covers: properties, units (with cascade), tenants, reservations, invoices (AI),
dashboard stats. Uses BASE_URL from REACT_APP_BACKEND_URL.
"""
import os
import io
import base64
import urllib.request
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://property-manager-pro-19.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def s():
    return requests.Session()


# ---------- ROOT / DASHBOARD ----------
def test_root(s):
    r = s.get(f"{API}/")
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("app") == "RCT Gestión Inmobiliaria"


def test_dashboard_stats(s):
    r = s.get(f"{API}/dashboard/stats")
    assert r.status_code == 200, r.text
    j = r.json()
    for k in ["total_properties", "total_units", "total_tenants",
              "monthly_income", "monthly_expenses", "net_income", "occupancy_rate"]:
        assert k in j


# ---------- PROPERTIES ----------
def test_properties_crud(s):
    # CREATE
    payload = {"name": "TEST_Prop1", "address": "Calle Test 1", "category": "residential", "description": "desc"}
    r = s.post(f"{API}/properties", json=payload)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["name"] == "TEST_Prop1"
    assert "_id" not in p
    pid = p["id"]

    # LIST
    r = s.get(f"{API}/properties")
    assert r.status_code == 200
    assert any(x["id"] == pid for x in r.json())
    assert all("_id" not in x for x in r.json())

    # UPDATE
    upd = {**payload, "name": "TEST_Prop1_upd"}
    r = s.put(f"{API}/properties/{pid}", json=upd)
    assert r.status_code == 200
    assert r.json()["name"] == "TEST_Prop1_upd"

    # Verify persistence via list
    r = s.get(f"{API}/properties")
    assert any(x["id"] == pid and x["name"] == "TEST_Prop1_upd" for x in r.json())

    # DELETE + cascade test
    # Create unit under property
    u = s.post(f"{API}/units", json={
        "property_id": pid, "name": "TEST_U1", "unit_type": "Estudio",
        "rental_mode": "long_term", "rent_amount": 500
    })
    assert u.status_code == 200
    uid = u.json()["id"]
    # Confirm unit exists
    assert any(x["id"] == uid for x in s.get(f"{API}/units", params={"property_id": pid}).json())

    r = s.delete(f"{API}/properties/{pid}")
    assert r.status_code == 200
    # Cascade: units of that property should be gone
    units_after = s.get(f"{API}/units", params={"property_id": pid}).json()
    assert not any(x["id"] == uid for x in units_after), "Cascade delete failed"

    # Property update on non-existent -> 404
    r = s.put(f"{API}/properties/{pid}", json=payload)
    assert r.status_code == 404


# ---------- UNITS ----------
def test_units_crud(s):
    p = s.post(f"{API}/properties", json={"name": "TEST_PropU", "address": "X", "category": "residential"}).json()
    pid = p["id"]
    try:
        # CREATE long_term unit
        r = s.post(f"{API}/units", json={
            "property_id": pid, "name": "TEST_Local1", "unit_type": "Local",
            "rental_mode": "long_term", "rent_amount": 800
        })
        assert r.status_code == 200, r.text
        u1 = r.json()
        assert u1["unit_type"] == "Local"
        assert u1["rental_mode"] == "long_term"
        assert "_id" not in u1

        # CREATE vacation unit with rates
        r = s.post(f"{API}/units", json={
            "property_id": pid, "name": "TEST_Dup1", "unit_type": "Duplex",
            "rental_mode": "vacation", "daily_rate": 80, "weekly_rate": 500, "monthly_rate": 1800,
            "status": "vacation"
        })
        assert r.status_code == 200
        u2 = r.json()
        assert u2["rental_mode"] == "vacation"
        assert u2["daily_rate"] == 80

        # FILTER
        r = s.get(f"{API}/units", params={"property_id": pid})
        assert r.status_code == 200
        ids = [x["id"] for x in r.json()]
        assert u1["id"] in ids and u2["id"] in ids

        # UPDATE
        r = s.put(f"{API}/units/{u1['id']}", json={
            "property_id": pid, "name": "TEST_Local1_upd", "unit_type": "Local",
            "rental_mode": "long_term", "rent_amount": 900
        })
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Local1_upd"
        assert r.json()["rent_amount"] == 900

        # DELETE
        r = s.delete(f"{API}/units/{u2['id']}")
        assert r.status_code == 200
        ids_after = [x["id"] for x in s.get(f"{API}/units", params={"property_id": pid}).json()]
        assert u2["id"] not in ids_after

        # Update non-existent -> 404
        r = s.put(f"{API}/units/non-existent-id", json={
            "property_id": pid, "name": "x", "unit_type": "Local"
        })
        assert r.status_code == 404
    finally:
        s.delete(f"{API}/properties/{pid}")


# ---------- TENANTS ----------
def test_tenants_crud(s):
    p = s.post(f"{API}/properties", json={"name": "TEST_PropT", "address": "Y", "category": "residential"}).json()
    pid = p["id"]
    try:
        t1 = s.post(f"{API}/tenants", json={
            "name": "TEST_Tenant1", "property_id": pid, "split_percentage": 60, "monthly_rent": 600
        })
        assert t1.status_code == 200, t1.text
        t1j = t1.json()
        assert t1j["split_percentage"] == 60
        assert "_id" not in t1j

        t2 = s.post(f"{API}/tenants", json={
            "name": "TEST_Tenant2", "property_id": pid, "split_percentage": 40, "monthly_rent": 400
        }).json()

        # FILTER
        r = s.get(f"{API}/tenants", params={"property_id": pid})
        assert r.status_code == 200
        assert len(r.json()) == 2

        # UPDATE
        r = s.put(f"{API}/tenants/{t1j['id']}", json={
            "name": "TEST_Tenant1_upd", "property_id": pid, "split_percentage": 70, "monthly_rent": 700
        })
        assert r.status_code == 200
        assert r.json()["split_percentage"] == 70
        assert r.json()["name"] == "TEST_Tenant1_upd"

        # DELETE
        r = s.delete(f"{API}/tenants/{t2['id']}")
        assert r.status_code == 200
        # Update missing -> 404
        r = s.put(f"{API}/tenants/missing", json={"name": "x"})
        assert r.status_code == 404
    finally:
        # cleanup tenants of property
        for t in s.get(f"{API}/tenants", params={"property_id": pid}).json():
            s.delete(f"{API}/tenants/{t['id']}")
        s.delete(f"{API}/properties/{pid}")


# ---------- RESERVATIONS ----------
def test_reservations_crud(s):
    p = s.post(f"{API}/properties", json={"name": "TEST_PropR", "address": "Z", "category": "vacation"}).json()
    pid = p["id"]
    u = s.post(f"{API}/units", json={
        "property_id": pid, "name": "TEST_Vac", "unit_type": "Estudio",
        "rental_mode": "vacation", "daily_rate": 100
    }).json()
    uid = u["id"]
    try:
        r = s.post(f"{API}/reservations", json={
            "unit_id": uid, "guest_name": "TEST_Guest",
            "check_in": "2026-02-01", "check_out": "2026-02-05",
            "rate_type": "daily", "nights": 4, "total_amount": 400
        })
        assert r.status_code == 200, r.text
        rj = r.json()
        assert rj["nights"] == 4
        assert "_id" not in rj
        rid = rj["id"]

        # FILTER
        lst = s.get(f"{API}/reservations", params={"unit_id": uid}).json()
        assert any(x["id"] == rid for x in lst)

        # UPDATE
        r = s.put(f"{API}/reservations/{rid}", json={
            "unit_id": uid, "guest_name": "TEST_Guest_upd",
            "check_in": "2026-02-01", "check_out": "2026-02-06",
            "rate_type": "daily", "nights": 5, "total_amount": 500
        })
        assert r.status_code == 200
        assert r.json()["nights"] == 5
        assert r.json()["guest_name"] == "TEST_Guest_upd"

        # Verify persistence
        lst2 = s.get(f"{API}/reservations", params={"unit_id": uid}).json()
        assert any(x["id"] == rid and x["nights"] == 5 for x in lst2)

        # DELETE
        r = s.delete(f"{API}/reservations/{rid}")
        assert r.status_code == 200
        # Update missing -> 404
        r = s.put(f"{API}/reservations/missing", json={
            "unit_id": uid, "guest_name": "x", "check_in": "2026-01-01", "check_out": "2026-01-02"
        })
        assert r.status_code == 404
    finally:
        s.delete(f"{API}/properties/{pid}")


# ---------- INVOICES (AI) ----------
def _real_invoice_image_bytes() -> bytes:
    """Fetch a real invoice-looking image from a public source as JPEG bytes."""
    urls = [
        "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80",
        "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80",
    ]
    for u in urls:
        try:
            req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read()
                if data and len(data) > 5000:
                    return data
        except Exception:
            continue
    # Fallback: generate a synthetic invoice image with PIL
    try:
        from PIL import Image, ImageDraw, ImageFont
        img = Image.new("RGB", (800, 1000), "white")
        d = ImageDraw.Draw(img)
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22)
            small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
        except Exception:
            font = ImageFont.load_default()
            small = font
        lines = [
            ("FACTURA", font),
            ("Emisor: Suministros Iberica S.L.", small),
            ("CIF: B12345678", small),
            ("Fecha: 2026-01-15", small),
            ("Concepto: Reparación fontanería piso 3A", small),
            ("--------------------------------------", small),
            ("Base imponible: 200,00 EUR", small),
            ("IVA 21%: 42,00 EUR", small),
            ("Retención 15%: 30,00 EUR", small),
            ("TOTAL: 212,00 EUR", font),
        ]
        y = 40
        for text, f in lines:
            d.text((40, y), text, fill="black", font=f)
            y += 50
        # Add some textures / shapes
        d.rectangle([30, 30, 770, 970], outline="black", width=3)
        d.line([30, 220, 770, 220], fill="gray", width=2)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        return buf.getvalue()
    except Exception:
        return b""


def test_invoices_full_flow(s):
    # Setup: create property + 2 tenants 60/40
    p = s.post(f"{API}/properties", json={"name": "TEST_PropInv", "address": "Inv", "category": "residential"}).json()
    pid = p["id"]
    t1 = s.post(f"{API}/tenants", json={"name": "TEST_InvT1", "property_id": pid, "split_percentage": 60}).json()
    t2 = s.post(f"{API}/tenants", json={"name": "TEST_InvT2", "property_id": pid, "split_percentage": 40}).json()

    invoice_id = None
    try:
        img_bytes = _real_invoice_image_bytes()
        if not img_bytes:
            pytest.skip("Could not obtain real invoice image bytes")

        files = {"file": ("invoice.jpg", img_bytes, "image/jpeg")}
        data = {"property_id": pid}
        r = s.post(f"{API}/invoices/analyze", files=files, data=data, timeout=120)
        assert r.status_code == 200, f"analyze failed: {r.status_code} {r.text[:500]}"
        j = r.json()
        assert "_id" not in j
        for k in ["id", "vendor", "invoice_date", "gross_amount", "iva", "iva_rate",
                  "retenciones", "retenciones_rate", "net_amount", "splits"]:
            assert k in j, f"missing key {k}"
        # Splits should match the 2 tenants
        assert len(j["splits"]) == 2
        ids = sorted([s_["tenant_id"] for s_ in j["splits"]])
        assert ids == sorted([t1["id"], t2["id"]])
        pcts = sorted([s_["percentage"] for s_ in j["splits"]])
        assert pcts == [40.0, 60.0]
        # amounts should sum ~= net_amount
        total_split = round(sum(s_["amount"] for s_ in j["splits"]), 2)
        assert abs(total_split - j["net_amount"]) <= 0.05 or j["net_amount"] == 0
        invoice_id = j["id"]

        # GET list (should not include image_base64)
        lst = s.get(f"{API}/invoices").json()
        assert any(x["id"] == invoice_id for x in lst)
        for x in lst:
            assert not x.get("image_base64")

        # GET one
        one = s.get(f"{API}/invoices/{invoice_id}")
        assert one.status_code == 200
        assert one.json()["id"] == invoice_id

        # GET 404
        r404 = s.get(f"{API}/invoices/non-existent")
        assert r404.status_code == 404
    finally:
        if invoice_id:
            s.delete(f"{API}/invoices/{invoice_id}")
        s.delete(f"{API}/tenants/{t1['id']}")
        s.delete(f"{API}/tenants/{t2['id']}")
        s.delete(f"{API}/properties/{pid}")
