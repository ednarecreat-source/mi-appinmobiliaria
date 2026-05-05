# RCT Gestión Inmobiliaria — PRD

## Iteraciones

### Iter 1 — MVP (CRUD + IA facturas + calendario)
### Iter 2 — Rediseño sage + PDF + validación %
### Iter 3 — Gastos fijos + Resumen financiero
### Iter 4 — Multi-cartera + Multi-divisa + Banco + Histórico
### Iter 5 — Auth refactor (sin Emergent) + Google OAuth + reCAPTCHA v3 + fix 401 con Bearer token

## Estado actual (Iter 5 — completo)

**Auth:**
- Email/password con bcrypt
- Google OAuth directo (validación con `google-auth` server-side, sin intermediario)
- reCAPTCHA v3 invisible (gates `/auth/register` y `/auth/login`; `/auth/google` se valida vía Google ID Token)
- Sesión propia: `session_token` devuelta en JSON + cookie httpOnly fallback
- Frontend usa `Authorization: Bearer <token>` desde localStorage
- Interceptor 401 axios → limpia token + redirige a login

**Funcionalidad core (ver README.md):**
- 5 secciones (Dashboard, Inmuebles, Inquilinos, Facturación, Banco, Vacacional, Histórico, Ajustes)
- IA GPT-4o (lectura facturas + categorización banco)
- Multi-cartera con invitación por email
- Multi-divisa (EUR/USD/GBP/MXN/ARS/COP)
- Histórico anual con snapshots por mes

## Testing
- Iter 5: **17/17 pytest 100%** — token Bearer, reCAPTCHA gating, regresión completa, aislamiento multi-tenant, no leaks de _id
- Deployment health check: **PASS** (sin blockers)

## Backlog
- P1: Cascade delete completo al borrar inmueble
- P1: Endpoint para revocar todas las sesiones de un usuario
- P2: Rate limiting en /auth/login y /auth/register
- P2: Sanitizar mensaje de error en /auth/google (no leak de stacktrace)
- P2: Splittear server.py en routers/services
- P2: Recuperación de contraseña (SendGrid/Resend)
- P2: Modelo 303/130 trimestral
- P2: iCal sync Airbnb/Booking
- P2: PSD2 real (banca conectada)

## Despliegue
Ver `/app/README.md` para opciones detalladas (Emergent nativo vs Vercel+Railway+MongoDB Atlas).
