import { useEffect, useRef, useState } from "react";
import { api, eur } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Sparkles, Landmark, Trash2, CheckCircle2, ShieldCheck, RefreshCw, CreditCard } from "lucide-react";
import { toast } from "sonner";

export default function Bank() {
  const { activeWs } = useAuth();
  const [txs, setTxs] = useState([]);
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const fileRef = useRef(null);

  const load = async () => {
    const [t, p, te] = await Promise.all([api.get("/bank/transactions"), api.get("/properties"), api.get("/tenants")]);
    setTxs(t.data);
    setProperties(p.data);
    setTenants(te.data);
  };
  useEffect(() => { load(); }, [activeWs?.id]);

  const onUpload = async (f) => {
    if (!f) return;
    setParsing(true); setParsed(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const { data } = await api.post("/bank/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setParsed(data);
      toast.success(`${data.length} transacciones leídas con IA`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al procesar extracto");
    } finally {
      setParsing(false);
    }
  };

  const saveParsed = async () => {
    if (!parsed?.length) return;
    try {
      await api.post("/bank/transactions/bulk", parsed);
      toast.success("Transacciones guardadas");
      setParsed(null);
      load();
    } catch { toast.error("Error al guardar"); }
  };

  const update = async (id, patch) => {
    const tx = txs.find((x) => x.id === id);
    if (!tx) return;
    const upd = { ...tx, ...patch };
    delete upd.id; delete upd.workspace_id; delete upd.statement_id; delete upd.created_at;
    await api.put(`/bank/transactions/${id}`, upd);
    load();
  };

  const del = async (id) => {
    await api.delete(`/bank/transactions/${id}`);
    load();
  };

  const propName = (id) => properties.find((p) => p.id === id)?.name || "—";
  const tenantName = (id) => tenants.find((t) => t.id === id)?.name || "—";

  return (
    <div className="space-y-8 fade-in">
      <div>
        <div className="text-xs font-mono uppercase tracking-[0.25em] text-sage-600 mb-2">Banca</div>
        <h1 className="text-4xl font-serif font-bold">Conciliación bancaria</h1>
        <p className="text-sm text-ink-soft mt-2">Sube tu extracto bancario y la IA detecta a qué inmueble e inquilino corresponde cada movimiento.</p>
      </div>

      {/* PSD2 mock card */}
      <div className="card-soft p-10 text-center relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-sage-100 blur-3xl opacity-60 pointer-events-none" />
        <div className="relative">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-cream-card border border-border grid place-items-center text-sage-700 mb-5">
            <CreditCard className="w-7 h-7" strokeWidth={1.6} />
          </div>
          <h2 className="font-serif font-bold text-3xl tracking-tight">Conciliación bancaria inteligente</h2>
          <p className="text-base text-ink-soft mt-3 max-w-2xl mx-auto leading-relaxed">
            Conecta tus cuentas bancarias de forma segura para que nuestra IA identifique automáticamente qué pagos corresponden a cada inmueble.
          </p>
          <p className="font-serif font-bold text-lg text-sage-700 mt-3">Compatible con PSD2 y los principales bancos españoles.</p>

          <div className="grid sm:grid-cols-2 gap-4 mt-8 max-w-3xl mx-auto">
            <div className="card-soft p-5 text-left">
              <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-sage-700" /><div className="font-serif font-bold">Seguridad bancaria</div></div>
              <p className="text-sm text-ink-soft mt-2">Cifrado de nivel bancario AES-256. Solo lectura de transacciones.</p>
            </div>
            <div className="card-soft p-5 text-left">
              <div className="flex items-center gap-2"><RefreshCw className="w-5 h-5 text-sage-700" /><div className="font-serif font-bold">Sincronización IA</div></div>
              <p className="text-sm text-ink-soft mt-2">Detecta rentas e identifica facturas de suministros automáticamente.</p>
            </div>
          </div>

          <Button
            onClick={() => toast.info("Conexión bancaria PSD2: en beta. Mientras tanto sube tu extracto manualmente abajo 👇")}
            className="mt-8 h-14 px-8 text-base bg-sage-700 hover:bg-sage-800 text-white rounded-full"
            data-testid="btn-connect-psd2"
          >
            <CreditCard className="w-5 h-5 mr-2" />
            Conectar mis bancos
          </Button>
        </div>
      </div>

      {/* Manual upload */}
      <div className="card-soft p-7">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-sage-700 text-white grid place-items-center"><Sparkles className="w-5 h-5" /></div>
          <div>
            <h2 className="font-serif font-bold text-xl">Subir extracto bancario</h2>
            <div className="text-xs text-ink-soft">CSV, Excel (.xlsx) o PDF · La IA extrae y categoriza cada movimiento</div>
          </div>
        </div>
        <div
          className="dropzone-sage p-8 text-center cursor-pointer"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onUpload(e.dataTransfer.files?.[0]); }}
          data-testid="bank-dropzone"
        >
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.pdf,application/pdf,text/csv" className="hidden" onChange={(e) => onUpload(e.target.files?.[0])} data-testid="bank-file-input" />
          <Upload className="w-9 h-9 mx-auto text-sage-600" strokeWidth={1.7} />
          <div className="mt-3 font-serif font-semibold text-lg">{parsing ? "Procesando con IA..." : "Arrastra extracto bancario"}</div>
          <div className="text-xs text-ink-soft mt-1">CSV / XLSX / PDF</div>
        </div>

        {parsed && parsed.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="font-serif font-bold">Vista previa · {parsed.length} transacciones</div>
              <Button onClick={saveParsed} className="btn-primary" data-testid="btn-save-parsed">Guardar todas</Button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-sage-50 text-[11px] font-mono uppercase tracking-[0.2em] text-ink-muted">
                  <tr>
                    <th className="text-left p-3">Fecha</th>
                    <th className="text-left p-3">Concepto</th>
                    <th className="text-right p-3">Importe</th>
                    <th className="text-left p-3">Cat. IA</th>
                    <th className="text-left p-3">Match IA</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 50).map((t, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-3 mono">{t.date}</td>
                      <td className="p-3 truncate max-w-xs">{t.description}</td>
                      <td className={`p-3 text-right mono ${t.direction === "in" ? "text-sage-700" : "text-terracotta"}`}>
                        {t.direction === "in" ? "+" : "-"}{eur(t.amount)}
                      </td>
                      <td className="p-3 text-xs"><span className="px-2 py-0.5 rounded-full bg-sage-50 border border-border">{t.category}</span></td>
                      <td className="p-3 text-xs text-ink-soft">
                        {t.matched_property_id ? `🏠 ${propName(t.matched_property_id)}` : t.matched_tenant_id ? `👤 ${tenantName(t.matched_tenant_id)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Transactions */}
      <div className="card-soft overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-sage-50">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-sage-700" />
            <div className="font-serif font-bold">Transacciones guardadas</div>
            <span className="text-xs text-ink-soft mono">· {txs.length}</span>
          </div>
        </div>
        {txs.length === 0 ? (
          <div className="p-10 text-center text-sm text-ink-soft">Sube un extracto para ver tus transacciones aquí.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sage-50/60 text-[11px] font-mono uppercase tracking-[0.2em] text-ink-muted">
                <tr>
                  <th className="text-left p-3">Fecha</th>
                  <th className="text-left p-3">Concepto</th>
                  <th className="text-right p-3">Importe</th>
                  <th className="text-left p-3">Inmueble</th>
                  <th className="text-left p-3">Inquilino</th>
                  <th className="text-center p-3">Conciliada</th>
                  <th className="text-right p-3">·</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id} className="border-t border-border hover:bg-sage-50/40" data-testid={`btx-${t.id}`}>
                    <td className="p-3 mono">{t.date}</td>
                    <td className="p-3 max-w-md truncate">{t.description}</td>
                    <td className={`p-3 text-right mono ${t.direction === "in" ? "text-sage-700" : "text-terracotta"}`}>
                      {t.direction === "in" ? "+" : "-"}{eur(t.amount)}
                    </td>
                    <td className="p-3">
                      <Select value={t.matched_property_id || "none"} onValueChange={(v) => update(t.id, { matched_property_id: v === "none" ? "" : v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3">
                      <Select value={t.matched_tenant_id || "none"} onValueChange={(v) => update(t.id, { matched_tenant_id: v === "none" ? "" : v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {tenants.map((te) => <SelectItem key={te.id} value={te.id}>{te.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3 text-center">
                      <button onClick={() => update(t.id, { reconciled: !t.reconciled })} className={t.reconciled ? "text-sage-700" : "text-ink-muted"} data-testid={`reconcile-${t.id}`}>
                        <CheckCircle2 className="w-5 h-5" fill={t.reconciled ? "currentColor" : "none"} />
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <Button size="icon" variant="ghost" onClick={() => del(t.id)}><Trash2 className="w-4 h-4 text-terracotta" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
