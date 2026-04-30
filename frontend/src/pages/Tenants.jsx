import { useEffect, useState } from "react";
import { api, eur } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

function TenantForm({ initial, properties, units, onSaved, onClose }) {
  const [f, setF] = useState(
    initial || {
      name: "",
      email: "",
      phone: "",
      property_id: "",
      unit_id: "",
      split_percentage: 100,
      monthly_rent: 0,
      start_date: "",
    }
  );
  const filteredUnits = units.filter((u) => !f.property_id || u.property_id === f.property_id);

  const save = async () => {
    if (!f.name) return toast.error("Nombre requerido");
    try {
      if (initial?.id) await api.put(`/tenants/${initial.id}`, f);
      else await api.post("/tenants", f);
      toast.success("Inquilino guardado");
      onSaved();
      onClose();
    } catch {
      toast.error("Error al guardar");
    }
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
          <Label>% de reparto (IA usa este %)</Label>
          <Input data-testid="tenant-split" type="number" value={f.split_percentage} onChange={(e) => setF({ ...f, split_percentage: parseFloat(e.target.value || 0) })} />
        </div>
        <div>
          <Label>Renta mensual (€)</Label>
          <Input type="number" value={f.monthly_rent} onChange={(e) => setF({ ...f, monthly_rent: parseFloat(e.target.value || 0) })} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} className="bg-black hover:bg-neutral-800" data-testid="save-tenant">Guardar</Button>
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

  // group by property for % total sanity check
  const totalByProp = {};
  tenants.forEach((t) => {
    if (!t.property_id) return;
    totalByProp[t.property_id] = (totalByProp[t.property_id] || 0) + Number(t.split_percentage || 0);
  });

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inquilinos</h1>
          <p className="text-sm text-neutral-500 mt-1">Asigna un % de reparto a cada inquilino. La IA lo usará para dividir facturas automáticamente.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEdit(null); }}>
          <DialogTrigger asChild>
            <Button className="bg-black hover:bg-neutral-800" data-testid="btn-new-tenant"><Plus className="w-4 h-4 mr-1" /> Nuevo Inquilino</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{edit ? "Editar" : "Nuevo"} Inquilino</DialogTitle></DialogHeader>
            <TenantForm initial={edit} properties={properties} units={units} onSaved={load} onClose={() => { setOpen(false); setEdit(null); }} />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="overflow-hidden border border-border/60">
        <div className="grid grid-cols-[1.3fr_1fr_1fr_120px_120px_100px] text-[11px] font-mono uppercase tracking-[0.2em] text-neutral-500 bg-neutral-50 border-b border-border px-4 py-3">
          <div>Inquilino</div>
          <div>Inmueble</div>
          <div>Unidad</div>
          <div className="text-right">% Reparto</div>
          <div className="text-right">Renta</div>
          <div className="text-right">Acciones</div>
        </div>
        {tenants.length === 0 && <div className="p-10 text-center text-sm text-neutral-500">No hay inquilinos.</div>}
        {tenants.map((t) => (
          <div key={t.id} className="grid grid-cols-[1.3fr_1fr_1fr_120px_120px_100px] items-center px-4 py-3 border-b border-border last:border-0 hover:bg-neutral-50" data-testid={`tenant-row-${t.id}`}>
            <div>
              <div className="font-semibold">{t.name}</div>
              <div className="text-xs text-neutral-500">{t.email || t.phone || "—"}</div>
            </div>
            <div className="text-sm">{propName(t.property_id)}</div>
            <div className="text-sm">{unitName(t.unit_id)}</div>
            <div className="text-right mono font-semibold">{t.split_percentage}%</div>
            <div className="text-right mono">{eur(t.monthly_rent)}</div>
            <div className="flex justify-end gap-1">
              <Button size="icon" variant="ghost" onClick={() => { setEdit(t); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => del(t)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
            </div>
          </div>
        ))}
      </Card>

      {Object.entries(totalByProp).some(([, v]) => Math.abs(v - 100) > 0.01) && (
        <Card className="p-4 border-amber-300 bg-amber-50">
          <div className="text-sm text-amber-800">
            ⚠️ Algunos inmuebles tienen % de reparto distinto de 100%. Revisa los porcentajes para que la IA divida correctamente.
          </div>
        </Card>
      )}
    </div>
  );
}
