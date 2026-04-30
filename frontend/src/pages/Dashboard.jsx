import { useEffect, useState, useRef } from "react";
import { api, eur } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Home, TrendingUp, Users, Upload, Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";

function Kpi({ label, value, icon: Icon, testid, hint }) {
  return (
    <Card className="p-6 bg-white border border-border/60 hover:shadow-md transition-shadow" data-testid={testid}>
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-neutral-500">{label}</div>
        <Icon className="w-4 h-4 text-neutral-400" />
      </div>
      <div className="mt-4 text-3xl font-bold font-mono tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}
    </Card>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const loadAll = async () => {
    const [s, p] = await Promise.all([api.get("/dashboard/stats"), api.get("/properties")]);
    setStats(s.data);
    setProperties(p.data);
  };
  useEffect(() => {
    loadAll();
  }, []);

  const onFileChange = (f) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(f);
  };

  const analyze = async () => {
    if (!file) {
      toast.error("Selecciona una factura primero");
      return;
    }
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
    <div className="space-y-8 fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-neutral-500 mt-1">Resumen general de tu cartera inmobiliaria</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="dashboard-kpis">
        <Kpi label="Inmuebles" value={stats?.total_properties ?? "—"} icon={Building2} testid="kpi-properties" />
        <Kpi label="Unidades" value={stats?.total_units ?? "—"} icon={Home} testid="kpi-units" hint={`${stats?.occupancy_rate ?? 0}% ocupación`} />
        <Kpi label="Ingresos Mes" value={eur(stats?.monthly_income)} icon={TrendingUp} testid="kpi-income" hint={`Neto: ${eur(stats?.net_income)}`} />
        <Kpi label="Inquilinos" value={stats?.total_tenants ?? "—"} icon={Users} testid="kpi-tenants" hint={`Gastos: ${eur(stats?.monthly_expenses)}`} />
      </div>

      {/* AI Invoice Upload */}
      <Card className="p-6 lg:p-8 border-2 border-dashed border-blue-400/40 bg-blue-50/40" data-testid="invoice-upload-widget">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-bold">Subir Factura con IA</h2>
          <span className="ml-2 text-[11px] font-mono uppercase tracking-[0.2em] text-blue-700 bg-blue-100 px-2 py-0.5 rounded">GPT-4o</span>
        </div>
        <p className="text-sm text-neutral-600 mb-5">
          Sube la imagen de una factura. La IA extrae importes, IVA y retenciones, y divide el cobro entre los inquilinos según su porcentaje asignado.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-mono uppercase tracking-[0.2em] text-neutral-500">Inmueble (opcional)</label>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger className="mt-2" data-testid="invoice-property-select">
                <SelectValue placeholder="Todos los inquilinos" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div
              className="mt-4 rounded-xl border-2 border-dashed border-blue-400/40 bg-white p-6 text-center cursor-pointer hover:bg-blue-50 transition"
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
                accept="image/*"
                className="hidden"
                data-testid="invoice-file-input"
                onChange={(e) => onFileChange(e.target.files?.[0])}
              />
              {preview ? (
                <img src={preview} alt="preview" className="max-h-56 mx-auto rounded" />
              ) : (
                <>
                  <Upload className="w-8 h-8 mx-auto text-blue-500" />
                  <div className="mt-2 font-medium">Arrastra una factura o haz click</div>
                  <div className="text-xs text-neutral-500">JPG, PNG o WEBP</div>
                </>
              )}
            </div>

            <Button
              className="mt-4 w-full bg-black hover:bg-neutral-800"
              onClick={analyze}
              disabled={analyzing || !file}
              data-testid="btn-analyze-invoice"
            >
              {analyzing ? "Analizando con GPT-4o..." : "Analizar con IA"}
            </Button>
          </div>

          <div>
            {analyzing && (
              <div className="rounded-lg border border-border p-6 bg-white">
                <div className="h-4 rounded shimmer w-1/2 mb-3" />
                <div className="h-3 rounded shimmer w-full mb-2" />
                <div className="h-3 rounded shimmer w-4/5 mb-2" />
                <div className="h-3 rounded shimmer w-3/5" />
                <div className="mt-4 text-xs font-mono uppercase tracking-[0.2em] text-blue-700">
                  GPT-4o analizando factura...
                </div>
              </div>
            )}
            {result && !analyzing && (
              <div className="rounded-lg border border-border p-5 bg-white fade-in" data-testid="invoice-result">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4" />
                  <div className="font-semibold">{result.vendor || "Factura"}</div>
                  <div className="ml-auto text-xs text-neutral-500 mono">{result.invoice_date}</div>
                </div>
                <div className="text-xs text-neutral-600 mb-4">{result.concept}</div>
                <div className="grid grid-cols-2 gap-y-2 text-sm mono">
                  <div className="text-neutral-500">Base</div>
                  <div className="text-right">{eur(result.gross_amount)}</div>
                  <div className="text-neutral-500">IVA ({result.iva_rate}%)</div>
                  <div className="text-right">+{eur(result.iva)}</div>
                  <div className="text-neutral-500">Retenciones ({result.retenciones_rate}%)</div>
                  <div className="text-right text-red-600">-{eur(result.retenciones)}</div>
                  <div className="font-bold border-t border-border pt-2">Neto</div>
                  <div className="text-right font-bold border-t border-border pt-2">{eur(result.net_amount)}</div>
                </div>
                {result.splits?.length > 0 && (
                  <div className="mt-4 border-t border-border pt-3">
                    <div className="text-xs font-mono uppercase tracking-[0.2em] text-neutral-500 mb-2">Reparto entre inquilinos</div>
                    {result.splits.map((s) => (
                      <div key={s.tenant_id} className="flex justify-between text-sm py-1">
                        <span>{s.tenant_name} <span className="text-neutral-500">· {s.percentage}%</span></span>
                        <span className="mono font-semibold">{eur(s.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!analyzing && !result && (
              <div className="rounded-lg border border-dashed border-border p-10 bg-white/50 text-center text-sm text-neutral-500">
                El resultado del análisis aparecerá aquí
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
