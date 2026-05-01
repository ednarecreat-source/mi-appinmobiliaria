import { useEffect, useState, useRef } from "react";
import { api, eur } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Home, TrendingUp, Users, Upload, Sparkles, FileText, FileType2 } from "lucide-react";
import { toast } from "sonner";

function Kpi({ label, value, icon: Icon, testid, hint, accent }) {
  return (
    <div className="card-soft p-6 fade-in" data-testid={testid}>
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-muted">{label}</div>
        <div className={`w-9 h-9 rounded-lg grid place-items-center ${accent || "bg-sage-50 text-sage-700"}`}>
          <Icon className="w-4 h-4" strokeWidth={2.1} />
        </div>
      </div>
      <div className="mt-5 text-3xl font-serif font-bold tracking-tight number-pill">{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-soft">{hint}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [isPdf, setIsPdf] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const loadAll = async () => {
    const [s, p] = await Promise.all([api.get("/dashboard/stats"), api.get("/properties")]);
    setStats(s.data);
    setProperties(p.data);
  };
  useEffect(() => { loadAll(); }, []);

  const onFileChange = (f) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    const pdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    setIsPdf(pdf);
    if (!pdf) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(f);
    } else {
      setPreview("");
    }
  };

  const analyze = async () => {
    if (!file) return toast.error("Selecciona una factura primero");
    setAnalyzing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (propertyId) fd.append("property_id", propertyId);
      const { data } = await api.post("/invoices/analyze", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
      toast.success("Factura analizada con IA");
      loadAll();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al analizar");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-10 fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-[0.25em] text-sage-600 mb-2">Panel principal</div>
          <h1 className="text-4xl font-serif font-bold tracking-tight">Buenos días.</h1>
          <p className="text-base text-ink-soft mt-1">Resumen de tu cartera y herramientas con IA.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5" data-testid="dashboard-kpis">
        <Kpi label="Inmuebles" value={stats?.total_properties ?? "—"} icon={Building2} testid="kpi-properties" />
        <Kpi label="Unidades" value={stats?.total_units ?? "—"} icon={Home} testid="kpi-units" hint={`${stats?.occupancy_rate ?? 0}% ocupación`} />
        <Kpi label="Ingresos Mes" value={eur(stats?.monthly_income)} icon={TrendingUp} testid="kpi-income" hint={`Neto: ${eur(stats?.net_income)}`} accent="bg-sage-100 text-sage-700" />
        <Kpi label="Inquilinos" value={stats?.total_tenants ?? "—"} icon={Users} testid="kpi-tenants" hint={`Gastos: ${eur(stats?.monthly_expenses)}`} />
      </div>

      <div className="leaf-divider" />

      {/* AI Invoice Upload */}
      <div className="card-soft p-7 lg:p-9 relative overflow-hidden" data-testid="invoice-upload-widget">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-sage-100 blur-3xl opacity-60 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-sage-700 text-white grid place-items-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl font-serif font-bold">Subir factura con IA</h2>
              <div className="text-xs text-ink-soft mt-0.5">Acepta PDF, JPG, PNG y WEBP · Modelo GPT-4o</div>
            </div>
          </div>
          <p className="text-sm text-ink-soft mb-6 max-w-2xl">
            Sube una factura. La IA extrae base imponible, IVA y retenciones, y la divide entre tus inquilinos según el porcentaje asignado a cada uno.
          </p>

          <div className="grid md:grid-cols-2 gap-7">
            <div>
              <label className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-muted">Inmueble (opcional)</label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger className="mt-2 rounded-xl" data-testid="invoice-property-select">
                  <SelectValue placeholder="Todos los inquilinos" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div
                className="mt-4 dropzone-sage p-8 text-center cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) onFileChange(f);
                }}
                data-testid="invoice-dropzone"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf,.pdf"
                  className="hidden"
                  data-testid="invoice-file-input"
                  onChange={(e) => onFileChange(e.target.files?.[0])}
                />
                {preview && !isPdf ? (
                  <img src={preview} alt="preview" className="max-h-56 mx-auto rounded-lg" />
                ) : isPdf ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileType2 className="w-10 h-10 text-sage-700" />
                    <div className="font-medium">{file?.name}</div>
                    <div className="text-xs text-ink-soft">PDF · Lista para analizar</div>
                  </div>
                ) : (
                  <>
                    <Upload className="w-9 h-9 mx-auto text-sage-600" strokeWidth={1.7} />
                    <div className="mt-3 font-serif font-semibold text-lg">Arrastra una factura</div>
                    <div className="text-xs text-ink-soft mt-1">o haz click · PDF, JPG, PNG, WEBP</div>
                  </>
                )}
              </div>

              <Button
                className="mt-5 w-full btn-primary h-11 text-sm font-semibold"
                onClick={analyze}
                disabled={analyzing || !file}
                data-testid="btn-analyze-invoice"
              >
                {analyzing ? "Analizando con GPT-4o..." : "Analizar con IA"}
              </Button>
            </div>

            <div>
              {analyzing && (
                <div className="rounded-xl border border-border p-6 bg-cream-card">
                  <div className="h-4 shimmer w-1/2 mb-3" />
                  <div className="h-3 shimmer w-full mb-2" />
                  <div className="h-3 shimmer w-4/5 mb-2" />
                  <div className="h-3 shimmer w-3/5" />
                  <div className="mt-5 text-xs font-mono uppercase tracking-[0.2em] text-sage-700">
                    GPT-4o leyendo factura...
                  </div>
                </div>
              )}
              {result && !analyzing && (
                <div className="rounded-xl border border-border p-6 bg-cream-card fade-in" data-testid="invoice-result">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-sage-700" />
                    <div className="font-serif font-bold text-lg">{result.vendor || "Factura"}</div>
                    <div className="ml-auto text-xs text-ink-soft mono">{result.invoice_date}</div>
                  </div>
                  <div className="text-xs text-ink-soft mb-4">{result.concept}</div>
                  <div className="grid grid-cols-2 gap-y-2 text-sm mono">
                    <div className="text-ink-soft">Base</div>
                    <div className="text-right">{eur(result.gross_amount)}</div>
                    <div className="text-ink-soft">IVA ({result.iva_rate}%)</div>
                    <div className="text-right text-sage-700">+{eur(result.iva)}</div>
                    <div className="text-ink-soft">Retenciones ({result.retenciones_rate}%)</div>
                    <div className="text-right text-terracotta">-{eur(result.retenciones)}</div>
                    <div className="font-bold border-t border-border pt-2 font-serif">Neto</div>
                    <div className="text-right font-bold border-t border-border pt-2 number-pill">{eur(result.net_amount)}</div>
                  </div>
                  {result.splits?.length > 0 && (
                    <div className="mt-5 border-t border-border pt-4">
                      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-muted mb-3">Reparto entre inquilinos</div>
                      {result.splits.map((s) => (
                        <div key={s.tenant_id} className="flex justify-between text-sm py-1.5">
                          <span>{s.tenant_name} <span className="text-ink-muted">· {s.percentage}%</span></span>
                          <span className="mono font-semibold">{eur(s.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!analyzing && !result && (
                <div className="rounded-xl border border-dashed border-border p-12 bg-sage-50/40 text-center text-sm text-ink-soft">
                  El resultado del análisis aparecerá aquí
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
