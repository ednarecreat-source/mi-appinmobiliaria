import { useEffect, useState } from "react";
import { api, eur } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, ChevronDown, ChevronRight, Home, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const UNIT_TYPES = ["Local", "Estudio", "Duplex", "Dormitorio"];
const CATEGORIES = [
  { v: "residential", l: "Residencial" },
  { v: "commercial", l: "Comercial" },
  { v: "vacation", l: "Vacacional" },
];

function PropertyForm({ initial, onSaved, onClose }) {
  const [f, setF] = useState(
    initial || { name: "", address: "", category: "residential", description: "", image_url: "" }
  );
  const save = async () => {
    if (!f.name || !f.address) return toast.error("Nombre y dirección son requeridos");
    try {
      if (initial?.id) await api.put(`/properties/${initial.id}`, f);
      else await api.post("/properties", f);
      toast.success("Inmueble guardado");
      onSaved();
      onClose();
    } catch {
      toast.error("Error al guardar");
    }
  };
  return (
    <div className="space-y-3">
      <div>
        <Label>Nombre</Label>
        <Input data-testid="prop-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </div>
      <div>
        <Label>Dirección</Label>
        <Input data-testid="prop-address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
      </div>
      <div>
        <Label>Categoría</Label>
        <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
          <SelectTrigger data-testid="prop-category"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>URL imagen (opcional)</Label>
        <Input value={f.image_url} onChange={(e) => setF({ ...f, image_url: e.target.value })} />
      </div>
      <div>
        <Label>Descripción</Label>
        <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} className="bg-black hover:bg-neutral-800" data-testid="save-property">Guardar</Button>
      </DialogFooter>
    </div>
  );
}

function UnitForm({ initial, propertyId, onSaved, onClose }) {
  const [f, setF] = useState(
    initial || {
      property_id: propertyId,
      name: "",
      unit_type: "Estudio",
      rental_mode: "long_term",
      rent_amount: 0,
      daily_rate: 0,
      weekly_rate: 0,
      monthly_rate: 0,
      status: "vacant",
      description: "",
    }
  );
  const save = async () => {
    if (!f.name) return toast.error("Nombre requerido");
    try {
      const payload = { ...f, property_id: propertyId };
      if (initial?.id) await api.put(`/units/${initial.id}`, payload);
      else await api.post("/units", payload);
      toast.success("Unidad guardada");
      onSaved();
      onClose();
    } catch {
      toast.error("Error al guardar");
    }
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Nombre</Label>
          <Input data-testid="unit-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div>
          <Label>Tipo</Label>
          <Select value={f.unit_type} onValueChange={(v) => setF({ ...f, unit_type: v })}>
            <SelectTrigger data-testid="unit-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {UNIT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Modalidad</Label>
        <Select value={f.rental_mode} onValueChange={(v) => setF({ ...f, rental_mode: v })}>
          <SelectTrigger data-testid="unit-mode"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="long_term">Alquiler largo plazo</SelectItem>
            <SelectItem value="vacation">Vacacional</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {f.rental_mode === "long_term" ? (
        <div>
          <Label>Renta mensual (€)</Label>
          <Input type="number" value={f.rent_amount} onChange={(e) => setF({ ...f, rent_amount: parseFloat(e.target.value || 0) })} />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Día (€)</Label><Input type="number" value={f.daily_rate} onChange={(e) => setF({ ...f, daily_rate: parseFloat(e.target.value || 0) })} /></div>
          <div><Label>Semana (€)</Label><Input type="number" value={f.weekly_rate} onChange={(e) => setF({ ...f, weekly_rate: parseFloat(e.target.value || 0) })} /></div>
          <div><Label>Mes (€)</Label><Input type="number" value={f.monthly_rate} onChange={(e) => setF({ ...f, monthly_rate: parseFloat(e.target.value || 0) })} /></div>
        </div>
      )}
      <div>
        <Label>Estado</Label>
        <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="vacant">Libre</SelectItem>
            <SelectItem value="occupied">Ocupado</SelectItem>
            <SelectItem value="vacation">Vacacional</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} className="bg-black hover:bg-neutral-800" data-testid="save-unit">Guardar</Button>
      </DialogFooter>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    vacant: { l: "Libre", c: "bg-neutral-100 text-neutral-700" },
    occupied: { l: "Ocupado", c: "bg-emerald-100 text-emerald-700" },
    vacation: { l: "Vacacional", c: "bg-blue-100 text-blue-700" },
  };
  const m = map[status] || map.vacant;
  return <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${m.c}`}>{m.l}</span>;
}

export default function Properties() {
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [propOpen, setPropOpen] = useState(false);
  const [editProp, setEditProp] = useState(null);
  const [unitOpen, setUnitOpen] = useState(false);
  const [unitProp, setUnitProp] = useState(null);
  const [editUnit, setEditUnit] = useState(null);

  const load = async () => {
    const [p, u] = await Promise.all([api.get("/properties"), api.get("/units")]);
    setProperties(p.data);
    setUnits(u.data);
  };
  useEffect(() => { load(); }, []);

  const unitsOf = (pid) => units.filter((u) => u.property_id === pid);

  const delProp = async (p) => {
    if (!window.confirm(`¿Eliminar ${p.name} y todas sus unidades?`)) return;
    await api.delete(`/properties/${p.id}`);
    toast.success("Inmueble eliminado");
    load();
  };
  const delUnit = async (u) => {
    if (!window.confirm(`¿Eliminar ${u.name}?`)) return;
    await api.delete(`/units/${u.id}`);
    toast.success("Unidad eliminada");
    load();
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inmuebles & Unidades</h1>
          <p className="text-sm text-neutral-500 mt-1">Gestiona tus inmuebles. Haz click en una fila para ver sus unidades alquilables.</p>
        </div>
        <Dialog open={propOpen} onOpenChange={(v) => { setPropOpen(v); if (!v) setEditProp(null); }}>
          <DialogTrigger asChild>
            <Button className="bg-black hover:bg-neutral-800" data-testid="btn-new-property">
              <Plus className="w-4 h-4 mr-1" /> Nuevo Inmueble
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editProp ? "Editar" : "Nuevo"} Inmueble</DialogTitle></DialogHeader>
            <PropertyForm initial={editProp} onSaved={load} onClose={() => { setPropOpen(false); setEditProp(null); }} />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="overflow-hidden border border-border/60">
        <div className="grid grid-cols-[40px_1fr_1.2fr_130px_120px_120px] text-[11px] font-mono uppercase tracking-[0.2em] text-neutral-500 bg-neutral-50 border-b border-border px-4 py-3">
          <div></div>
          <div>Inmueble</div>
          <div>Dirección</div>
          <div>Categoría</div>
          <div>Unidades</div>
          <div className="text-right">Acciones</div>
        </div>
        {properties.length === 0 && (
          <div className="p-10 text-center text-sm text-neutral-500">No hay inmuebles. Crea el primero.</div>
        )}
        {properties.map((p) => {
          const us = unitsOf(p.id);
          const isOpen = expanded[p.id];
          return (
            <div key={p.id} className="border-b border-border last:border-b-0" data-testid={`property-row-${p.id}`}>
              <div
                className="grid grid-cols-[40px_1fr_1.2fr_130px_120px_120px] items-center px-4 py-3 hover:bg-neutral-50 cursor-pointer"
                onClick={() => setExpanded({ ...expanded, [p.id]: !isOpen })}
              >
                <div>{isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</div>
                <div className="font-semibold flex items-center gap-2"><Building2 className="w-4 h-4" /> {p.name}</div>
                <div className="text-sm text-neutral-600 truncate">{p.address}</div>
                <div><Badge variant="outline" className="capitalize">{p.category}</Badge></div>
                <div className="text-sm mono">{us.length}</div>
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button size="icon" variant="ghost" onClick={() => { setEditProp(p); setPropOpen(true); }} data-testid={`edit-prop-${p.id}`}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => delProp(p)} data-testid={`del-prop-${p.id}`}>
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </div>
              {isOpen && (
                <div className="bg-neutral-50/60 border-t border-border px-4 py-4 fade-in">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-neutral-500">Unidades alquilables</div>
                    <Button size="sm" variant="outline" onClick={() => { setUnitProp(p); setEditUnit(null); setUnitOpen(true); }} data-testid={`add-unit-${p.id}`}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Añadir unidad
                    </Button>
                  </div>
                  {us.length === 0 ? (
                    <div className="text-sm text-neutral-500 py-4">Sin unidades aún.</div>
                  ) : (
                    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {us.map((u) => (
                        <div key={u.id} className="bg-white border border-border rounded-md p-4" data-testid={`unit-${u.id}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 font-semibold"><Home className="w-4 h-4" /> {u.name}</div>
                            <StatusBadge status={u.status} />
                          </div>
                          <div className="mt-1 text-xs text-neutral-500">
                            {u.unit_type} · {u.rental_mode === "vacation" ? "Vacacional" : "Largo plazo"}
                          </div>
                          <div className="mt-3 text-sm mono">
                            {u.rental_mode === "vacation" ? (
                              <div className="space-y-0.5">
                                <div>Día: <b>{eur(u.daily_rate)}</b></div>
                                <div>Semana: <b>{eur(u.weekly_rate)}</b></div>
                                <div>Mes: <b>{eur(u.monthly_rate)}</b></div>
                              </div>
                            ) : (
                              <div>Renta: <b>{eur(u.rent_amount)}</b>/mes</div>
                            )}
                          </div>
                          <div className="mt-3 flex gap-1 justify-end">
                            <Button size="icon" variant="ghost" onClick={() => { setEditUnit(u); setUnitProp(p); setUnitOpen(true); }}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => delUnit(u)}>
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </Card>

      <Dialog open={unitOpen} onOpenChange={(v) => { setUnitOpen(v); if (!v) setEditUnit(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editUnit ? "Editar" : "Nueva"} Unidad · {unitProp?.name}</DialogTitle></DialogHeader>
          {unitProp && <UnitForm initial={editUnit} propertyId={unitProp.id} onSaved={load} onClose={() => { setUnitOpen(false); setEditUnit(null); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
