# RCT Gestión Inmobiliaria — PRD

## Problem statement (resumen)
Migración mejorada de app creada en base44. Gestión de inmuebles con unidades anidadas (Local, Estudio, Duplex, Dormitorio), inquilinos con % de reparto para división automática por IA, subida de facturas con lectura GPT-4o (extracción de IVA/retenciones y reparto), alquiler vacacional con calendario y tarifas día/semana/mes. Sin autenticación.

## Arquitectura
- Backend: FastAPI + MongoDB (motor), emergentintegrations (GPT-4o vision)
- Frontend: React 19 + Tailwind + shadcn/ui, react-router, lucide-react, sonner
- Idioma: Español
- Tema: Swiss / High-Contrast (negro + blanco, acentos azul para IA)

## Implementado (Iter 1 — enero 2026)
- Sidebar: Dashboard, Inmuebles, Inquilinos, Facturación, Vacacional
- Dashboard: 4 KPIs (Inmuebles, Unidades + ocupación, Ingresos del mes, Inquilinos + gastos) + widget AI Subir Factura (drag & drop + preview + resultado con reparto)
- Inmuebles: tabla con filas expandibles que muestran sub-grid de unidades. CRUD de inmuebles y unidades. Tipos Local/Estudio/Duplex/Dormitorio. Modalidad long_term o vacation (con 3 tarifas).
- Inquilinos: CRUD con split_percentage y asignación a inmueble+unidad. Aviso si el % no suma 100 en un inmueble.
- Facturación: lista + upload. POST /api/invoices/analyze invoca GPT-4o vision (emergentintegrations) y devuelve vendor, fecha, base, IVA, IVA%, retenciones, retenciones%, neto, y splits computados.
- Vacacional: calendario tipo Gantt por unidad/día (mes navegable) con colores por estado y reservas CRUD con cálculo automático según tarifa.
- Seed de demo: 2 inmuebles (Edificio Central + Casa Vacacional con 3 mini-estudios), 6 unidades, 3 inquilinos con %.

## Testing
- Backend: 7/7 pytest 100% — CRUD completo, cascade, splits IA, flujo GPT-4o vision validado con imagen real.

## Backlog / Next
- P1: Cascade delete de tenants/reservations al borrar inmueble/unidad
- P1: Validación suma de % = 100 por inmueble (alerta backend)
- P2: Subida de facturas en PDF (multi-página)
- P2: Exportación de cobros a CSV/PDF por inquilino
- P2: Integración con Airbnb/Booking (iCal sync)
- P2: Recordatorios automáticos de cobro

## Notas
- EMERGENT_LLM_KEY en /app/backend/.env
- Modelo: gpt-4o (visión)
