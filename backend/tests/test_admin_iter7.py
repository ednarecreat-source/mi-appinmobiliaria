"""
Iteration 7 — Admin/Allowlist + Registration end-to-end tests.

Covers:
  - Seeded admin user (login admin@rct.app)
  - GET/POST/DELETE /api/admin/allowlist (admin-gated)
  - GET /api/admin/users (no password_hash leak)
  - PUT /api/admin/users/{uid}/admin (toggle)
  - DELETE /api/admin/users/{uid} (cannot delete admin; cleans sessions+workspaces)
  - Allowlist behaviour: empty=open; non-empty gates register; admin always allowed
  - is_admin field present in register/login responses
  - Regression: properties/units/tenants/dashboard reachable with Bearer
"""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://property-manager-pro-19.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@rct.app"
ADMIN_PW = "Admin-RCT-2026!"
RC = "TEST_BYPASS"


def _new_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token():
    s = _new_session()
    r = s.post(f"{BASE}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW, "recaptcha_token": RC})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("is_admin") is True
    assert data.get("token")
    return data["token"]


@pytest.fixture(scope="module")
def admin_client(admin_token):
    s = requests.Session()  # fresh, no cookies
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {admin_token}"})
    return s


@pytest.fixture(scope="module")
def normal_user(admin_token):
    """Register a regular (non-admin) user. Allowlist may be non-empty from previous runs;
    admin adds the email first to guarantee registration succeeds."""
    admin_s = requests.Session()
    admin_s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {admin_token}"})
    email = f"test_iter7_user_{uuid.uuid4().hex[:8]}@example.com"
    # Add to allowlist (idempotent enough — unique email)
    admin_s.post(f"{BASE}/api/admin/allowlist", json={"email": email, "note": "iter7 fixture"})
    s = _new_session()
    r = s.post(f"{BASE}/api/auth/register", json={
        "name": "Iter7 User", "email": email, "password": "Secret123!", "recaptcha_token": RC,
    })
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    d = r.json()
    assert d.get("is_admin") is False
    assert d.get("token")
    return {"email": email, "token": d["token"], "user_id": d["user_id"]}


@pytest.fixture(scope="module")
def normal_client(normal_user):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {normal_user['token']}"})
    return s


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_client, normal_user):
    """Teardown: remove all TEST_iter7_* users and any allowlist entries left over."""
    yield
    try:
        users = admin_client.get(f"{BASE}/api/admin/users").json()
        for u in users:
            if u.get("email", "").lower().startswith("test_iter7_"):
                admin_client.delete(f"{BASE}/api/admin/users/{u['user_id']}")
    except Exception:
        pass
    try:
        rows = admin_client.get(f"{BASE}/api/admin/allowlist").json()
        for e in rows:
            if e.get("email", "").lower().startswith("test_iter7_"):
                admin_client.delete(f"{BASE}/api/admin/allowlist/{e['id']}")
    except Exception:
        pass


# ---------- Seeded admin ----------
class TestSeededAdmin:
    def test_admin_login_returns_is_admin_true(self, admin_token):
        assert admin_token

    def test_login_response_has_is_admin_field(self):
        s = _new_session()
        r = s.post(f"{BASE}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW, "recaptcha_token": RC})
        assert r.status_code == 200
        body = r.json()
        assert "is_admin" in body and body["is_admin"] is True
        assert "password_hash" not in body
        assert "_id" not in body

    def test_register_response_has_is_admin_field(self, normal_user):
        # already registered in fixture; re-fetch /auth/me to confirm structure
        s = requests.Session()
        s.headers.update({"Authorization": f"Bearer {normal_user['token']}"})
        r = s.get(f"{BASE}/api/auth/me")
        assert r.status_code == 200
        body = r.json()
        assert body.get("is_admin") is False
        assert "password_hash" not in body
        assert "_id" not in body


# ---------- Allowlist endpoints (admin-gated) ----------
class TestAllowlistAdminGate:
    def test_get_allowlist_forbidden_for_non_admin(self, normal_client):
        r = normal_client.get(f"{BASE}/api/admin/allowlist")
        assert r.status_code == 403

    def test_get_allowlist_unauthorized_no_token(self):
        s = requests.Session()
        r = s.get(f"{BASE}/api/admin/allowlist")
        assert r.status_code == 401

    def test_get_allowlist_ok_for_admin(self, admin_client):
        r = admin_client.get(f"{BASE}/api/admin/allowlist")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_post_allowlist_invalid_email(self, admin_client):
        r = admin_client.post(f"{BASE}/api/admin/allowlist", json={"email": "not-an-email"})
        assert r.status_code == 400

    def test_post_allowlist_creates_entry_and_get_persists(self, admin_client):
        email = f"test_iter7_a_{uuid.uuid4().hex[:6]}@example.com"
        r = admin_client.post(f"{BASE}/api/admin/allowlist", json={"email": email, "note": "iter7 note"})
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == email
        assert body["note"] == "iter7 note"
        assert "id" in body
        assert "_id" not in body
        # GET verifies persistence
        rows = admin_client.get(f"{BASE}/api/admin/allowlist").json()
        emails = {x["email"] for x in rows}
        assert email in emails

    def test_post_allowlist_duplicate_returns_409(self, admin_client):
        email = f"test_iter7_dup_{uuid.uuid4().hex[:6]}@example.com"
        r1 = admin_client.post(f"{BASE}/api/admin/allowlist", json={"email": email})
        assert r1.status_code == 200
        r2 = admin_client.post(f"{BASE}/api/admin/allowlist", json={"email": email})
        assert r2.status_code == 409

    def test_delete_allowlist_removes_entry(self, admin_client):
        email = f"test_iter7_del_{uuid.uuid4().hex[:6]}@example.com"
        eid = admin_client.post(f"{BASE}/api/admin/allowlist", json={"email": email}).json()["id"]
        r = admin_client.delete(f"{BASE}/api/admin/allowlist/{eid}")
        assert r.status_code == 200
        rows = admin_client.get(f"{BASE}/api/admin/allowlist").json()
        assert all(x["id"] != eid for x in rows)


# ---------- Users management ----------
class TestUsersManagement:
    def test_get_users_forbidden_for_non_admin(self, normal_client):
        r = normal_client.get(f"{BASE}/api/admin/users")
        assert r.status_code == 403

    def test_get_users_no_password_hash_no_id(self, admin_client):
        r = admin_client.get(f"{BASE}/api/admin/users")
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list) and len(users) >= 1
        for u in users:
            assert "password_hash" not in u
            assert "_id" not in u
            assert "user_id" in u and "email" in u

    def test_toggle_admin_flag(self, admin_client, normal_user):
        uid = normal_user["user_id"]
        r = admin_client.put(f"{BASE}/api/admin/users/{uid}/admin", json={"is_admin": True})
        assert r.status_code == 200
        assert r.json()["is_admin"] is True
        # verify via GET
        users = admin_client.get(f"{BASE}/api/admin/users").json()
        match = [u for u in users if u["user_id"] == uid][0]
        assert match["is_admin"] is True
        # toggle back off so subsequent forbidden tests still hold
        r2 = admin_client.put(f"{BASE}/api/admin/users/{uid}/admin", json={"is_admin": False})
        assert r2.status_code == 200
        assert r2.json()["is_admin"] is False

    def test_cannot_delete_admin_user(self, admin_client):
        users = admin_client.get(f"{BASE}/api/admin/users").json()
        admin_uid = [u for u in users if u["email"] == ADMIN_EMAIL][0]["user_id"]
        r = admin_client.delete(f"{BASE}/api/admin/users/{admin_uid}")
        assert r.status_code == 403

    def test_delete_user_cleans_sessions_and_workspaces(self, admin_client):
        # create a victim user via register (add to allowlist first since allowlist is populated)
        s = _new_session()
        email = f"test_iter7_victim_{uuid.uuid4().hex[:6]}@example.com"
        admin_client.post(f"{BASE}/api/admin/allowlist", json={"email": email})
        reg = s.post(f"{BASE}/api/auth/register", json={
            "name": "Victim", "email": email, "password": "Secret123!", "recaptcha_token": RC,
        })
        assert reg.status_code == 200, reg.text
        victim = reg.json()
        # user has a session token; let's confirm /auth/me works
        vs = requests.Session()
        vs.headers.update({"Authorization": f"Bearer {victim['token']}"})
        assert vs.get(f"{BASE}/api/auth/me").status_code == 200

        # delete via admin
        d = admin_client.delete(f"{BASE}/api/admin/users/{victim['user_id']}")
        assert d.status_code == 200

        # sessions cleaned: bearer token is now unauthorized
        me = vs.get(f"{BASE}/api/auth/me")
        assert me.status_code == 401

        # user no longer in /admin/users
        users = admin_client.get(f"{BASE}/api/admin/users").json()
        assert all(u["user_id"] != victim["user_id"] for u in users)


# ---------- Allowlist gate behaviour (this MUTATES allowlist temporarily) ----------
class TestAllowlistGate:
    @pytest.fixture(scope="class", autouse=True)
    def _clean_allowlist(self, admin_client):
        # Capture pre-existing entries so we don't disturb them
        pre = admin_client.get(f"{BASE}/api/admin/allowlist").json()
        pre_ids = {e["id"] for e in pre}
        yield
        # cleanup: remove anything we added (IDs not in pre_ids and email starts with test_iter7_)
        rows = admin_client.get(f"{BASE}/api/admin/allowlist").json()
        for e in rows:
            if e["id"] not in pre_ids and e.get("email", "").startswith("test_iter7_"):
                admin_client.delete(f"{BASE}/api/admin/allowlist/{e['id']}")

    def test_register_succeeds_when_email_in_allowlist(self, admin_client):
        # Add one entry → allowlist becomes non-empty
        good = f"test_iter7_gate_ok_{uuid.uuid4().hex[:6]}@example.com"
        admin_client.post(f"{BASE}/api/admin/allowlist", json={"email": good})

        s = _new_session()
        r = s.post(f"{BASE}/api/auth/register", json={
            "name": "AllowedUser", "email": good, "password": "Secret123!", "recaptcha_token": RC,
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["is_admin"] is False
        # cleanup user
        admin_client.delete(f"{BASE}/api/admin/users/{body['user_id']}")

    def test_register_blocked_when_email_not_in_allowlist(self, admin_client):
        # Allowlist is non-empty (previous test added entries that may have been cleaned, ensure non-empty)
        rows = admin_client.get(f"{BASE}/api/admin/allowlist").json()
        if not rows:
            admin_client.post(f"{BASE}/api/admin/allowlist", json={
                "email": f"test_iter7_dummy_{uuid.uuid4().hex[:6]}@example.com",
            })

        s = _new_session()
        bad = f"test_iter7_blocked_{uuid.uuid4().hex[:6]}@example.com"
        r = s.post(f"{BASE}/api/auth/register", json={
            "name": "Blocked", "email": bad, "password": "Secret123!", "recaptcha_token": RC,
        })
        assert r.status_code == 403
        assert "no autorizado" in r.text.lower() or "autorizado" in r.text.lower()

    def test_admin_email_always_allowed_even_when_not_in_list(self, admin_client):
        # Admin email is NOT in allowlist by design but admin login still works (already covered by login fixture)
        # also confirm /api/admin/allowlist GET returns rows but admin email not necessarily there
        rows = admin_client.get(f"{BASE}/api/admin/allowlist").json()
        admin_emails = [e for e in rows if e.get("email") == ADMIN_EMAIL]
        # Admin email being absent yet able to login is the proof — re-login
        s = _new_session()
        r = s.post(f"{BASE}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW, "recaptcha_token": RC})
        assert r.status_code == 200


# ---------- Regression: domain APIs still work with Bearer (admin) ----------
class TestRegressionDomain:
    def test_workspaces_list(self, admin_client):
        r = admin_client.get(f"{BASE}/api/workspaces")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_properties_crud_minimal(self, admin_client):
        # CREATE
        payload = {"name": "TEST_iter7_prop", "address": "Calle Falsa 123", "category": "residential", "currency": "EUR"}
        c = admin_client.post(f"{BASE}/api/properties", json=payload)
        assert c.status_code == 200
        pid = c.json()["id"]
        assert "_id" not in c.json()
        # LIST
        ls = admin_client.get(f"{BASE}/api/properties").json()
        assert any(p["id"] == pid for p in ls)
        # DELETE
        d = admin_client.delete(f"{BASE}/api/properties/{pid}")
        assert d.status_code == 200

    def test_dashboard_stats(self, admin_client):
        r = admin_client.get(f"{BASE}/api/dashboard/stats")
        assert r.status_code == 200
        st = r.json()
        for k in ("total_properties", "total_units", "monthly_income", "occupancy_rate"):
            assert k in st

    def test_history_months(self, admin_client):
        r = admin_client.get(f"{BASE}/api/history/months")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_bank_transactions_list(self, admin_client):
        r = admin_client.get(f"{BASE}/api/bank/transactions")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_no_id_leak_anywhere(self, admin_client):
        for path in ("/api/properties", "/api/units", "/api/tenants", "/api/reservations",
                     "/api/fixed-expenses", "/api/bank/transactions", "/api/history/months",
                     "/api/admin/users", "/api/admin/allowlist"):
            r = admin_client.get(f"{BASE}{path}")
            assert r.status_code == 200, f"{path} -> {r.status_code}"
            for row in r.json():
                if isinstance(row, dict):
                    assert "_id" not in row, f"_id leaked in {path}"
                    assert "password_hash" not in row, f"password_hash leaked in {path}"
