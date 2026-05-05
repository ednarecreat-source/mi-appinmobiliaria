# RCT Gestión Inmobiliaria

App SaaS de gestión inmobiliaria en español con IA (GPT-4o), multi-cartera, multi-divisa, conciliación bancaria y resúmenes financieros.

## ✨ Funcionalidades

- 🏠 **Inmuebles & Unidades** — gestión de inmuebles divisibles en Local / Estudio / Dúplex / Dormitorio, con alquiler de largo plazo o vacacional
- 👥 **Inquilinos** con porcentaje de reparto para que la IA divida facturas automáticamente
- 🤖 **Subir factura con IA (GPT-4o)** — acepta PDF, JPG, PNG, WEBP. Extrae proveedor, fecha, base, IVA, retenciones y neto, y reparte entre inquilinos según %
- 💸 **Gastos fijos por inmueble** (hipoteca, seguros, IBI, comunidad, mantenimiento) con frecuencia mensual / trimestral / anual
- 🏖️ **Alquiler vacacional** — calendario tipo Gantt + tarifas día / semana / mes + reservas con cálculo automático
- 🏦 **Conciliación bancaria** — sube extracto en CSV / Excel / PDF, la IA categoriza cada transacción y la asocia a inmuebles e inquilinos
- 📅 **Histórico anual** — cierra meses, conserva snapshots, compara mes vs mes anterior, totales año
- 🌍 **Multi-divisa** — EUR / USD / GBP / MXN / ARS / COP con tipo de cambio configurable
- 👨‍👩‍👧 **Multi-cartera** — comparte inmuebles con tu familia (cada uno entra con su cuenta)
- 🔐 **Autenticación propia** — email/contraseña (bcrypt) + Google OAuth directo + reCAPTCHA v3

## 🛠️ Stack

- **Backend:** FastAPI + MongoDB (motor) + emergentintegrations (GPT-4o vision) + PyMuPDF + pandas + bcrypt + google-auth
- **Frontend:** React 19 + Tailwind + shadcn/ui + react-router + lucide-react + sonner
- **Auth:** JWT/sesión propia (`session_token`) en localStorage con `Authorization: Bearer` en cada request

## 📁 Estructura

```
/app
├── backend/
│   ├── server.py          # Toda la API
│   ├── requirements.txt
│   └── .env               # Variables de entorno backend
└── frontend/
    ├── src/
    │   ├── App.js
    │   ├── lib/api.js     # axios con interceptor Bearer
    │   ├── lib/auth.jsx   # AuthProvider context
    │   └── pages/         # Login, Dashboard, Properties, Tenants, Invoices, Bank, Vacation, History, WorkspaceSettings
    ├── package.json
    └── .env               # Variables de entorno frontend
```

## 🔑 Variables de entorno

### Backend (`/app/backend/.env`)
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=rct_inmobiliaria
CORS_ORIGINS=*
EMERGENT_LLM_KEY=sk-emergent-xxxxxxx       # GPT-4o para IA (facturas + banco)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com  # opcional
RECAPTCHA_SITE_KEY=6Lxxx                   # opcional (frontend la lee de /auth/config)
RECAPTCHA_SECRET_KEY=6Lxxx                 # opcional
RECAPTCHA_MIN_SCORE=0.5
JWT_SECRET=cambia-esto-en-produccion
```

### Frontend (`/app/frontend/.env`)
```env
REACT_APP_BACKEND_URL=https://tu-backend.railway.app
REACT_APP_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com  # fallback opcional
REACT_APP_RECAPTCHA_SITE_KEY=6Lxxx                          # fallback opcional
```

## 🚀 Despliegue

### Opción A — Deploy nativo (Emergent)
1 clic en "Deploy" en la plataforma. Frontend + Backend + MongoDB gestionados.

### Opción B — Vercel (Frontend) + Railway (Backend) + MongoDB Atlas

#### 1. MongoDB Atlas (BD)
1. https://mongodb.com/cloud/atlas → crea cluster gratis (512 MB)
2. Database Access: crear usuario con password
3. Network Access: añadir `0.0.0.0/0`
4. Connect → copia la URI: `mongodb+srv://user:pass@cluster.mongodb.net/rct_inmobiliaria`

#### 2. Backend en Railway
1. https://railway.app → New Project → Deploy from GitHub repo
2. **Root Directory:** `backend`
3. **Start Command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
4. Variables de entorno: copia las del backend `.env` (sustituye `MONGO_URL` por la de Atlas)
5. Copia la URL pública (ej: `https://rct-backend.up.railway.app`)

#### 3. Frontend en Vercel
1. https://vercel.com → Add New Project → importa repo de GitHub
2. **Framework Preset:** Create React App
3. **Root Directory:** `frontend`
4. **Build Command:** `yarn build` (o `npm run build`)
5. **Output Directory:** `build`
6. Variables de entorno:
   - `REACT_APP_BACKEND_URL=https://rct-backend.up.railway.app` (URL del paso 2)
   - `REACT_APP_GOOGLE_CLIENT_ID=…` (opcional)
   - `REACT_APP_RECAPTCHA_SITE_KEY=…` (opcional)
7. Deploy

#### 4. Configurar Google OAuth para producción
En https://console.cloud.google.com/ → tu Client ID → añade tu dominio de Vercel a "Orígenes JavaScript autorizados":
```
https://tu-app.vercel.app
```

#### 5. Configurar reCAPTCHA para producción
En https://www.google.com/recaptcha/admin → tu Site Key → añade `tu-app.vercel.app` a "Dominios".

## 🧪 Desarrollo local

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8001

# Frontend
cd frontend
yarn install
yarn start  # corre en http://localhost:3000
```

## 📡 API principal

Todas las rutas con prefijo `/api`. Auth: `Authorization: Bearer <token>` (devuelto por `/auth/login`, `/auth/register`, `/auth/google`).

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/auth/config` | Configuración pública (Google + reCAPTCHA habilitados) |
| POST | `/auth/register` | Crear cuenta |
| POST | `/auth/login` | Login email+contraseña |
| POST | `/auth/google` | Login con ID Token de Google |
| GET | `/auth/me` | Usuario actual |
| POST | `/auth/logout` | Cerrar sesión |
| GET/POST/PUT/DELETE | `/properties` | CRUD inmuebles |
| GET/POST/PUT/DELETE | `/units` | CRUD unidades |
| GET/POST/PUT/DELETE | `/tenants` | CRUD inquilinos |
| GET | `/tenants/percentage-summary` | Suma de % por inmueble |
| POST | `/invoices/analyze` | Subir factura → GPT-4o |
| GET/POST/PUT/DELETE | `/fixed-expenses` | CRUD gastos fijos |
| POST | `/bank/upload` | Subir extracto bancario → IA categoriza |
| GET/POST/PUT/DELETE | `/bank/transactions` | CRUD transacciones |
| GET | `/dashboard/stats` | KPIs financieros del mes |
| POST | `/history/close` | Cerrar mes (snapshot) |
| GET | `/history/year/{year}` | Resumen anual |
| GET | `/workspaces` | Listar carteras del usuario |
| POST | `/workspaces/{id}/invite` | Invitar miembro por email |

## 🔒 Seguridad

- bcrypt para password hashing
- Google ID Token verificado server-side con `google-auth`
- reCAPTCHA v3 con score mínimo configurable
- Sesión `session_token` con expiración 7 días
- Aislamiento multi-tenant por `workspace_id` en cada query
- CORS con `allow_origin_regex=".*"` + credentials para preview cross-origin

## 📜 Licencia

Privado.
