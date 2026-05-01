import { useEffect, useState, useRef } from "react";
import { api, eur } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Sparkles, FileText, Trash2, Eye, FileType2 } from "lucide-react";
import { toast } from "sonner";

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [isPdf, setIsPdf] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [viewing, setViewing] = useState(null);
  const fileRef = useRef(null);

  const load = async () => {
    const [i, p] = await Promise.all([api.get("/invoices"), api.get("/properties")]);
    setInvoices(i.data.sort((a, b) => b.created_at.localeCompare(a.created_at)));
    setProperties(p.data);
  };
  useEffect(() => { load(); }, []);

  const onPick = (f) => {
    if (!f) return;
    setFile(f);
    const pdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    setIsPdf(pdf);
    if (!pdf) {
      const r = new FileReader();
      r.onload = (e) => setPreview(e.target.result);
      r.readAsDataURL(f);
    } else setPreview("");
  };

  const analyze = async () => {
    if (!file) return toast.error("Selecciona una factura");
    setAnalyzing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (propertyId) fd.append("property_id", propertyId);
      await api.post("/invoices/analyze", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Factura analizada");
      setFile(null); setPreview(""); setIsPdf(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error");
    } finally {
      setAnalyzing(false);
    }
  };

  const del = async (id) => {
    if (!window.confirm("¿Eliminar factura?")) return;
    await api.delete(`/invoices/${id}`);
    load();
  };

  const openView = async (id) => {
    const { data } = await api.get(`/invoices/${id}`);
    setViewing(data);
  };

  return (
    <div className="space-y-8 fade-in">
      <div>
        <div className="text-xs font-mono uppercase tracking-[0.25em] text-sage-600 mb-2">Contabilidad</div>
        <h1 className="text-4xl font-serif font-bold tracking-tight">Facturación</h1>
        <p className="text-sm text-ink-soft mt-2">Sube facturas en PDF o imagen. La IA (GPT-4o) extrae importes, IVA, retenciones y reparte entre inquilinos.</p>
      </div>

      <div className="card-soft p-7 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-60 h-60 rounded-full bg-sage-100 blur-3xl opacity-50 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-sage-700 text-white grid place-items-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="font-serif font-bold text-lg">Subir factura</div>
              <div className="text-xs text-ink-soft">PDF, JPG, PNG, WEBP</div>
            </div>
          </div>
          <div className="grid md:grid-cols-[1fr_220px_180px] gap-3 items-start">
            <div
              className="dropzone-sage p-7 text-center cursor-pointer"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); onPick(e.dataTransfer.files?.[0]); }}
              data-testid="invoices-dropzone"
            >
              <input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} data-testid="invoices-file-input" />
              {preview && !isPdf ? (
                <img src={preview} alt="" className="max-h-40 mx-auto rounded-lg" />
              ) : isPdf ? (
                <div className="flex flex-col items-center gap-1">
                  <FileType2 className="w-8 h-8 text-sage-700" />
                  <div className="text-sm font-medium">{file?.name}</div>
                  <div className="text-xs text-ink-soft">PDF · listo</div>
                </div>
              ) : (
                <>
                  <Upload className="w-7 h-7 mx-auto text-sage-600" strokeWidth={1.7} />
                  <div className="text-sm mt-2 font-medium">Arrastra o haz click</div>
                  <div className="text-xs text-ink-soft mt-0.5">PDF, JPG, PNG, WEBP</div>
                </>
              )}
            </div>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger data-testid="invoices-prop" className="rounded-xl"><SelectValue placeholder="Inmueble (opcional)" /></SelectTrigger>
              <SelectContent>
                {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button className="btn-primary h-11" onClick={analyze} disabled={!file || analyzing} data-testid="btn-upload-invoice">
              {analyzing ? "Analizando..." : "Analizar con IA"}
            </Button>
          </div>
        </div>
      </div>

      <div className="card-soft overflow-hidden">
        <div className="grid grid-cols-[1fr_1.3fr_110px_110px_110px_130px_100px] text-[11px] font-mono uppercase tracking-[0.2em] text-ink-muted bg-sage-50 border-b border-border px-5 py-3.5">
          <div>Proveedor</div>
          <div>Concepto</div>
          <div className="text-right">Base</div>
          <div className="text-right">IVA</div>
          <div className="text-right">Retenc.</div>
          <div className="text-right">Neto</div>
          <div className="text-right">Acciones</div>
        </div>
        {invoices.length === 0 && <div className="p-12 text-center text-sm text-ink-soft">Aún no hay facturas.</div>}
        {invoices.map((inv) => (
          <div key={inv.id} className="grid grid-cols-[1fr_1.3fr_110px_110px_110px_130px_100px] items-center px-5 py-4 border-b border-border last:border-0 hover:bg-sage-50/60 transition-colors" data-testid={`invoice-row-${inv.id}`}>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-sage-700" />
              <div>
                <div className="font-serif font-bold">{inv.vendor || "—"}</div>
                <div className="text-xs text-ink-soft mono">{inv.invoice_date}</div>
              </div>
            </div>
            <div className="text-sm text-ink-soft truncate">{inv.concept}</div>
            <div className="text-right mono">{eur(inv.gross_amount)}</div>
            <div className="text-right mono text-sage-700">+{eur(inv.iva)}</div>
            <div className="text-right mono text-terracotta">-{eur(inv.retenciones)}</div>
            <div className="text-right mono font-bold">{eur(inv.net_amount)}</div>
            <div className="flex justify-end gap-1">
              <Button size="icon" variant="ghost" onClick={() => openView(inv.id)}><Eye className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => del(inv.id)}><Trash2 className="w-4 h-4 text-terracotta" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{viewing?.vendor} · {viewing?.invoice_date}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="text-sm text-ink-soft">{viewing.concept}</div>
              <div className="grid grid-cols-2 gap-y-2 text-sm mono">
                <div className="text-ink-soft">Base</div><div className="text-right">{eur(viewing.gross_amount)}</div>
                <div className="text-ink-soft">IVA ({viewing.iva_rate}%)</div><div className="text-right text-sage-700">+{eur(viewing.iva)}</div>
                <div className="text-ink-soft">Retenciones ({viewing.retenciones_rate}%)</div><div className="text-right text-terracotta">-{eur(viewing.retenciones)}</div>
                <div className="font-bold border-t border-border pt-2 font-serif">Neto</div>
                <div className="text-right font-bold border-t border-border pt-2">{eur(viewing.net_amount)}</div>
              </div>
              {viewing.splits?.length > 0 && (
                <div className="border-t border-border pt-3">
                  <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-muted mb-2">Reparto IA</div>
                  {viewing.splits.map((s) => (
                    <div key={s.tenant_id} className="flex justify-between text-sm py-1">
                      <span>{s.tenant_name} · {s.percentage}%</span>
                      <span className="mono font-semibold">{eur(s.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              {viewing.image_base64 && (
                <img src={`data:image/jpeg;base64,${viewing.image_base64}`} alt="" className="max-h-96 mx-auto rounded-lg border border-border" />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
