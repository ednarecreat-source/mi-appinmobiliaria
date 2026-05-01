# RCT Gestión Inmobiliaria — PRD

## Problem statement (resumen)
Migración mejorada de app creada en base44. Gestión de inmuebles con unidades anidadas (Local, Estudio, Duplex, Dormitorio), inquilinos con % de reparto para división automática por IA, subida de facturas con lectura GPT-4o (extracción de IVA/retenciones y reparto), alquiler vacacional con calendario y tarifas día/semana/mes. Sin autenticación.

## Arquitectura
- Backend: FastAPI + MongoDB (motor), emergentintegrations (GPT-4o vision), PyMuPDF (PDF→imagen)
- Frontend: React 19 + Tailwind + shadcn/ui, react-router, lucide-react, sonner
- Idioma: Español
- Tema: Sage Pantone #b3c1b3 — paleta orgánica (crema, sage, terracota), tipografía serif Fraunces + Inter + JetBrains Mono

## Implementado

### Iter 1 (enero 2026)
- Sidebar: Dashboard, Inmuebles, Inquilinos, Facturación, Vacacional
- Dashboard: 4 KPIs + widget AI Subir Factura (drag & drop + preview + resultado con reparto)
- Inmuebles: tabla con filas expandibles que muestran sub-grid de unidades. CRUD. Tipos Local/Estudio/Duplex/Dormitorio. Modalidad long_term o vacation (con 3 tarifas).
- Inquilinos: CRUD con split_percentage y asignación a inmueble+unidad.
- Facturación: lista + upload. POST /api/invoices/analyze invoca GPT-4o vision.
- Vacacional: calendario tipo Gantt por unidad/día, reservas CRUD con cálculo automático.

### Iter 2 (enero 2026)
- **Rediseño completo** con paleta sage (Pantone #b3c1b3). Tipografías Fraunces (serif) + Inter + JetBrains Mono. Tarjetas con border-radius mayor, sombras suaves, efectos blur tenues, hover translate.
- **Soporte PDF para facturas**: detección por content-type, extensión o magic bytes (%PDF-). Se renderiza la primera página a JPEG (~150dpi) con PyMuPDF y se envía a GPT-4o vision.
- **Validación de % por inmueble (aviso, no bloqueo)**:
  - Backend: nuevo endpoint `GET /api/tenants/percentage-summary` → `{property_id: total%}`.
  - Frontend Inmuebles: badge inline en cada inmueble (✓ 100%, ⚠ 105%, "85%").
  - Frontend Inquilinos: aviso en formulario + banner global (terracota si supera 100, sage suave si falta por asignar).

## Testing
- Backend Iter 2: 11/11 pytest 100% (PDF magic bytes, percentage-summary, regression CRUD, GPT-4o vision JPEG y PDF)

## Backlog / Next
- P1: Cascade delete de tenants/reservations al borrar inmueble/unidad
- P2: Multi-página PDF (procesar todas las páginas)
- P2: Exportación de cobros a CSV/PDF por inquilino
- P2: Panel de impuestos trimestrales (Modelo 303/130) agregando IVA/retenciones por trimestre
- P2: Integración con Airbnb/Booking (iCal sync)
- P2: Recordatorios automáticos de cobro

## Notas
- EMERGENT_LLM_KEY en /app/backend/.env
- Modelo: gpt-4o (visión)
- PyMuPDF instalado vía requirements.txt
