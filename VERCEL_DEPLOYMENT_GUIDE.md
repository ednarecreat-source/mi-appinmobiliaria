# ⚠️ Guía: Registro no funciona en Vercel

## El problema más común

**Vercel solo aloja FRONTEND estático.** No corre Python ni FastAPI. Si solo desplegaste el repo en Vercel, el backend no existe en producción y por eso `/api/auth/register` falla.

Necesitas **dos servicios separados**:
1. **Frontend (React)** → Vercel
2. **Backend (FastAPI)** → Railway / Render / Fly.io
3. **Base de datos** → MongoDB Atlas (gratis)

---

## ✅ Diagnóstico paso a paso

### 1) Verifica que tu backend está desplegado y accesible

Desde tu navegador o terminal, abre la URL de tu backend (ej: `https://rct-backend.up.railway.app/api/health`). Debe devolver algo como:

```json
{
  "ok": true,
  "database": {"connected": true, "name": "rct_inmobiliaria", "url_set": true, "error": null},
  "auth": {"google_enabled": true, "recaptcha_enabled": true},
  "ai": {"emergent_llm_key_set": true}
}
```

**Si NO funciona:**
- ❌ `Cannot GET /api/health` → tu backend no está desplegado o la URL es incorrecta
- ❌ `"connected": false` → MongoDB no conecta. Sigue al paso 2.
- ❌ `"url_set": false` → falta la variable `MONGO_URL` en Railway/Render

### 2) Configurar MongoDB Atlas (gratis)

1. Crea cuenta en https://www.mongodb.com/cloud/atlas
2. **Build a Cluster** → M0 Free (512 MB)
3. **Database Access** → Add New Database User
   - Username: `rct_user`
   - Password: genera una segura
4. **Network Access** → Add IP Address → **Allow Access from Anywhere** (`0.0.0.0/0`)
5. **Connect** → Drivers → copia la URI:
   ```
   mongodb+srv://rct_user:<PASSWORD>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Reemplaza `<PASSWORD>` por la contraseña real
7. Añade `/rct_inmobiliaria` antes del `?` para fijar el nombre de la BD:
   ```
   mongodb+srv://rct_user:LaPasswordReal@cluster0.xxxxx.mongodb.net/rct_inmobiliaria?retryWrites=true&w=majority
   ```

### 3) Configurar Backend en Railway (recomendado)

1. https://railway.app → New Project → Deploy from GitHub repo
2. Selecciona el repo
3. **Settings** → **Root Directory:** `backend`
4. **Settings** → **Start Command:**
   ```
   uvicorn server:app --host 0.0.0.0 --port $PORT
   ```
5. **Variables** (pestaña Variables) — añade TODAS estas:

   | Variable | Valor |
   |----------|-------|
   | `MONGO_URL` | tu URI de MongoDB Atlas (paso 2.7) |
   | `DB_NAME` | `rct_inmobiliaria` |
   | `EMERGENT_LLM_KEY` | tu key de IA |
   | `GOOGLE_CLIENT_ID` | tu client id de Google |
   | `RECAPTCHA_SITE_KEY` | tu site key |
   | `RECAPTCHA_SECRET_KEY` | tu secret key |
   | `RECAPTCHA_MIN_SCORE` | `0.5` |
   | `ADMIN_EMAIL` | `admin@rct.app` (o tu email) |
   | `ADMIN_PASSWORD` | `Admin-RCT-2026!` (cambia esta) |
   | `RECAPTCHA_TEST_BYPASS` | `0` (importante en producción) |
   | `JWT_SECRET` | una cadena aleatoria larga |

6. Deploy → copia la URL pública (ej: `https://rct-backend-production.up.railway.app`)

### 4) Configurar Frontend en Vercel

1. https://vercel.com → tu proyecto → **Settings** → **Environment Variables**
2. Añade:

   | Variable | Valor |
   |----------|-------|
   | `REACT_APP_BACKEND_URL` | URL completa de Railway del paso 3.6 (sin `/`final, sin `/api`) |
   | `REACT_APP_GOOGLE_CLIENT_ID` | tu client id Google |
   | `REACT_APP_RECAPTCHA_SITE_KEY` | tu site key |

3. **Redeploy** (Settings → Deployments → ... → Redeploy) — los cambios de env solo aplican tras redeploy

### 5) Configurar dominios autorizados

#### Google OAuth (https://console.cloud.google.com)
- Tu Client ID → **Orígenes JavaScript autorizados** añade tu URL de Vercel:
  ```
  https://tu-app.vercel.app
  ```

#### Google reCAPTCHA (https://www.google.com/recaptcha/admin)
- Tu Site Key → **Dominios** añade `tu-app.vercel.app`

### 6) Verificación final

Abre tu app en Vercel y la consola del navegador (F12 → Network).

Al pulsar **"Crear cuenta"** debes ver:
- ✅ Request a `POST https://rct-backend-production.up.railway.app/api/auth/register`
- ✅ Status 200 con `{user_id, email, name, token, is_admin}`
- ✅ Redirige al dashboard

Si ves:
- ❌ `404 Not Found` → `REACT_APP_BACKEND_URL` mal configurado en Vercel
- ❌ `CORS error` → en el backend, comprueba que `CORSMiddleware` tiene `allow_origin_regex=".*"` (ya está en el código)
- ❌ `503 / 500` → revisa logs en Railway (Deployments → tu deploy → Logs)
- ❌ `400 reCAPTCHA inválido` → no añadiste tu dominio Vercel en Google reCAPTCHA Admin
- ❌ `connection refused / timeout` → MongoDB Atlas: revisa Network Access que tenga `0.0.0.0/0`

### 7) Endpoints de diagnóstico

- `GET /api/health` — estado de DB + auth providers
- `GET /api/` — versión

### 8) Logs claros en producción

El backend ahora loguea al iniciar:
```
======================================================================
MongoDB connection OK
  MONGO_URL set: True
  DB_NAME: rct_inmobiliaria
======================================================================
```

Si la conexión falla:
```
======================================================================
MONGODB CONNECTION FAILED
  Error: ...
  Check that MONGO_URL and DB_NAME are set correctly in environment
======================================================================
```

Y al crearse el admin:
```
======================================================================
ADMIN USER CREATED
  email: admin@rct.app
  password: Admin-RCT-2026!
======================================================================
```

---

## 🚀 Alternativa más simple: usar el deploy nativo de Emergent

Si todo esto te resulta complejo, el deploy nativo de Emergent gestiona Frontend + Backend + MongoDB con 1 clic. Pulsa **"Deploy"** en la plataforma. Coste: ~10 USD/mes pero todo automático.

Para deploy externo (Vercel + Railway + Atlas), el coste suele ser ~5 USD/mes pero requiere configurar las 3 plataformas como arriba.
