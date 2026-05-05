"""
Iter 6 backend tests (review_request): verify
  1) token field in /auth/register|login|google responses,
  2) Bearer-only auth (no cookie) works for /auth/me, properties, dashboard, workspaces,
  3) reCAPTCHA v3 gating on /auth/register and /auth/login (and not on /auth/google),
  4) Full regression under Bearer auth (workspaces invite/members, invoices/analyze,
     reservations, fixed-expenses, banking, history, dashboard, multi-tenant isolation).

Uses ONLY the public REACT_APP_BACKEND_URL (so we bypass the internal FastAPI cookie
propagation and assert Bearer-only works end-to-end).

NOTE: Reads /app/backend/.env to temporarily disable RECAPTCHA_SECRET_KEY for the
Bearer/regression section (real reCAPTCHA tokens cannot be generated headless),
then restores it. supervisorctl restart backend is used between phases.
"""
import io
import os
import re
import time
import uuid
import subprocess
from pathlib import Path

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
ENV_PATH = Path("/app/backend/.env")

_mc = MongoClient(MONGO_URL)
_db = _mc[DB_NAME]


# ----------------- helpers -----------------
def _deep_check_no_id(obj, path=""):
    if isinstance(obj, dict):
        assert "_id" not in obj, f"_id leaked at {path}"
        for k, v in obj.items():
            _deep_check_no_id(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            _deep_check_no_id(v, f"{path}[{i}]")


def _read_env():
    return ENV_PATH.read_text()


def _write_env(text):
    ENV_PATH.write_text(text)
    subprocess.run(["sudo", "supervisorctl", "restart", "backend"], check=False, capture_output=True)
    # wait for backend to come back
    for _ in range(30):
        try:
            r = requests.get(f"{API}/auth/config", timeout=3)
            if r.status_code == 200:
                return
        except Exception:
            pass
        time.sleep(1)


def _register(suffix=None, recaptcha_bypass=True):
    """Register a fresh user. Only works when reCAPTCHA is disabled in env."""
    suf = suffix or uuid.uuid4().hex[:8]
    email = f"TEST_iter6_{suf}@example.com"
    payload = {"name": f"T{suf}", "email": email, "password": "Secret123!"}
    r = requests.post(f"{API}/auth/register", json=payload, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token")
    assert token and isinstance(token, str) and len(token) > 10, \
        f"response missing non-empty token field: {data}"
    return token, data, email


def _bearer(token):
    return {"Authorization": f"Bearer {token}"}


def _cleanup_user(email, user_id):
    _db.users.delete_many({"email": email.lower()})
    _db.user_sessions.delete_many({"user_id": user_id})
    ws_ids = [w["id"] for w in _db.workspaces.find({"owner_id": user_id}, {"id": 1})]
    for wid in ws_ids:
        for coll in ("properties", "units", "tenants", "invoices", "reservations",
                     "fixed_expenses", "bank_transactions", "monthly_snapshots"):
            _db[coll].delete_many({"workspace_id": wid})
    _db.workspaces.delete_many({"owner_id": user_id})


# ======================================================================
# Phase 1: reCAPTCHA ENABLED (uses the real RECAPTCHA_SECRET_KEY in .env)
# ======================================================================
_ORIGINAL_ENV = _read_env()


class TestRecaptchaEnabled:
    """These run first, against the current .env which has RECAPTCHA_SECRET_KEY set."""

    def test_config_reports_recaptcha_enabled_and_site_key(self):
        r = requests.get(f"{API}/auth/config", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("recaptcha_enabled") is True, data
        assert data.get("recaptcha_site_key"), f"no site_key: {data}"
        # also google_client_id now populated
        assert data.get("google_enabled") is True
        assert data.get("google_client_id")
        _deep_check_no_id(data)

    def test_register_missing_recaptcha_returns_400(self):
        r = requests.post(f"{API}/auth/register", json={
            "name": "X", "email": f"TEST_noRC_{uuid.uuid4().hex[:6]}@e.com",
            "password": "Secret123!",
        }, timeout=20)
        assert r.status_code == 400, r.text
        assert "reCAPTCHA" in r.text or "recaptcha" in r.text.lower()

    def test_register_bogus_recaptcha_returns_401(self):
        r = requests.post(f"{API}/auth/register", json={
            "name": "X", "email": f"TEST_bogusRC_{uuid.uuid4().hex[:6]}@e.com",
            "password": "Secret123!", "recaptcha_token": "obviously-not-valid",
        }, timeout=20)
        assert r.status_code == 401, r.text
        assert "reCAPTCHA" in r.text or "recaptcha" in r.text.lower()

    def test_login_missing_recaptcha_returns_400(self):
        r = requests.post(f"{API}/auth/login", json={
            "email": "any@e.com", "password": "whatever1",
        }, timeout=20)
        assert r.status_code == 400, r.text

    def test_login_bogus_recaptcha_returns_401(self):
        r = requests.post(f"{API}/auth/login", json={
            "email": "any@e.com", "password": "whatever1",
            "recaptcha_token": "bad-token",
        }, timeout=20)
        assert r.status_code == 401, r.text

    def test_google_does_not_require_recaptcha(self):
        """With recaptcha ON, /auth/google should NOT 400 for missing token.
        It should attempt to verify the credential and fail with 401 (invalid JWT)."""
        r = requests.post(f"{API}/auth/google", json={
            "credential": "not.a.real.jwt",
        }, timeout=20)
        # Must NOT be 400 'Falta verificación reCAPTCHA'
        assert r.status_code != 400 or "reCAPTCHA" not in r.text, \
            f"google endpoint required recaptcha: {r.status_code} {r.text}"
        # With GOOGLE_CLIENT_ID configured, bogus credential → 401
        assert r.status_code == 401, r.text


# ======================================================================
# Phase 2: reCAPTCHA DISABLED — Bearer auth + full regression
# ======================================================================
@pytest.fixture(scope="module", autouse=False)
def disable_recaptcha_env():
    original = _read_env()
    # blank out RECAPTCHA_SECRET_KEY only (keep SITE_KEY, MIN_SCORE, GOOGLE, JWT)
    patched = re.sub(
        r"^RECAPTCHA_SECRET_KEY=.*$",
        "RECAPTCHA_SECRET_KEY=",
        original,
        flags=re.MULTILINE,
    )
    assert patched != original, "failed to patch RECAPTCHA_SECRET_KEY"
    _write_env(patched)
    # sanity: config now says disabled
    r = requests.get(f"{API}/auth/config", timeout=15)
    assert r.status_code == 200 and r.json().get("recaptcha_enabled") is False, r.text
    yield
    # restore original verbatim
    _write_env(original)
    r = requests.get(f"{API}/auth/config", timeout=15)
    assert r.status_code == 200 and r.json().get("recaptcha_enabled") is True


@pytest.fixture(scope="module")
def user_a(disable_recaptcha_env):
    token, data, email = _register("a")
    yield token, data, email
    _cleanup_user(email, data["user_id"])


@pytest.fixture(scope="module")
def user_b(disable_recaptcha_env):
    token, data, email = _register("b")
    yield token, data, email
    _cleanup_user(email, data["user_id"])


class TestTokenAndBearerOnly:
    def test_register_returns_non_empty_token_field(self, disable_recaptcha_env):
        suf = uuid.uuid4().hex[:8]
        email = f"TEST_iter6_tok_{suf}@example.com"
        r = requests.post(f"{API}/auth/register", json={
            "name": "TokUser", "email": email, "password": "Secret123!",
        }, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data.get("token") and isinstance(data["token"], str) and len(data["token"]) > 10
        assert data["email"] == email.lower()
        assert "password_hash" not in data and "password" not in data
        _cleanup_user(email, data["user_id"])

    def test_login_returns_non_empty_token_field(self, disable_recaptcha_env):
        token1, data, email = _register()
        r = requests.post(f"{API}/auth/login", json={
            "email": email, "password": "Secret123!",
        }, timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body.get("token") and isinstance(body["token"], str) and len(body["token"]) > 10
        assert body["email"] == email.lower()
        _cleanup_user(email, data["user_id"])

    def test_bearer_only_auth_no_cookie(self, user_a):
        """Fresh requests.Session (no cookies) with only Authorization Bearer must work."""
        token, _, _ = user_a
        s = requests.Session()
        s.cookies.clear()
        h = _bearer(token)
        for path in ["/auth/me", "/properties", "/dashboard/stats", "/workspaces"]:
            r = s.get(f"{API}{path}", headers=h, timeout=20)
            assert r.status_code == 200, f"Bearer-only failed on {path}: {r.status_code} {r.text}"

    def test_no_bearer_and_no_cookie_returns_401(self):
        """Clean request with no auth at all must 401 on /auth/me."""
        s = requests.Session()
        s.cookies.clear()
        r = s.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401


class TestRegressionBearer:
    def test_properties_units_tenants_reservations_fixed(self, user_a):
        token, _, _ = user_a
        h = _bearer(token)
        p = requests.post(f"{API}/properties", headers=h, json={
            "name": "TEST_i6_Prop", "address": "C1", "currency": "EUR"}, timeout=20)
        assert p.status_code == 200
        pid = p.json()["id"]
        _deep_check_no_id(p.json())

        u = requests.post(f"{API}/units", headers=h, json={
            "property_id": pid, "name": "U1", "unit_type": "apartment",
            "rental_mode": "long_term", "rent_amount": 800}, timeout=20)
        assert u.status_code == 200
        uid = u.json()["id"]

        t = requests.post(f"{API}/tenants", headers=h, json={
            "name": "TEST_i6_Tenant", "email": "t6@e.com", "property_id": pid,
            "unit_id": uid, "split_percentage": 100, "monthly_rent": 800}, timeout=20)
        assert t.status_code == 200

        rs = requests.post(f"{API}/reservations", headers=h, json={
            "unit_id": uid, "guest_name": "G6", "check_in": "2026-02-10",
            "check_out": "2026-02-15", "rate_type": "daily", "nights": 5,
            "total_amount": 500}, timeout=20)
        assert rs.status_code == 200

        fe = requests.post(f"{API}/fixed-expenses", headers=h, json={
            "property_id": pid, "name": "IBI", "category": "tax",
            "amount": 1200, "frequency": "yearly"}, timeout=20)
        assert fe.status_code == 200

        ds = requests.get(f"{API}/dashboard/stats", headers=h, timeout=20)
        assert ds.status_code == 200
        for k in ("total_income", "monthly_expenses", "net_income",
                  "fixed_expenses_monthly", "invoice_net", "occupancy_rate"):
            assert k in ds.json()
        _deep_check_no_id(ds.json())

    def test_invoice_analyze_image_and_pdf(self, user_a):
        """/invoices/analyze accepts multipart with image and PDF. Use tiny PNG/PDF stubs.
        We only assert the endpoint is reachable with Bearer auth (200 OR 400/422 from LLM
        parsing, NOT 401/403)."""
        token, _, _ = user_a
        h = _bearer(token)
        # 1x1 PNG
        png = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
               b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xfc\xcf"
               b"\xc0\x00\x00\x00\x03\x00\x01\x8d\xf5\x05\xc9\x00\x00\x00\x00IEND\xaeB`\x82")
        for name, content, ctype in [("a.png", png, "image/png"),
                                      (b"m.pdf", b"%PDF-1.4\n%EOF\n", "application/pdf")]:
            # handle bytes key in name
            fname = name if isinstance(name, str) else name.decode()
            files = {"file": (fname, content, ctype)}
            r = requests.post(f"{API}/invoices/analyze", headers=h, files=files, timeout=60)
            assert r.status_code not in (401, 403), \
                f"auth failed on /invoices/analyze: {r.status_code} {r.text[:200]}"

    def test_bank_and_history_bearer(self, user_a):
        token, _, _ = user_a
        h = _bearer(token)
        r = requests.post(f"{API}/bank/transactions", headers=h, json={
            "date": "2026-02-05", "description": "TEST_i6 rent in",
            "amount": 800, "direction": "in", "category": "rent"}, timeout=20)
        assert r.status_code == 200
        bid = r.json()["id"]

        rb = requests.post(f"{API}/bank/transactions/bulk", headers=h, json=[
            {"date": "2026-02-06", "description": "T2", "amount": 50, "direction": "out",
             "category": "utility"}], timeout=20)
        assert rb.status_code == 200

        rl = requests.get(f"{API}/bank/transactions", headers=h, timeout=20)
        assert rl.status_code == 200
        _deep_check_no_id(rl.json())

        rc = requests.post(f"{API}/history/close", headers=h, json={"year_month": "2026-02"}, timeout=30)
        assert rc.status_code == 200
        snap_id = rc.json()["id"]

        rm = requests.get(f"{API}/history/months", headers=h, timeout=20)
        assert rm.status_code == 200
        assert any(s["year_month"] == "2026-02" for s in rm.json())

        ry = requests.get(f"{API}/history/year/2026", headers=h, timeout=20)
        assert ry.status_code == 200 and ry.json()["year"] == 2026

        rdel = requests.delete(f"{API}/history/{snap_id}", headers=h, timeout=20)
        assert rdel.status_code == 200
        requests.delete(f"{API}/bank/transactions/{bid}", headers=h, timeout=20)

    def test_workspaces_invite_and_remove_member(self, user_a, user_b):
        ta, ua, _ = user_a
        tb, ub, eb = user_b
        h = _bearer(ta)
        ws_list = requests.get(f"{API}/workspaces", headers=h, timeout=20).json()
        wid = ws_list[0]["id"]

        inv = requests.post(f"{API}/workspaces/{wid}/invite", headers=h,
                            json={"email": eb}, timeout=20)
        assert inv.status_code == 200, inv.text
        assert inv.json().get("added") == ub["user_id"]

        # verify membership in DB
        ws_doc = _db.workspaces.find_one({"id": wid}, {"_id": 0})
        assert ub["user_id"] in (ws_doc.get("member_ids") or [])

        # remove member
        rem = requests.delete(f"{API}/workspaces/{wid}/members/{ub['user_id']}",
                              headers=h, timeout=20)
        assert rem.status_code == 200

        # invite unknown email → 404
        inv404 = requests.post(f"{API}/workspaces/{wid}/invite", headers=h,
                               json={"email": f"nobody_{uuid.uuid4().hex[:6]}@x.com"}, timeout=20)
        assert inv404.status_code == 404

    def test_multi_tenant_isolation_bearer(self, user_a, user_b):
        ta, _, _ = user_a
        tb, _, _ = user_b
        pa = requests.post(f"{API}/properties", headers=_bearer(ta), json={
            "name": "TEST_i6_ISO_A", "address": "A", "currency": "EUR"}, timeout=20).json()
        pb = requests.get(f"{API}/properties", headers=_bearer(tb), timeout=20).json()
        assert all(p["id"] != pa["id"] for p in pb)
        # B cannot access A's workspace with X-Workspace-Id
        ws_a = requests.get(f"{API}/workspaces", headers=_bearer(ta), timeout=20).json()[0]
        r = requests.get(f"{API}/properties",
                         headers={**_bearer(tb), "X-Workspace-Id": ws_a["id"]}, timeout=20)
        assert r.status_code == 403

    def test_401_on_non_auth_endpoints_without_token(self, disable_recaptcha_env):
        for path in ["/properties", "/units", "/tenants", "/invoices",
                     "/reservations", "/fixed-expenses", "/bank/transactions",
                     "/history/months", "/dashboard/stats", "/workspaces"]:
            r = requests.get(f"{API}{path}", timeout=15)
            assert r.status_code == 401, f"{path} -> {r.status_code}"

    def test_me_still_401_cleanly(self, disable_recaptcha_env):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer bogus-token"}, timeout=15)
        assert r.status_code == 401


# ======================================================================
# Safety net: ensure .env is always restored even if fixture teardown races
# ======================================================================
@pytest.fixture(scope="session", autouse=True)
def _safety_restore_env():
    snapshot = _read_env()
    yield
    cur = _read_env()
    if "RECAPTCHA_SECRET_KEY=" in cur and "RECAPTCHA_SECRET_KEY=6Lf" not in cur:
        # was emptied and never restored — put snapshot back
        _write_env(snapshot)
