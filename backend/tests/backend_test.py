"""
Iter 4 backend tests: Auth, Workspaces (isolation + invite), multi-currency,
Dashboard new fields, History snapshots, Bank upload/CRUD, regression.

Runs against REACT_APP_BACKEND_URL (public). Seeds 2 users + 2 sessions
directly into Mongo (db.users, db.user_sessions) so we don't need the
OAuth provider. Cleans up TEST_ prefixed data after each test class.
"""
import io
import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://property-manager-pro-19.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

_mc = MongoClient(MONGO_URL)
_db = _mc[DB_NAME]


def _seed_user(suffix: str):
    # NOTE: suffix lowered because backend's /workspaces/{wid}/invite lowercases
    # the incoming email before DB lookup but /auth/session stores the email as-is.
    # A mixed-case email in DB would never match an invite — see action item in report.
    suffix = suffix.lower()
    uid = f"TEST_user_{suffix}_{uuid.uuid4().hex[:8]}"
    token = f"TEST_sess_{suffix}_{uuid.uuid4().hex}"
    email = f"test_{suffix}_{uuid.uuid4().hex[:6]}@example.com"
    _db.users.insert_one({
        "user_id": uid, "email": email, "name": f"Test {suffix}",
        "picture": "", "created_at": datetime.now(timezone.utc).isoformat(),
    })
    _db.user_sessions.insert_one({
        "user_id": uid, "session_token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return uid, token, email


@pytest.fixture(scope="module")
def users():
    a = _seed_user("A")
    b = _seed_user("B")
    yield {"A": a, "B": b}
    # cleanup
    for uid, tok, email in (a, b):
        _db.users.delete_many({"user_id": uid})
        _db.user_sessions.delete_many({"user_id": uid})
        # cascade cleanup
        ws_ids = [w["id"] for w in _db.workspaces.find({"$or": [{"owner_id": uid}, {"member_ids": uid}]}, {"id": 1})]
        for wid in ws_ids:
            for coll in ("properties", "units", "tenants", "invoices", "reservations",
                         "fixed_expenses", "bank_transactions", "monthly_snapshots"):
                _db[coll].delete_many({"workspace_id": wid})
        _db.workspaces.delete_many({"$or": [{"owner_id": uid}, {"member_ids": uid}]})


def _h(token, ws_id=None):
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    if ws_id:
        h["X-Workspace-Id"] = ws_id
    return h


# ---------- AUTH ----------
class TestAuth:
    def test_me_unauth_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_me_with_bearer(self, users):
        _, tok, email = users["A"]
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(tok))
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == email
        assert "_id" not in d

    def test_logout_invalidates(self, users):
        # Logout endpoint reads session_token from cookie (not Authorization header).
        # We validate the cookie-based flow which matches the frontend integration.
        uid, tok, _ = _seed_user("logout")
        s = requests.Session()
        s.cookies.set("session_token", tok)
        r = s.post(f"{BASE_URL}/api/auth/logout")
        assert r.status_code == 200
        # After logout, the session row is gone → bearer also stops working
        r2 = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(tok))
        assert r2.status_code == 401
        _db.users.delete_many({"user_id": uid})


# ---------- WORKSPACES ----------
class TestWorkspaces:
    def test_default_workspace_created(self, users):
        _, tok, _ = users["A"]
        r = requests.get(f"{BASE_URL}/api/workspaces", headers=_h(tok))
        assert r.status_code == 200
        lst = r.json()
        assert isinstance(lst, list) and len(lst) >= 1
        for w in lst:
            assert "_id" not in w
            assert "id" in w and "owner_id" in w

    def test_workspace_isolation(self, users):
        _, tokA, _ = users["A"]
        _, tokB, _ = users["B"]
        # property created by A (uses A's default workspace)
        r = requests.post(f"{BASE_URL}/api/properties", headers=_h(tokA),
                          json={"name": "TEST_IsolProp", "address": "Calle A", "currency": "EUR"})
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        # B should not see it
        rb = requests.get(f"{BASE_URL}/api/properties", headers=_h(tokB))
        assert rb.status_code == 200
        assert all(p["id"] != pid for p in rb.json())
        # A sees it
        ra = requests.get(f"{BASE_URL}/api/properties", headers=_h(tokA))
        assert any(p["id"] == pid for p in ra.json())

    def test_update_workspace_currency_rates(self, users):
        _, tok, _ = users["A"]
        ws = requests.get(f"{BASE_URL}/api/workspaces", headers=_h(tok)).json()[0]
        payload = {"name": ws["name"], "display_currency": "EUR",
                   "exchange_rates": {"USD": 0.92, "GBP": 1.18}}
        r = requests.put(f"{BASE_URL}/api/workspaces/{ws['id']}", headers=_h(tok), json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["display_currency"] == "EUR"
        assert d["exchange_rates"]["USD"] == 0.92

    def test_invite_cross_workspace_access(self, users):
        uidA, tokA, _ = users["A"]
        uidB, tokB, emailB = users["B"]
        wsA = requests.get(f"{BASE_URL}/api/workspaces", headers=_h(tokA)).json()[0]
        r = requests.post(f"{BASE_URL}/api/workspaces/{wsA['id']}/invite",
                          headers=_h(tokA), json={"email": emailB})
        assert r.status_code == 200, r.text
        # B now lists the shared workspace
        wsB_list = requests.get(f"{BASE_URL}/api/workspaces", headers=_h(tokB)).json()
        assert any(w["id"] == wsA["id"] for w in wsB_list)
        # B can list props of the shared workspace using X-Workspace-Id
        props = requests.get(f"{BASE_URL}/api/properties", headers=_h(tokB, wsA["id"]))
        assert props.status_code == 200

    def test_wrong_workspace_id_forbidden(self, users):
        _, tokA, _ = users["A"]
        r = requests.get(f"{BASE_URL}/api/properties",
                         headers=_h(tokA, f"nonexistent-{uuid.uuid4()}"))
        assert r.status_code == 403


# ---------- MULTI-CURRENCY DASHBOARD ----------
class TestCurrency:
    def test_property_currency_conversion_in_dashboard(self, users):
        _, tok, _ = users["A"]
        ws = requests.get(f"{BASE_URL}/api/workspaces", headers=_h(tok)).json()[0]
        # ensure EUR display + USD rate
        requests.put(f"{BASE_URL}/api/workspaces/{ws['id']}", headers=_h(tok),
                     json={"name": ws["name"], "display_currency": "EUR",
                           "exchange_rates": {"USD": 0.50}})
        # baseline dashboard
        base = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=_h(tok)).json()
        base_income = base["monthly_income"]
        # create USD property + tenant
        p = requests.post(f"{BASE_URL}/api/properties", headers=_h(tok),
                          json={"name": "TEST_USD", "address": "NY", "currency": "USD"}).json()
        t = requests.post(f"{BASE_URL}/api/tenants", headers=_h(tok),
                          json={"name": "TEST_TenantUSD", "property_id": p["id"],
                                "monthly_rent": 1000.0, "split_percentage": 100}).json()
        try:
            stats = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=_h(tok)).json()
            # USD 1000 * 0.50 = 500 EUR
            delta = stats["monthly_income"] - base_income
            assert abs(delta - 500.0) < 0.01, f"Expected +500 EUR, got {delta}"
            assert stats["display_currency"] == "EUR"
        finally:
            requests.delete(f"{BASE_URL}/api/tenants/{t['id']}", headers=_h(tok))
            requests.delete(f"{BASE_URL}/api/properties/{p['id']}", headers=_h(tok))


# ---------- DASHBOARD FIELDS ----------
class TestDashboard:
    def test_dashboard_has_new_fields(self, users):
        _, tok, _ = users["A"]
        r = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=_h(tok))
        assert r.status_code == 200
        d = r.json()
        for k in ("total_income", "vacation_income", "invoice_iva", "invoice_retenciones",
                  "invoice_net", "fixed_expenses_monthly", "monthly_expenses",
                  "net_income", "occupancy_rate", "display_currency"):
            assert k in d, f"Missing field {k}"

    def test_dashboard_year_month_filter(self, users):
        _, tok, _ = users["A"]
        r = requests.get(f"{BASE_URL}/api/dashboard/stats?year_month=2099-01", headers=_h(tok))
        assert r.status_code == 200
        assert r.json()["year_month"] == "2099-01"


# ---------- HISTORY ----------
class TestHistory:
    def test_close_list_year(self, users):
        _, tok, _ = users["A"]
        ym = "2099-03"
        r = requests.post(f"{BASE_URL}/api/history/close", headers=_h(tok), json={"year_month": ym})
        assert r.status_code == 200
        snap = r.json()
        assert snap["year_month"] == ym and "stats" in snap and "_id" not in snap
        # second close upserts
        requests.post(f"{BASE_URL}/api/history/close", headers=_h(tok), json={"year_month": ym})
        # list
        lst = requests.get(f"{BASE_URL}/api/history/months", headers=_h(tok)).json()
        assert any(s["year_month"] == ym for s in lst)
        # year aggregate
        ya = requests.get(f"{BASE_URL}/api/history/year/2099", headers=_h(tok)).json()
        assert ya["year"] == 2099
        for k in ("total_income", "monthly_expenses", "invoice_iva", "invoice_retenciones", "net_income"):
            assert k in ya["totals"]


# ---------- BANK ----------
class TestBank:
    def test_bank_upload_csv(self, users):
        _, tok, _ = users["A"]
        csv = "fecha,concepto,importe\n2025-03-01,Alquiler Juan Perez,850.00\n2025-03-02,Luz Iberdrola,-75.30\n"
        files = {"file": ("statement.csv", io.BytesIO(csv.encode()), "text/csv")}
        headers = {"Authorization": f"Bearer {tok}"}
        r = requests.post(f"{BASE_URL}/api/bank/upload", files=files, headers=headers, timeout=60)
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list) and len(rows) == 2
        for row in rows:
            for k in ("date", "description", "amount", "direction", "category",
                      "matched_property_id", "matched_tenant_id"):
                assert k in row
        # direction is correct for +ve / -ve
        assert rows[0]["direction"] == "in"
        assert rows[1]["direction"] == "out"

    def test_bank_crud(self, users):
        _, tok, _ = users["A"]
        # create
        r = requests.post(f"{BASE_URL}/api/bank/transactions", headers=_h(tok),
                          json={"date": "2025-03-05", "description": "TEST_tx",
                                "amount": 100.0, "direction": "in", "category": "rent"})
        assert r.status_code == 200
        bid = r.json()["id"]
        # list
        lst = requests.get(f"{BASE_URL}/api/bank/transactions", headers=_h(tok)).json()
        assert any(b["id"] == bid for b in lst)
        assert all("_id" not in b for b in lst)
        # update
        u = requests.put(f"{BASE_URL}/api/bank/transactions/{bid}", headers=_h(tok),
                        json={"date": "2025-03-05", "description": "TEST_tx2",
                              "amount": 150.0, "direction": "in", "category": "rent"})
        assert u.status_code == 200 and u.json()["amount"] == 150.0
        # bulk
        b = requests.post(f"{BASE_URL}/api/bank/transactions/bulk", headers=_h(tok),
                         json=[{"date": "2025-03-06", "description": "TEST_b1",
                                "amount": 10, "direction": "in", "category": "other"}])
        assert b.status_code == 200 and b.json()["count"] == 1
        # delete
        d = requests.delete(f"{BASE_URL}/api/bank/transactions/{bid}", headers=_h(tok))
        assert d.status_code == 200


# ---------- REGRESSION ----------
class TestRegression:
    def test_full_resource_crud_scoped(self, users):
        _, tok, _ = users["A"]
        p = requests.post(f"{BASE_URL}/api/properties", headers=_h(tok),
                         json={"name": "TEST_Reg", "address": "X"}).json()
        u = requests.post(f"{BASE_URL}/api/units", headers=_h(tok),
                         json={"property_id": p["id"], "name": "U1",
                               "unit_type": "apartment", "rent_amount": 500}).json()
        t = requests.post(f"{BASE_URL}/api/tenants", headers=_h(tok),
                         json={"name": "TEST_TenReg", "property_id": p["id"],
                               "unit_id": u["id"], "monthly_rent": 500,
                               "split_percentage": 50}).json()
        fe = requests.post(f"{BASE_URL}/api/fixed-expenses", headers=_h(tok),
                          json={"property_id": p["id"], "name": "TEST_FE",
                                "amount": 120, "frequency": "monthly"}).json()
        rv = requests.post(f"{BASE_URL}/api/reservations", headers=_h(tok),
                          json={"unit_id": u["id"], "guest_name": "G",
                                "check_in": "2025-03-01", "check_out": "2025-03-05",
                                "nights": 4, "total_amount": 400}).json()
        ps = requests.get(f"{BASE_URL}/api/tenants/percentage-summary", headers=_h(tok)).json()
        assert ps.get(p["id"], 0) >= 50
        # all entities have no _id
        for obj in (p, u, t, fe, rv):
            assert "_id" not in obj and "workspace_id" in obj
        # cleanup
        requests.delete(f"{BASE_URL}/api/reservations/{rv['id']}", headers=_h(tok))
        requests.delete(f"{BASE_URL}/api/fixed-expenses/{fe['id']}", headers=_h(tok))
        requests.delete(f"{BASE_URL}/api/tenants/{t['id']}", headers=_h(tok))
        requests.delete(f"{BASE_URL}/api/units/{u['id']}", headers=_h(tok))
        requests.delete(f"{BASE_URL}/api/properties/{p['id']}", headers=_h(tok))
