# RCT Gestión Inmobiliaria — PRD

## Problem statement
App SaaS de gestión inmobiliaria en español. Gestión de inmuebles con unidades anidadas (Local, Estudio, Duplex, Dormitorio), inquilinos con % de reparto para división automática por IA, subida de facturas (PDF o imagen) con lectura GPT-4o (IVA/retenciones + reparto), alquiler vacacional con calendario y tarifas, gastos fijos por inmueble, y dashboard financiero completo.

## Arquitectura
- Backend: FastAPI + MongoDB, emergentintegrations (GPT-4o vision), PyMuPDF (PDF→imagen)
- Frontend: React 19 + Tailwind + shadcn/ui
- Tema: Sage Pantone #b3c1b3 (crema/sage/terracota), Fraunces serif + Inter + JetBrains Mono

## Implementado

### Iter 1 (MVP)
- Sidebar + 5 secciones. CRUD Inmuebles/Unidades/Inquilinos/Reservas. IA GPT-4o vision para facturas imagen. Calendario Gantt vacacional con tarifas día/semana/mes.

### Iter 2 — Rediseño + PDF + Validación %
- Rediseño completo paleta sage Pantone #b3c1b3
- Soporte PDF (detección por content-type, extensión o magic bytes; primera página → JPEG con PyMuPDF → GPT-4o)
- Endpoint `/api/tenants/percentage-summary`; badge por inmueble (✓100% / ⚠105% / 85%) y banners de aviso en Inquilinos (no bloqueante)

### Iter 3 — Gastos fijos + Resumen financiero
- Modelo `FixedExpense` + CRUD `/api/fixed-expenses` (categorías: hipoteca, seguro, mantenimiento, suministros, comunidad, IBI, otros; frecuencias: mensual/trimestral/anual)
- Sección "Gastos fijos del inmueble" dentro de cada inmueble expandido, con cálculo automático "€/mes"
- Dashboard `/api/dashboard/stats` enriquecido: total_income, vacation_income, invoice_gross, invoice_iva, invoice_retenciones, invoice_net, fixed_expenses_monthly, monthly_expenses, net_income
- Nueva tarjeta **"Resumen financiero del mes"** en Dashboard con 4 columnas (Ingresos, Gastos totales, IVA & Retenciones, Lo que se gana limpio) + pill "Neto limpio · XX,XX €"

## Testing
- Iter 3 backend: **14/14 pytest 100%** (CRUD fixed-expenses, invariantes matemáticas, normalización por frecuencia, regresión)

## Backlog
- P1: Cascade delete de tenants/reservations/invoices/fixed_expenses al borrar inmueble
- P1: Validación server-side de enums (category, frequency)
- P2: Panel impuestos trimestrales (Modelo 303/130)
- P2: Exportación CSV/PDF por inquilino
- P2: Multi-página PDF
- P2: iCal sync Airbnb/Booking
- P2: Recordatorios automáticos

## Notas
- EMERGENT_LLM_KEY en `/app/backend/.env`
- Modelo: gpt-4o
