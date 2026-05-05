# RCT Gestión Inmobiliaria — PRD

## Iter 6 — Admin + Allowlist + Vercel diagnostics (estado actual)

### Bug fix: registro
- Validación previa antes de `setBusy(true)`
- `executeRecaptcha` con timeout 8s y manejo robusto de errores (no se cuelga nunca)
- Mensajes de error específicos por status HTTP
- **Manejo de errores de red** (sin response): aviso claro al usuario sobre `REACT_APP_BACKEND_URL` mal configurado en Vercel

### Sistema admin
- Modelo `User.is_admin` + `AllowlistEntry`
- Admin user auto-seeded al arrancar el backend (`admin@rct.app` / `Admin-RCT-2026!`, configurable)
- Admin protegido contra auto-eliminación / auto-degradación
- Endpoints `/api/admin/allowlist` (GET/POST/DELETE) para gestionar emails autorizados
- Endpoints `/api/admin/users` (GET, DELETE, PUT toggle is_admin)
- **Gating**: `_is_email_allowed()` — si la lista blanca tiene entradas, solo esos emails (+ admin) pueden registrarse o hacer first-time Google sign-in. Si la lista está vacía, registro abierto.
- Página `/admin` (solo visible para admins) con UI para gestionar allowlist y usuarios

### Vercel diagnostics
- Endpoint `/api/health` con estado de DB + auth providers + AI key
- Logs en startup: `MongoDB connection OK / FAILED` con info clara
- Frontend muestra mensaje específico cuando falla la red (típico Vercel mal configurado)
- Documento `/app/VERCEL_DEPLOYMENT_GUIDE.md` con guía paso a paso para Vercel + Railway + MongoDB Atlas

## Testing
- Backend: **24/24 pytest 100%** (admin flow + allowlist + register fix + regression)

## Credenciales
- Admin: `admin@rct.app` / `Admin-RCT-2026!` (configurable via env)

## Backlog
- P1: Cascade delete completo al borrar inmueble
- P1: Endpoint para revocar todas las sesiones de un usuario
- P2: Rate limiting en /auth/*
- P2: Recuperación de contraseña (SendGrid/Resend)
- P2: Modelo 303/130 trimestral
- P2: iCal sync Airbnb/Booking
- P2: Conexión bancaria real PSD2
