"""
Iter 5 backend tests: full auth refactor (email/password + Google direct)
+ regression of workspaces, properties, units, tenants, invoices, reservations,
fixed-expenses, bank, history, dashboard. Multi-tenant isolation. No _id leaks.

Only hits the public REACT_APP_BACKEND_URL. Uses Authorization: Bearer
<session_token> captured from /auth/register response cookies.
"""
import io
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

_mc = MongoClient(MONGO_URL)
_db = _mc[DB_NAME]

API = f"{BASE_URL}/api"


def _deep_check_no_id(obj, path=""):
    """Recursively assert no mongo _id leak."""
    if isinstance(obj, dict):
        assert "_id" not in obj, f"_id leaked at {path}: keys={list(obj.keys())}"
        for k, v in obj.items():
            _deep_check_no_id(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            _deep_check_no_id(v, f"{path}[{i}]")


def _register(suffix=None):
    """Helper: register a fresh user, return (session_token, user_dict)."""
    suf = suffix or uuid.uuid4().hex[:8]
    email = f"TEST_iter5_{suf}@example.com"
    payload = {"name": f"Tester {suf}", "email": email, "password": "Secret123!"}
    r = requests.post(f"{API}/auth/register", json=payload, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    user = r.json()
    token = r.cookies.get("session_token")
    assert token, "no session_token cookie set"
    return token, user, email


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ============== /auth/config ==============
class TestAuthConfig:
    def test_google_disabled_when_env_empty(self):
        r = requests.get(f"{API}/auth/config", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data["google_enabled"] is False
        assert data["google_client_id"] == ""
        _deep_check_no_id(data)


# ============== /auth/register ==============
class TestAuthRegister:
    def test_register_success_sets_cookie_and_hides_password(self):
        token, user, email = _register()
        assert user["email"] == email.lower()
        assert "password" not in user
        assert "password_hash" not in user
        assert user["name"].startswith("Tester ")
        # default workspace exists
        r = requests.get(f"{API}/workspaces", headers=_auth_headers(token), timeout=20)
        assert r.status_code == 200
        ws_list = r.json()
        assert len(ws_list) >= 1
        _deep_check_no_id(ws_list)
        # password_hash persisted in DB
        doc = _db.users.find_one({"email": email.lower()})
        assert doc and doc.get("password_hash") and doc["password_hash"].startswith("$2")
        # cleanup
        _db.users.delete_many({"email": email.lower()})
        _db.user_sessions.delete_many({"user_id": user["user_id"]})
        _db.workspaces.delete_many({"owner_id": user["user_id"]})

    def test_register_invalid_email(self):
        r = requests.post(f"{API}/auth/register",
                          json={"name": "X", "email": "not-an-email", "password": "abcdef"}, timeout=20)
        assert r.status_code == 400

    def test_register_short_password(self):
        r = requests.post(f"{API}/auth/register",
                          json={"name": "X", "email": f"TEST_short_{uuid.uuid4().hex[:6]}@e.com", "password": "abc"},
                          timeout=20)
        assert r.status_code == 400

    def test_register_empty_name(self):
        r = requests.post(f"{API}/auth/register",
                          json={"name": "   ", "email": f"TEST_noname_{uuid.uuid4().hex[:6]}@e.com", "password": "abcdef"},
                          timeout=20)
        assert r.status_code == 400

    def test_register_duplicate_email_returns_409(self):
        token, user, email = _register()
        r = requests.post(f"{API}/auth/register",
                          json={"name": "Dup", "email": email, "password": "another123"}, timeout=20)
        assert r.status_code == 409
        # cleanup
        _db.users.delete_many({"email": email.lower()})
        _db.user_sessions.delete_many({"user_id": user["user_id"]})
        _db.workspaces.delete_many({"owner_id": user["user_id"]})


# ============== /auth/login ==============
class TestAuthLogin:
    def test_login_success_and_invalid_password(self):
        token, user, email = _register()
        # valid login (case-insensitive email)
        r = requests.post(f"{API}/auth/login",
                          json={"email": email.upper(), "password": "Secret123!"}, timeout=20)
        assert r.status_code == 200
        assert r.json()["email"] == email.lower()
        assert r.cookies.get("session_token")
        # wrong password
        r2 = requests.post(f"{API}/auth/login",
                           json={"email": email, "password": "WRONG-pw"}, timeout=20)
        assert r2.status_code == 401
        # unknown email
        r3 = requests.post(f"{API}/auth/login",
                          json={"email": f"nobody_{uuid.uuid4().hex[:8]}@x.com", "password": "whatever"}, timeout=20)
        assert r3.status_code == 401
        # cleanup
        _db.users.delete_many({"email": email.lower()})
        _db.user_sessions.delete_many({"user_id": user["user_id"]})
        _db.workspaces.delete_many({"owner_id": user["user_id"]})

    def test_google_user_cannot_login_via_password(self):
        """Insert a Google-only user (no password_hash) directly, then try password login."""
        email = f"TEST_g_{uuid.uuid4().hex[:8]}@example.com"
        uid = f"user_{uuid.uuid4().hex[:12]}"
        _db.users.insert_one({
            "user_id": uid, "email": email, "name": "Google Only",
            "picture": "", "auth_provider": "google",
            "created_at": "2026-01-01T00:00:00+00:00",
        })
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": "anything123"}, timeout=20)
        assert r.status_code == 401
        _db.users.delete_many({"user_id": uid})


# ============== /auth/google ==============
class TestAuthGoogle:
    def test_google_returns_500_when_not_configured(self):
        # GOOGLE_CLIENT_ID is empty in env
        r = requests.post(f"{API}/auth/google",
                          json={"credential": "anything.that.looks.like.jwt"}, timeout=20)
        # Per spec: empty GOOGLE_CLIENT_ID => 500
        assert r.status_code == 500


# ============== /auth/me + logout ==============
class TestAuthMeLogout:
    def test_me_returns_user_without_password_hash(self):
        token, user, email = _register()
        r = requests.get(f"{API}/auth/me", headers=_auth_headers(token), timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == email.lower()
        assert "password_hash" not in data
        assert "password" not in data
        _deep_check_no_id(data)
        _db.users.delete_many({"email": email.lower()})
        _db.user_sessions.delete_many({"user_id": user["user_id"]})
        _db.workspaces.delete_many({"owner_id": user["user_id"]})

    def test_me_without_token_returns_401(self):
        r = requests.get(f"{API}/auth/me", timeout=20)
        assert r.status_code == 401

    def test_logout_invalidates_session(self):
        token, user, email = _register()
        r = requests.post(f"{API}/auth/logout", headers=_auth_headers(token), timeout=20)
        assert r.status_code == 200
        # subsequent /me should 401
        r2 = requests.get(f"{API}/auth/me", headers=_auth_headers(token), timeout=20)
        assert r2.status_code == 401
        _db.users.delete_many({"email": email.lower()})
        _db.user_sessions.delete_many({"user_id": user["user_id"]})
        _db.workspaces.delete_many({"owner_id": user["user_id"]})


# ============== REGRESSION: all domain endpoints under new auth ==============
@pytest.fixture(scope="module")
def user_a():
    token, user, email = _register("a")
    yield token, user, email
    _db.users.delete_many({"email": email.lower()})
    _db.user_sessions.delete_many({"user_id": user["user_id"]})
    ws_ids = [w["id"] for w in _db.workspaces.find({"owner_id": user["user_id"]}, {"id": 1})]
    for wid in ws_ids:
        for coll in ("properties", "units", "tenants", "invoices", "reservations",
                     "fixed_expenses", "bank_transactions", "monthly_snapshots"):
            _db[coll].delete_many({"workspace_id": wid})
    _db.workspaces.delete_many({"owner_id": user["user_id"]})


@pytest.fixture(scope="module")
def user_b():
    token, user, email = _register("b")
    yield token, user, email
    _db.users.delete_many({"email": email.lower()})
    _db.user_sessions.delete_many({"user_id": user["user_id"]})
    ws_ids = [w["id"] for w in _db.workspaces.find({"owner_id": user["user_id"]}, {"id": 1})]
    for wid in ws_ids:
        for coll in ("properties", "units", "tenants", "invoices", "reservations",
                     "fixed_expenses", "bank_transactions", "monthly_snapshots"):
            _db[coll].delete_many({"workspace_id": wid})
    _db.workspaces.delete_many({"owner_id": user["user_id"]})


class TestRegression:
    def test_properties_crud_and_no_id_leak(self, user_a):
        token, _, _ = user_a
        h = _auth_headers(token)
        # create
        r = requests.post(f"{API}/properties", headers=h,
                          json={"name": "TEST_Prop_A", "address": "Calle 1", "currency": "EUR"}, timeout=20)
        assert r.status_code == 200
        prop = r.json()
        pid = prop["id"]
        _deep_check_no_id(prop)
        # list
        r2 = requests.get(f"{API}/properties", headers=h, timeout=20)
        assert r2.status_code == 200
        items = r2.json()
        assert any(p["id"] == pid for p in items)
        _deep_check_no_id(items)
        # update
        r3 = requests.put(f"{API}/properties/{pid}", headers=h,
                          json={"name": "TEST_Prop_A2", "address": "Calle 2", "currency": "USD"}, timeout=20)
        assert r3.status_code == 200
        assert r3.json()["currency"] == "USD"
        # delete
        r4 = requests.delete(f"{API}/properties/{pid}", headers=h, timeout=20)
        assert r4.status_code == 200

    def test_units_tenants_reservations_fixed_expenses(self, user_a):
        token, _, _ = user_a
        h = _auth_headers(token)
        # property
        p = requests.post(f"{API}/properties", headers=h,
                          json={"name": "TEST_P_full", "address": "X", "currency": "EUR"}, timeout=20).json()
        pid = p["id"]
        # unit
        u = requests.post(f"{API}/units", headers=h, json={
            "property_id": pid, "name": "U1", "unit_type": "apartment",
            "rental_mode": "long_term", "rent_amount": 800}, timeout=20)
        assert u.status_code == 200
        uid = u.json()["id"]
        # tenant
        t = requests.post(f"{API}/tenants", headers=h, json={
            "name": "TEST_Tenant", "email": "t@e.com", "property_id": pid,
            "unit_id": uid, "split_percentage": 100, "monthly_rent": 800}, timeout=20)
        assert t.status_code == 200
        # reservation
        r = requests.post(f"{API}/reservations", headers=h, json={
            "unit_id": uid, "guest_name": "G", "check_in": "2026-01-10",
            "check_out": "2026-01-15", "rate_type": "daily", "nights": 5,
            "total_amount": 500}, timeout=20)
        assert r.status_code == 200
        # fixed expense
        fe = requests.post(f"{API}/fixed-expenses", headers=h, json={
            "property_id": pid, "name": "IBI", "category": "tax",
            "amount": 1200, "frequency": "yearly"}, timeout=20)
        assert fe.status_code == 200
        # dashboard stats
        ds = requests.get(f"{API}/dashboard/stats", headers=h, timeout=20)
        assert ds.status_code == 200
        stats = ds.json()
        for k in ("total_income", "monthly_expenses", "net_income",
                  "fixed_expenses_monthly", "invoice_net", "occupancy_rate"):
            assert k in stats
        _deep_check_no_id(stats)
        # tenants/percentage-summary
        ps = requests.get(f"{API}/tenants/percentage-summary", headers=h, timeout=20)
        assert ps.status_code == 200
        assert ps.json().get(pid) == 100.0

    def test_bank_and_history(self, user_a):
        token, _, _ = user_a
        h = _auth_headers(token)
        # manual bank tx
        r = requests.post(f"{API}/bank/transactions", headers=h, json={
            "date": "2026-01-05", "description": "Test rent in",
            "amount": 800, "direction": "in", "category": "rent"}, timeout=20)
        assert r.status_code == 200
        bid = r.json()["id"]
        # bulk
        rb = requests.post(f"{API}/bank/transactions/bulk", headers=h, json=[
            {"date": "2026-01-06", "description": "T2", "amount": 50, "direction": "out", "category": "utility"}
        ], timeout=20)
        assert rb.status_code == 200
        # list
        rl = requests.get(f"{API}/bank/transactions", headers=h, timeout=20)
        assert rl.status_code == 200
        _deep_check_no_id(rl.json())
        # update
        ru = requests.put(f"{API}/bank/transactions/{bid}", headers=h, json={
            "date": "2026-01-05", "description": "Test rent in v2",
            "amount": 900, "direction": "in", "category": "rent",
            "reconciled": True}, timeout=20)
        assert ru.status_code == 200 and ru.json()["reconciled"] is True
        # delete
        rd = requests.delete(f"{API}/bank/transactions/{bid}", headers=h, timeout=20)
        assert rd.status_code == 200
        # history close/list/delete
        rc = requests.post(f"{API}/history/close", headers=h, json={"year_month": "2026-01"}, timeout=25)
        assert rc.status_code == 200
        snap_id = rc.json()["id"]
        rm = requests.get(f"{API}/history/months", headers=h, timeout=20)
        assert rm.status_code == 200 and any(s["year_month"] == "2026-01" for s in rm.json())
        _deep_check_no_id(rm.json())
        ry = requests.get(f"{API}/history/year/2026", headers=h, timeout=20)
        assert ry.status_code == 200 and ry.json()["year"] == 2026
        rdel = requests.delete(f"{API}/history/{snap_id}", headers=h, timeout=20)
        assert rdel.status_code == 200

    def test_workspaces_crud_and_multi_currency(self, user_a):
        token, user, _ = user_a
        h = _auth_headers(token)
        # create new workspace
        r = requests.post(f"{API}/workspaces", headers=h, json={
            "name": "TEST_WS_USD", "display_currency": "USD",
            "exchange_rates": {"EUR": 1.1}}, timeout=20)
        assert r.status_code == 200
        ws = r.json()
        assert ws["display_currency"] == "USD"
        # update
        ru = requests.put(f"{API}/workspaces/{ws['id']}", headers=h, json={
            "name": "TEST_WS_USD2", "display_currency": "USD",
            "exchange_rates": {"EUR": 1.2}}, timeout=20)
        assert ru.status_code == 200 and ru.json()["exchange_rates"]["EUR"] == 1.2
        # use workspace via X-Workspace-Id header
        rh = {**h, "X-Workspace-Id": ws["id"]}
        rp = requests.post(f"{API}/properties", headers=rh, json={
            "name": "TEST_P_USD", "address": "Y", "currency": "EUR"}, timeout=20)
        assert rp.status_code == 200
        # dashboard in that workspace uses USD
        ds = requests.get(f"{API}/dashboard/stats", headers=rh, timeout=20)
        assert ds.status_code == 200
        assert ds.json()["display_currency"] == "USD"

    def test_workspace_access_denied_for_other_user(self, user_a, user_b):
        ta, ua, _ = user_a
        tb, ub, _ = user_b
        # find a workspace of A
        ws_a = requests.get(f"{API}/workspaces", headers=_auth_headers(ta), timeout=20).json()[0]
        # B tries to access A's workspace
        r = requests.get(f"{API}/properties",
                         headers={**_auth_headers(tb), "X-Workspace-Id": ws_a["id"]}, timeout=20)
        assert r.status_code == 403

    def test_multi_tenant_isolation(self, user_a, user_b):
        ta, _, _ = user_a
        tb, _, _ = user_b
        # A creates property in A's default ws
        pa = requests.post(f"{API}/properties", headers=_auth_headers(ta), json={
            "name": "TEST_ISO_A", "address": "A", "currency": "EUR"}, timeout=20).json()
        # B lists properties in B's default ws — must not see A's
        pb_list = requests.get(f"{API}/properties", headers=_auth_headers(tb), timeout=20).json()
        assert all(p["id"] != pa["id"] for p in pb_list)
        assert all(p["name"] != "TEST_ISO_A" for p in pb_list)

    def test_unauth_domain_endpoints_return_401(self):
        for path in ["/properties", "/units", "/tenants", "/invoices",
                     "/reservations", "/fixed-expenses", "/bank/transactions",
                     "/history/months", "/dashboard/stats", "/workspaces"]:
            r = requests.get(f"{API}{path}", timeout=15)
            assert r.status_code == 401, f"{path} returned {r.status_code}"
