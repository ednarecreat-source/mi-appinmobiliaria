import { useEffect, useMemo, useState } from "react";
import { api, eur } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, AlertTriangle, CheckCircle2, User } from "lucide-react";
import { toast } from "sonner";

function TenantForm({ initial, properties, units, onSaved, onClose, currentSums, allTenants }) {
  const [f, setF] = useState(
    initial || {
      name: "", email: "", phone: "", property_id: "", unit_id: "",
      split_percentage: 100, monthly_rent: 0, start_date: "",
    }
  );
  const filteredUnits = units.filter((u) => !f.property_id || u.property_id === f.property_id);

  // Compute projected total for the chosen property
  const projectedTotal = useMemo(() => {
    if (!f.property_id) return 0;
    const others = allTenants.filter((t) => t.property_id === f.property_id && t.id !== initial?.id);
    return others.reduce((a, t) => a + Number(t.split_percentage || 0), 0) + Number(f.split_percentage || 0);
  }, [f.property_id, f.split_percentage, allTenants, initial?.id]);

  const overflow = projectedTotal > 100.01;
  const exact = Math.abs(projectedTotal - 100) < 0.01;

  const save = async () => {
    if (!f.name) return toast.error("Nombre requerido");
    try {
      if (initial?.id) await api.put(`/tenants/${initial.id}`, f);
      else await api.post("/tenants", f);
      toast.success("Inquilino guardado");
      if (overflow) toast.warning(`Aviso: la suma de % en este inmueble es ${projectedTotal.toFixed(0)}% (supera 100)`);
      onSaved(); onClose();
    } catch { toast.error("Error al guardar"); }
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Nombre</Label><Input data-testid="tenant-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><Label>Email</Label><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Teléfono</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <div><Label>Inicio contrato</Label><Input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></div>
      </div>
      <div>
        <Label>Inmueble</Label>
        <Select value={f.property_id} onValueChange={(v) => setF({ ...f, property_id: v, unit_id: "" })}>
          <SelectTrigger data-testid="tenant-property"><SelectValue placeholder="Selecciona inmueble" /></SelectTrigger>
          <SelectContent>
            {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Unidad</Label>
        <Select value={f.unit_id} onValueChange={(v) => setF({ ...f, unit_id: v })}>
          <SelectTrigger data-testid="tenant-unit"><SelectValue placeholder="Selecciona unidad" /></SelectTrigger>
          <SelectContent>
            {filteredUnits.map((u) => <SelectItem key={u.id} value={u.id}>{u.name} · {u.unit_type}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>% de reparto (lo usa la IA)</Label>
          <Input data-testid="tenant-split" type="number" value={f.split_percentage} onChange={(e) => setF({ ...f, split_percentage: parseFloat(e.target.value || 0) })} />
        </div>
        <div>
          <Label>Renta mensual (€)</Label>
          <Input type="number" value={f.monthly_rent} onChange={(e) => setF({ ...f, monthly_rent: parseFloat(e.target.value || 0) })} />
        </div>
      </div>
      {f.property_id && (
        <div className={`rounded-lg p-3 text-xs flex items-center gap-2 border ${
          overflow ? "bg-terracotta-soft border-terracotta/30 text-terracotta" :
          exact ? "bg-sage-100 border-sage-200 text-sage-700" :
          "bg-cream-100 border-border text-ink-soft"
        }`}>
          {overflow ? <AlertTriangle className="w-4 h-4" /> : exact ? <CheckCircle2 className="w-4 h-4" /> : null}
          <span>
            Suma actual de % en este inmueble: <b>{projectedTotal.toFixed(0)}%</b>
            {overflow && " · supera el 100% (aviso)"}
            {exact && " · perfecto, suma 100%"}
            {!overflow && !exact && projectedTotal > 0 && ` · faltan ${(100 - projectedTotal).toFixed(0)}% por asignar`}
          </span>
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} className="btn-primary" data-testid="save-tenant">Guardar</Button>
      </DialogFooter>
    </div>
  );
}

export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);

  const load = async () => {
    const [t, p, u] = await Promise.all([api.get("/tenants"), api.get("/properties"), api.get("/units")]);
    setTenants(t.data);
    setProperties(p.data);
    setUnits(u.data);
  };
  useEffect(() => { load(); }, []);

  const del = async (t) => {
    if (!window.confirm(`¿Eliminar ${t.name}?`)) return;
    await api.delete(`/tenants/${t.id}`);
    toast.success("Eliminado");
    load();
  };

  const propName = (id) => properties.find((p) => p.id === id)?.name || "—";
  const unitName = (id) => units.find((u) => u.id === id)?.name || "—";

  const totalByProp = {};
  tenants.forEach((t) => {
    if (!t.property_id) return;
    totalByProp[t.property_id] = (totalByProp[t.property_id] || 0) + Number(t.split_percentage || 0);
  });

  const warnings = Object.entries(totalByProp).filter(([, v]) => v > 100.01);
  const partials = Object.entries(totalByProp).filter(([, v]) => v < 99.99 && v > 0);

  return (
    <div className="space-y-8 fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-[0.25em] text-sage-600 mb-2">Personas</div>
          <h1 className="text-4xl font-serif font-bold tracking-tight">Inquilinos</h1>
          <p className="text-sm text-ink-soft mt-2">Asigna un % de reparto a cada inquilino. La IA lo usará para dividir las facturas automáticamente.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEdit(null); }}>
          <DialogTrigger asChild>
            <Button className="btn-primary h-11 px-5" data-testid="btn-new-tenant"><Plus className="w-4 h-4 mr-1" /> Nuevo inquilino</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{edit ? "Editar" : "Nuevo"} inquilino</DialogTitle></DialogHeader>
            <TenantForm initial={edit} properties={properties} units={units} allTenants={tenants} currentSums={totalByProp} onSaved={load} onClose={() => { setOpen(false); setEdit(null); }} />
          </DialogContent>
        </Dialog>
      </div>

      {warnings.length > 0 && (
        <div className="card-soft p-5 border-l-4 border-l-terracotta bg-terracotta-soft/40">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-terracotta mt-0.5" />
            <div>
              <div className="font-serif font-bold text-terracotta">Aviso de reparto</div>
              <div className="text-sm text-ink mt-1">
                Estos inmuebles tienen una suma de % superior a 100% (la IA repartirá basándose en los % igualmente):
              </div>
              <ul className="text-sm mt-2 space-y-0.5 text-ink-soft">
                {warnings.map(([pid, v]) => (
                  <li key={pid}>· <b className="text-ink">{propName(pid)}</b> — suma actual: <span className="mono">{v.toFixed(0)}%</span></li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {partials.length > 0 && (
        <div className="card-soft p-5 border-l-4 border-l-sage-300 bg-sage-50/60">
          <div className="text-sm text-ink-soft">
            <b className="text-sage-700">Sugerencia:</b> en {partials.length === 1 ? "este inmueble" : "estos inmuebles"} aún quedan % por asignar:{" "}
            {partials.map(([pid, v], i) => (
              <span key={pid}>
                {i > 0 && ", "}
                <b className="text-ink">{propName(pid)}</b> ({v.toFixed(0)}% / 100%)
              </span>
            ))}.
          </div>
        </div>
      )}

      <div className="card-soft overflow-hidden">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_120px_140px_120px] text-[11px] font-mono uppercase tracking-[0.2em] text-ink-muted bg-sage-50 border-b border-border px-5 py-3.5">
          <div>Inquilino</div>
          <div>Inmueble</div>
          <div>Unidad</div>
          <div className="text-right">% Reparto</div>
          <div className="text-right">Renta</div>
          <div className="text-right">Acciones</div>
        </div>
        {tenants.length === 0 && <div className="p-12 text-center text-sm text-ink-soft">No hay inquilinos.</div>}
        {tenants.map((t) => (
          <div key={t.id} className="grid grid-cols-[1.4fr_1fr_1fr_120px_140px_120px] items-center px-5 py-4 border-b border-border last:border-0 hover:bg-sage-50/60 transition-colors" data-testid={`tenant-row-${t.id}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sage-100 grid place-items-center text-sage-700">
                <User className="w-4 h-4" />
              </div>
              <div>
                <div className="font-serif font-bold">{t.name}</div>
                <div className="text-xs text-ink-soft">{t.email || t.phone || "—"}</div>
              </div>
            </div>
            <div className="text-sm">{propName(t.property_id)}</div>
            <div className="text-sm text-ink-soft">{unitName(t.unit_id)}</div>
            <div className="text-right mono font-bold text-sage-700">{t.split_percentage}%</div>
            <div className="text-right mono">{eur(t.monthly_rent)}</div>
            <div className="flex justify-end gap-1">
              <Button size="icon" variant="ghost" onClick={() => { setEdit(t); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => del(t)}><Trash2 className="w-4 h-4 text-terracotta" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
