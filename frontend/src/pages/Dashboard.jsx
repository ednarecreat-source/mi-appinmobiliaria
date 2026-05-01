import { useEffect, useState, useRef } from "react";
import { api, eur } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Home, Upload, Sparkles, FileText, FileType2, ArrowUpRight, ArrowDownRight, Wallet, CalendarRange } from "lucide-react";
import { toast } from "sonner";

export default function Dashboard() {
  const { activeWs } = useAuth();
  const [stats, setStats] = useState(null);
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [isPdf, setIsPdf] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const cur = stats?.display_currency || activeWs?.display_currency || "EUR";

  const loadAll = async () => {
    const [s, p] = await Promise.all([api.get("/dashboard/stats"), api.get("/properties")]);
    setStats(s.data);
    setProperties(p.data);
  };
  useEffect(() => { loadAll(); }, [activeWs?.id]);

  const onFileChange = (f) => {
    if (!f) return;
    setFile(f); setResult(null);
    const pdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    setIsPdf(pdf);
    if (!pdf) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(f);
    } else setPreview("");
  };

  const analyze = async () => {
    if (!file) return toast.error("Selecciona una factura");
    setAnalyzing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (propertyId) fd.append("property_id", propertyId);
      const { data } = await api.post("/invoices/analyze", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setResult(data);
      toast.success("Factura analizada con IA");
      loadAll();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al analizar");
    } finally { setAnalyzing(false); }
  };

  return (
    <div className="space-y-10 fade-in">
      <div>
        <div className="text-xs font-mono uppercase tracking-[0.25em] text-sage-600 mb-2">Panel principal · {activeWs?.name}</div>
        <h1 className="text-4xl font-serif font-bold tracking-tight">Buenos días.</h1>
        <p className="text-base text-ink-soft mt-1">Resumen financiero del mes y herramientas con IA.</p>
      </div>

      {/* 2 compact cards: portfolio + occupancy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card-soft p-6 fade-in" data-testid="kpi-portfolio">
          <div className="flex items-start justify-between">
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-muted">Tu cartera</div>
            <div className="w-9 h-9 rounded-lg bg-sage-100 text-sage-700 grid place-items-center"><Building2 className="w-4 h-4" /></div>
          </div>
          <div className="mt-5 flex items-baseline gap-6">
            <div>
              <div className="text-3xl font-serif font-bold mono">{stats?.total_properties ?? "—"}</div>
              <div className="text-xs text-ink-soft mt-0.5">Inmuebles</div>
            </div>
            <div className="w-px h-12 bg-border" />
            <div>
              <div className="text-3xl font-serif font-bold mono">{stats?.total_units ?? "—"}</div>
              <div className="text-xs text-ink-soft mt-0.5">Unidades</div>
            </div>
            <div className="w-px h-12 bg-border" />
            <div>
              <div className="text-3xl font-serif font-bold mono">{stats?.total_tenants ?? "—"}</div>
              <div className="text-xs text-ink-soft mt-0.5">Inquilinos</div>
            </div>
          </div>
        </div>

        <div className="card-soft p-6 fade-in" data-testid="kpi-occupancy">
          <div className="flex items-start justify-between">
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-muted">Ocupación</div>
            <div className="w-9 h-9 rounded-lg bg-sage-100 text-sage-700 grid place-items-center"><Home className="w-4 h-4" /></div>
          </div>
          <div className="mt-5 flex items-end gap-3">
            <div className="text-4xl font-serif font-bold mono">{stats?.occupancy_rate ?? 0}%</div>
            <div className="text-sm text-ink-soft mb-1">de tus unidades alquiladas</div>
          </div>
          <div className="mt-4 h-2 rounded-full bg-sage-100 overflow-hidden">
            <div className="h-full bg-sage-600 transition-all" style={{ width: `${Math.min(100, stats?.occupancy_rate || 0)}%` }} />
          </div>
        </div>
      </div>

      {/* Financial summary */}
      <div className="card-soft p-7" data-testid="financial-summary">
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="w-10 h-10 rounded-xl bg-sage-100 text-sage-700 grid place-items-center"><Wallet className="w-5 h-5" /></div>
          <div>
            <h2 className="font-serif font-bold text-xl">Resumen financiero del mes</h2>
            <div className="text-xs text-ink-soft">Ingresos, gastos, impuestos y neto limpio · totales en {cur}</div>
          </div>
          <div className={`ml-auto px-3 py-1.5 rounded-full text-xs font-mono font-semibold ${(stats?.net_income ?? 0) >= 0 ? "bg-sage-100 text-sage-700" : "bg-terracotta-soft text-terracotta"}`}>
            Neto limpio · {eur(stats?.net_income, cur)}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 divide-x divide-border border border-border rounded-xl overflow-hidden bg-sage-50/30">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2"><ArrowUpRight className="w-4 h-4 text-sage-700" /><div className="text-[11px] font-mono uppercase tracking-[0.2em] text-sage-700">Ingresos</div></div>
            <div className="text-2xl font-serif font-bold mono">{eur(stats?.total_income, cur)}</div>
            <div className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between text-ink-soft"><span>· Renta mensual</span><span className="mono">{eur(stats?.monthly_income, cur)}</span></div>
              <div className="flex justify-between text-ink-soft"><span>· Vacacional</span><span className="mono">{eur(stats?.vacation_income, cur)}</span></div>
            </div>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2"><ArrowDownRight className="w-4 h-4 text-terracotta" /><div className="text-[11px] font-mono uppercase tracking-[0.2em] text-terracotta">Gastos totales</div></div>
            <div className="text-2xl font-serif font-bold mono">{eur(stats?.monthly_expenses, cur)}</div>
            <div className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between text-ink-soft"><span>· Facturas</span><span className="mono">{eur(stats?.invoice_net, cur)}</span></div>
              <div className="flex justify-between text-ink-soft"><span>· Gastos fijos</span><span className="mono">{eur(stats?.fixed_expenses_monthly, cur)}</span></div>
            </div>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2"><FileText className="w-4 h-4 text-ink-soft" /><div className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-soft">IVA & Retenciones</div></div>
            <div className="text-2xl font-serif font-bold mono">{eur((stats?.invoice_iva ?? 0) + (stats?.invoice_retenciones ?? 0), cur)}</div>
            <div className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between text-ink-soft"><span>· IVA facturas</span><span className="mono text-sage-700">+{eur(stats?.invoice_iva, cur)}</span></div>
              <div className="flex justify-between text-ink-soft"><span>· Retenciones</span><span className="mono text-terracotta">-{eur(stats?.invoice_retenciones, cur)}</span></div>
            </div>
          </div>
          <div className="p-5 bg-sage-50/60">
            <div className="flex items-center gap-2 mb-2"><CalendarRange className="w-4 h-4 text-sage-700" /><div className="text-[11px] font-mono uppercase tracking-[0.2em] text-sage-700">Lo que se gana limpio</div></div>
            <div className={`text-2xl font-serif font-bold mono ${(stats?.net_income ?? 0) >= 0 ? "text-sage-700" : "text-terracotta"}`}>{eur(stats?.net_income, cur)}</div>
            <div className="mt-3 space-y-1 text-xs text-ink-soft"><div>Tras restar todas las facturas y gastos fijos</div></div>
          </div>
        </div>
      </div>

      {/* AI Invoice Upload */}
      <div className="card-soft p-7 lg:p-9 relative overflow-hidden" data-testid="invoice-upload-widget">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-sage-100 blur-3xl opacity-60 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-sage-700 text-white grid place-items-center"><Sparkles className="w-5 h-5" /></div>
            <div>
              <h2 className="text-2xl font-serif font-bold">Subir factura con IA</h2>
              <div className="text-xs text-ink-soft mt-0.5">Acepta PDF, JPG, PNG, WEBP · Modelo GPT-4o</div>
            </div>
          </div>
          <p className="text-sm text-ink-soft mb-6 max-w-2xl">Sube una factura. La IA extrae base, IVA y retenciones, y la divide entre tus inquilinos.</p>

          <div className="grid md:grid-cols-2 gap-7">
            <div>
              <label className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-muted">Inmueble (opcional)</label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger className="mt-2 rounded-xl" data-testid="invoice-property-select"><SelectValue placeholder="Todos los inquilinos" /></SelectTrigger>
                <SelectContent>{properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
              <div className="mt-4 dropzone-sage p-8 text-center cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFileChange(f); }}
                data-testid="invoice-dropzone">
                <input ref={fileInputRef} type="file" accept="image/*,application/pdf,.pdf" className="hidden" data-testid="invoice-file-input" onChange={(e) => onFileChange(e.target.files?.[0])} />
                {preview && !isPdf ? <img src={preview} alt="" className="max-h-56 mx-auto rounded-lg" />
                  : isPdf ? <div className="flex flex-col items-center gap-2"><FileType2 className="w-10 h-10 text-sage-700" /><div className="font-medium">{file?.name}</div><div className="text-xs text-ink-soft">PDF · Lista para analizar</div></div>
                  : <><Upload className="w-9 h-9 mx-auto text-sage-600" strokeWidth={1.7} /><div className="mt-3 font-serif font-semibold text-lg">Arrastra una factura</div><div className="text-xs text-ink-soft mt-1">o haz click · PDF, JPG, PNG, WEBP</div></>}
              </div>
              <Button className="mt-5 w-full btn-primary h-11 text-sm font-semibold" onClick={analyze} disabled={analyzing || !file} data-testid="btn-analyze-invoice">
                {analyzing ? "Analizando con GPT-4o..." : "Analizar con IA"}
              </Button>
            </div>
            <div>
              {analyzing && (
                <div className="rounded-xl border border-border p-6 bg-cream-card">
                  <div className="h-4 shimmer w-1/2 mb-3" /><div className="h-3 shimmer w-full mb-2" /><div className="h-3 shimmer w-4/5 mb-2" /><div className="h-3 shimmer w-3/5" />
                  <div className="mt-5 text-xs font-mono uppercase tracking-[0.2em] text-sage-700">GPT-4o leyendo factura...</div>
                </div>
              )}
              {result && !analyzing && (
                <div className="rounded-xl border border-border p-6 bg-cream-card fade-in" data-testid="invoice-result">
                  <div className="flex items-center gap-2 mb-3"><FileText className="w-4 h-4 text-sage-700" /><div className="font-serif font-bold text-lg">{result.vendor || "Factura"}</div><div className="ml-auto text-xs text-ink-soft mono">{result.invoice_date}</div></div>
                  <div className="text-xs text-ink-soft mb-4">{result.concept}</div>
                  <div className="grid grid-cols-2 gap-y-2 text-sm mono">
                    <div className="text-ink-soft">Base</div><div className="text-right">{eur(result.gross_amount, result.currency)}</div>
                    <div className="text-ink-soft">IVA ({result.iva_rate}%)</div><div className="text-right text-sage-700">+{eur(result.iva, result.currency)}</div>
                    <div className="text-ink-soft">Retenciones ({result.retenciones_rate}%)</div><div className="text-right text-terracotta">-{eur(result.retenciones, result.currency)}</div>
                    <div className="font-bold border-t border-border pt-2 font-serif">Neto</div><div className="text-right font-bold border-t border-border pt-2">{eur(result.net_amount, result.currency)}</div>
                  </div>
                  {result.splits?.length > 0 && (
                    <div className="mt-5 border-t border-border pt-4">
                      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-muted mb-3">Reparto entre inquilinos</div>
                      {result.splits.map((s) => (
                        <div key={s.tenant_id} className="flex justify-between text-sm py-1.5">
                          <span>{s.tenant_name} <span className="text-ink-muted">· {s.percentage}%</span></span>
                          <span className="mono font-semibold">{eur(s.amount, result.currency)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!analyzing && !result && (
                <div className="rounded-xl border border-dashed border-border p-12 bg-sage-50/40 text-center text-sm text-ink-soft">El resultado del análisis aparecerá aquí</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
