import { useEffect, useState, useRef } from "react";
import { api, eur } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Sparkles, FileText, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
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
    const r = new FileReader();
    r.onload = (e) => setPreview(e.target.result);
    r.readAsDataURL(f);
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
      setFile(null); setPreview("");
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
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Facturación</h1>
        <p className="text-sm text-neutral-500 mt-1">Sube facturas y la IA (GPT-4o) extrae importes, IVA, retenciones y reparte entre inquilinos.</p>
      </div>

      <Card className="p-6 border-2 border-dashed border-blue-400/40 bg-blue-50/30">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <div className="font-bold">Subir factura</div>
        </div>
        <div className="grid md:grid-cols-[1fr_200px_160px] gap-3 items-start">
          <div
            className="rounded-xl border-2 border-dashed border-blue-300 bg-white p-6 text-center cursor-pointer hover:bg-blue-50 transition"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onPick(e.dataTransfer.files?.[0]); }}
            data-testid="invoices-dropzone"
          >
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} data-testid="invoices-file-input" />
            {preview ? (
              <img src={preview} alt="" className="max-h-40 mx-auto rounded" />
            ) : (
              <>
                <Upload className="w-7 h-7 mx-auto text-blue-500" />
                <div className="text-sm mt-2">Arrastra o haz click</div>
              </>
            )}
          </div>
          <Select value={propertyId} onValueChange={setPropertyId}>
            <SelectTrigger data-testid="invoices-prop"><SelectValue placeholder="Inmueble (opcional)" /></SelectTrigger>
            <SelectContent>
              {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button className="bg-black hover:bg-neutral-800" onClick={analyze} disabled={!file || analyzing} data-testid="btn-upload-invoice">
            {analyzing ? "Analizando..." : "Analizar con IA"}
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden border border-border/60">
        <div className="grid grid-cols-[1fr_1.3fr_110px_110px_110px_130px_100px] text-[11px] font-mono uppercase tracking-[0.2em] text-neutral-500 bg-neutral-50 border-b border-border px-4 py-3">
          <div>Proveedor</div>
          <div>Concepto</div>
          <div className="text-right">Base</div>
          <div className="text-right">IVA</div>
          <div className="text-right">Retenc.</div>
          <div className="text-right">Neto</div>
          <div className="text-right">Acciones</div>
        </div>
        {invoices.length === 0 && <div className="p-10 text-center text-sm text-neutral-500">Aún no hay facturas.</div>}
        {invoices.map((inv) => (
          <div key={inv.id} className="grid grid-cols-[1fr_1.3fr_110px_110px_110px_130px_100px] items-center px-4 py-3 border-b border-border last:border-0 hover:bg-neutral-50" data-testid={`invoice-row-${inv.id}`}>
            <div>
              <div className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4" />{inv.vendor || "—"}</div>
              <div className="text-xs text-neutral-500 mono">{inv.invoice_date}</div>
            </div>
            <div className="text-sm text-neutral-700 truncate">{inv.concept}</div>
            <div className="text-right mono">{eur(inv.gross_amount)}</div>
            <div className="text-right mono text-emerald-700">+{eur(inv.iva)}</div>
            <div className="text-right mono text-red-600">-{eur(inv.retenciones)}</div>
            <div className="text-right mono font-bold">{eur(inv.net_amount)}</div>
            <div className="flex justify-end gap-1">
              <Button size="icon" variant="ghost" onClick={() => openView(inv.id)}><Eye className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => del(inv.id)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
            </div>
          </div>
        ))}
      </Card>

      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{viewing?.vendor} · {viewing?.invoice_date}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="text-sm text-neutral-600">{viewing.concept}</div>
              <div className="grid grid-cols-2 gap-y-2 text-sm mono">
                <div className="text-neutral-500">Base</div><div className="text-right">{eur(viewing.gross_amount)}</div>
                <div className="text-neutral-500">IVA ({viewing.iva_rate}%)</div><div className="text-right">+{eur(viewing.iva)}</div>
                <div className="text-neutral-500">Retenciones ({viewing.retenciones_rate}%)</div><div className="text-right text-red-600">-{eur(viewing.retenciones)}</div>
                <div className="font-bold border-t border-border pt-2">Neto</div>
                <div className="text-right font-bold border-t border-border pt-2">{eur(viewing.net_amount)}</div>
              </div>
              {viewing.splits?.length > 0 && (
                <div className="border-t border-border pt-3">
                  <div className="text-xs font-mono uppercase tracking-[0.2em] text-neutral-500 mb-2">Reparto IA</div>
                  {viewing.splits.map((s) => (
                    <div key={s.tenant_id} className="flex justify-between text-sm py-1">
                      <span>{s.tenant_name} · {s.percentage}%</span>
                      <span className="mono font-semibold">{eur(s.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              {viewing.image_base64 && (
                <img src={`data:image/jpeg;base64,${viewing.image_base64}`} alt="" className="max-h-96 mx-auto rounded border border-border" />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
