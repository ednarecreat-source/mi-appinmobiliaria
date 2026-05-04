# RCT Gestión Inmobiliaria — PRD

## Problem statement
App SaaS de gestión inmobiliaria en español. Gestión de inmuebles con unidades anidadas (Local, Estudio, Duplex, Dormitorio), inquilinos con % de reparto IA, facturas PDF/imagen con GPT-4o, alquiler vacacional, gastos fijos, conciliación bancaria, multi-divisa, multi-cartera (compartida con familia), histórico anual.

## Arquitectura
- Backend: FastAPI + MongoDB, emergentintegrations (GPT-4o vision), PyMuPDF, pandas, bcrypt, google-auth
- Frontend: React 19 + Tailwind + shadcn/ui
- Auth: email+password (bcrypt + httpOnly cookie) + Google OAuth directo (Google Identity Services + backend google-auth)
- Tema: Sage Pantone #b3c1b3, Fraunces serif + Inter + JetBrains Mono

## Iteraciones implementadas

### Iter 1 — MVP
Sidebar + 5 secciones. CRUD Inmuebles/Unidades/Inquilinos/Reservas. IA GPT-4o para facturas imagen. Calendario vacacional.

### Iter 2 — Rediseño + PDF + Validación %
Paleta sage. PDF → JPEG vía PyMuPDF. Endpoint tenants/percentage-summary. Badges ✓100%/⚠105%.

### Iter 3 — Gastos fijos + Resumen financiero
Model FixedExpense + CRUD. Dashboard con bloque "Resumen financiero del mes" (ingresos, gastos, IVA, retenciones, neto limpio).

### Iter 4 — Multi-cartera + Multi-divisa + Banco + Histórico
- Auth via Emergent Auth + Workspaces (owner + member_ids)
- Todas las entidades scoped por workspace_id, aisladas por usuario
- Currency por Property; workspace.display_currency + exchange_rates; conversión en dashboard
- /api/bank/* (upload CSV/Excel/PDF → AI categorize; CRUD manual; marcar conciliadas)
- /api/history/* (cerrar mes, listar snapshots, agregar año)
- Dashboard KPIs refactorizados (combinado inmuebles+unidades+inquilinos; tarjeta ocupación)
- Página "Conciliación bancaria" con mock PSD2 + subida funcional
- Página "Histórico" con 12 meses del año + comparación mes a mes + resumen anual

### Iter 5 — Auth refactor (sin Emergent)
- **Eliminada toda dependencia de auth.emergentagent.com y demobackend.emergentagent.com/auth en el flujo de login**
- Nuevos endpoints:
  - `GET /api/auth/config` → expone si Google está habilitado
  - `POST /api/auth/register` → crea cuenta con name/email/password (bcrypt)
  - `POST /api/auth/login` → email+password
  - `POST /api/auth/google` → valida ID Token con google-auth directamente (usa GOOGLE_CLIENT_ID env)
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- Sesión: token propio (`sess_*`) en cookie httpOnly, secure, samesite=none, 7 días
- Frontend Login nuevo: formulario email/password + registrar + Google Identity Services (google.accounts.id)
- CORS: `allow_origin_regex=".*"` con credentials (necesario para cookie cross-preview)
- EMERGENT_LLM_KEY sigue usándose SOLO para IA (GPT-4o facturas/banco)

## Testing
- Iter 5: **19/19 pytest 100%** cubriendo todo el refactor de auth + regresión completa (workspaces, properties, units, tenants, invoices con PDF e imagen, reservas, fixed-expenses, banco, histórico, dashboard). Cero leaks de _id, aislamiento multi-tenant verificado.

## Configuración
- `/app/backend/.env`:
  - `MONGO_URL`, `DB_NAME` (protegidos)
  - `EMERGENT_LLM_KEY` (GPT-4o para IA)
  - `GOOGLE_CLIENT_ID` (vacío por defecto; el usuario debe rellenarlo para activar el login con Google)
  - `JWT_SECRET` (reservado)

## Backlog
- P1: Cascade delete completo al borrar inmueble (tenants, reservations, invoices, fixed_expenses, bank_transactions asociadas)
- P1: `pydantic.EmailStr` para validación de email
- P2: TTL index en user_sessions
- P2: Recuperación de contraseña (integración SendGrid/Resend)
- P2: Splitear server.py en routers/ por dominio
- P2: Modelo 303/130 trimestral
- P2: iCal sync Airbnb/Booking
- P2: Conexión bancaria real PSD2
