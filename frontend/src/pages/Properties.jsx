import { useEffect, useState } from "react";
import { api, eur } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Building2, ChevronDown, ChevronRight, Home, Pencil, Trash2, BedDouble, Banknote, Shield, Wrench, Zap, Landmark, Receipt } from "lucide-react";
import { toast } from "sonner";

const UNIT_TYPES = ["Local", "Estudio", "Duplex", "Dormitorio"];
const CATEGORIES = [
  { v: "residential", l: "Residencial" },
  { v: "commercial", l: "Comercial" },
  { v: "vacation", l: "Vacacional" },
];

const EXPENSE_CATEGORIES = [
  { v: "mortgage", l: "Hipoteca", icon: Landmark },
  { v: "insurance", l: "Seguro", icon: Shield },
  { v: "maintenance", l: "Mantenimiento", icon: Wrench },
  { v: "utilities", l: "Suministros", icon: Zap },
  { v: "community", l: "Comunidad", icon: Home },
  { v: "tax", l: "Impuestos (IBI)", icon: Receipt },
  { v: "other", l: "Otros", icon: Banknote },
];
const FREQ_LABEL = { monthly: "/mes", quarterly: "/trim", yearly: "/año" };

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
        <Button onClick={save} className="btn-primary" data-testid="save-property">Guardar</Button>
      </DialogFooter>
    </div>
  );
}

function UnitForm({ initial, propertyId, onSaved, onClose }) {
  const [f, setF] = useState(
    initial || {
      property_id: propertyId, name: "", unit_type: "Estudio", rental_mode: "long_term",
      rent_amount: 0, daily_rate: 0, weekly_rate: 0, monthly_rate: 0, status: "vacant", description: "",
    }
  );
  const save = async () => {
    if (!f.name) return toast.error("Nombre requerido");
    try {
      const payload = { ...f, property_id: propertyId };
      if (initial?.id) await api.put(`/units/${initial.id}`, payload);
      else await api.post("/units", payload);
      toast.success("Unidad guardada");
      onSaved(); onClose();
    } catch { toast.error("Error al guardar"); }
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Nombre</Label><Input data-testid="unit-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
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
        <Button onClick={save} className="btn-primary" data-testid="save-unit">Guardar</Button>
      </DialogFooter>
    </div>
  );
}

function ExpenseForm({ initial, propertyId, onSaved, onClose }) {
  const [f, setF] = useState(
    initial || { property_id: propertyId, name: "", category: "mortgage", amount: 0, frequency: "monthly", notes: "" }
  );
  const save = async () => {
    if (!f.name || !f.amount) return toast.error("Nombre e importe requeridos");
    try {
      const payload = { ...f, property_id: propertyId };
      if (initial?.id) await api.put(`/fixed-expenses/${initial.id}`, payload);
      else await api.post("/fixed-expenses", payload);
      toast.success("Gasto fijo guardado");
      onSaved(); onClose();
    } catch { toast.error("Error al guardar"); }
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Nombre</Label><Input data-testid="exp-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ej. Hipoteca BBVA" /></div>
        <div>
          <Label>Categoría</Label>
          <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
            <SelectTrigger data-testid="exp-category"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Importe (€)</Label><Input data-testid="exp-amount" type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: parseFloat(e.target.value || 0) })} /></div>
        <div>
          <Label>Frecuencia</Label>
          <Select value={f.frequency} onValueChange={(v) => setF({ ...f, frequency: v })}>
            <SelectTrigger data-testid="exp-frequency"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Mensual</SelectItem>
              <SelectItem value="quarterly">Trimestral</SelectItem>
              <SelectItem value="yearly">Anual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>Notas</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} className="btn-primary" data-testid="save-expense">Guardar</Button>
      </DialogFooter>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    vacant: { l: "Libre", c: "bg-cream-100 text-ink-soft border-border" },
    occupied: { l: "Ocupado", c: "bg-sage-100 text-sage-700 border-sage-200" },
    vacation: { l: "Vacacional", c: "bg-terracotta-soft text-terracotta border-terracotta/30" },
  };
  const m = map[status] || map.vacant;
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${m.c}`}>{m.l}</span>;
}

function PercentBadge({ total }) {
  if (total === undefined) return null;
  if (total === 0) return null;
  if (Math.abs(total - 100) < 0.01) {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-sage-100 text-sage-700 border border-sage-200">✓ 100%</span>;
  }
  if (total > 100) {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-terracotta-soft text-terracotta border border-terracotta/30" title="La suma supera 100%">⚠ {total.toFixed(0)}%</span>;
  }
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cream-100 text-ink-soft border border-border" title="Quedan inquilinos por asignar">{total.toFixed(0)}%</span>;
}

const CATEGORY_LABELS = { residential: "Residencial", commercial: "Comercial", vacation: "Vacacional" };

export default function Properties() {
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [pctSummary, setPctSummary] = useState({});
  const [expanded, setExpanded] = useState({});
  const [propOpen, setPropOpen] = useState(false);
  const [editProp, setEditProp] = useState(null);
  const [unitOpen, setUnitOpen] = useState(false);
  const [unitProp, setUnitProp] = useState(null);
  const [editUnit, setEditUnit] = useState(null);
  const [expOpen, setExpOpen] = useState(false);
  const [expProp, setExpProp] = useState(null);
  const [editExp, setEditExp] = useState(null);

  const load = async () => {
    const [p, u, s, e] = await Promise.all([
      api.get("/properties"), api.get("/units"), api.get("/tenants/percentage-summary"), api.get("/fixed-expenses"),
    ]);
    setProperties(p.data);
    setUnits(u.data);
    setPctSummary(s.data || {});
    setExpenses(e.data);
  };
  useEffect(() => { load(); }, []);

  const unitsOf = (pid) => units.filter((u) => u.property_id === pid);
  const expensesOf = (pid) => expenses.filter((e) => e.property_id === pid);
  const monthly = (e) => e.frequency === "monthly" ? e.amount : e.frequency === "quarterly" ? e.amount / 3 : e.amount / 12;

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
  const delExp = async (e) => {
    if (!window.confirm(`¿Eliminar "${e.name}"?`)) return;
    await api.delete(`/fixed-expenses/${e.id}`);
    toast.success("Gasto eliminado");
    load();
  };

  return (
    <div className="space-y-8 fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-[0.25em] text-sage-600 mb-2">Cartera</div>
          <h1 className="text-4xl font-serif font-bold tracking-tight">Inmuebles & unidades</h1>
          <p className="text-sm text-ink-soft mt-2">Haz click en un inmueble para ver sus unidades alquilables.</p>
        </div>
        <Dialog open={propOpen} onOpenChange={(v) => { setPropOpen(v); if (!v) setEditProp(null); }}>
          <DialogTrigger asChild>
            <Button className="btn-primary h-11 px-5" data-testid="btn-new-property">
              <Plus className="w-4 h-4 mr-1" /> Nuevo inmueble
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editProp ? "Editar" : "Nuevo"} inmueble</DialogTitle></DialogHeader>
            <PropertyForm initial={editProp} onSaved={load} onClose={() => { setPropOpen(false); setEditProp(null); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="card-soft overflow-hidden">
        <div className="grid grid-cols-[40px_1.4fr_1.3fr_140px_120px_140px_120px] text-[11px] font-mono uppercase tracking-[0.2em] text-ink-muted bg-sage-50 border-b border-border px-5 py-3.5">
          <div></div>
          <div>Inmueble</div>
          <div>Dirección</div>
          <div>Categoría</div>
          <div>Unidades</div>
          <div>% Asignado</div>
          <div className="text-right">Acciones</div>
        </div>
        {properties.length === 0 && (
          <div className="p-12 text-center text-sm text-ink-soft">No hay inmuebles. Crea el primero.</div>
        )}
        {properties.map((p) => {
          const us = unitsOf(p.id);
          const isOpen = expanded[p.id];
          const total = pctSummary[p.id] || 0;
          return (
            <div key={p.id} className="border-b border-border last:border-b-0" data-testid={`property-row-${p.id}`}>
              <div
                className="grid grid-cols-[40px_1.4fr_1.3fr_140px_120px_140px_120px] items-center px-5 py-4 hover:bg-sage-50/60 cursor-pointer transition-colors"
                onClick={() => setExpanded({ ...expanded, [p.id]: !isOpen })}
              >
                <div className="text-ink-muted">{isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</div>
                <div className="font-serif font-bold text-base flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-sage-100 grid place-items-center text-sage-700">
                    <Building2 className="w-4 h-4" />
                  </div>
                  {p.name}
                </div>
                <div className="text-sm text-ink-soft truncate">{p.address}</div>
                <div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] bg-sage-50 border border-border text-sage-700 capitalize">
                    {CATEGORY_LABELS[p.category] || p.category}
                  </span>
                </div>
                <div className="text-sm mono">{us.length}</div>
                <div><PercentBadge total={total} /></div>
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button size="icon" variant="ghost" className="hover:bg-sage-50" onClick={() => { setEditProp(p); setPropOpen(true); }} data-testid={`edit-prop-${p.id}`}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="hover:bg-terracotta-soft" onClick={() => delProp(p)} data-testid={`del-prop-${p.id}`}>
                    <Trash2 className="w-4 h-4 text-terracotta" />
                  </Button>
                </div>
              </div>
              {isOpen && (
                <div className="bg-sage-50/40 border-t border-border px-5 py-5 fade-in">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-sage-600">Unidades alquilables</div>
                    <Button size="sm" variant="outline" className="bg-white" onClick={() => { setUnitProp(p); setEditUnit(null); setUnitOpen(true); }} data-testid={`add-unit-${p.id}`}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Añadir unidad
                    </Button>
                  </div>
                  {us.length === 0 ? (
                    <div className="text-sm text-ink-soft py-6 text-center">Sin unidades aún.</div>
                  ) : (
                    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {us.map((u) => (
                        <div key={u.id} className="card-soft p-5" data-testid={`unit-${u.id}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 font-serif font-bold">
                              <BedDouble className="w-4 h-4 text-sage-700" /> {u.name}
                            </div>
                            <StatusBadge status={u.status} />
                          </div>
                          <div className="mt-1.5 text-xs text-ink-soft">
                            {u.unit_type} · {u.rental_mode === "vacation" ? "Vacacional" : "Largo plazo"}
                          </div>
                          <div className="mt-4 text-sm mono">
                            {u.rental_mode === "vacation" ? (
                              <div className="space-y-1 text-ink-soft">
                                <div className="flex justify-between"><span>Día</span><b className="text-ink">{eur(u.daily_rate)}</b></div>
                                <div className="flex justify-between"><span>Semana</span><b className="text-ink">{eur(u.weekly_rate)}</b></div>
                                <div className="flex justify-between"><span>Mes</span><b className="text-ink">{eur(u.monthly_rate)}</b></div>
                              </div>
                            ) : (
                              <div className="flex justify-between text-ink-soft">
                                <span>Renta mensual</span>
                                <b className="text-ink number-pill">{eur(u.rent_amount)}</b>
                              </div>
                            )}
                          </div>
                          <div className="mt-4 flex gap-1 justify-end">
                            <Button size="icon" variant="ghost" onClick={() => { setEditUnit(u); setUnitProp(p); setUnitOpen(true); }}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => delUnit(u)}>
                              <Trash2 className="w-4 h-4 text-terracotta" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Fixed expenses section */}
                  <div className="mt-6 pt-5 border-t border-border">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-sage-600">Gastos fijos del inmueble</div>
                        <div className="text-xs text-ink-soft mt-0.5">Hipoteca, seguros, comunidad, IBI, mantenimiento...</div>
                      </div>
                      <Button size="sm" variant="outline" className="bg-white" onClick={() => { setExpProp(p); setEditExp(null); setExpOpen(true); }} data-testid={`add-expense-${p.id}`}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Añadir gasto
                      </Button>
                    </div>
                    {expensesOf(p.id).length === 0 ? (
                      <div className="text-xs text-ink-soft py-4 text-center italic">Sin gastos fijos registrados.</div>
                    ) : (
                      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {expensesOf(p.id).map((e) => {
                          const cat = EXPENSE_CATEGORIES.find((c) => c.v === e.category) || EXPENSE_CATEGORIES[6];
                          const Icon = cat.icon;
                          return (
                            <div key={e.id} className="card-soft p-4" data-testid={`expense-${e.id}`}>
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-9 h-9 rounded-lg bg-terracotta-soft grid place-items-center text-terracotta">
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="font-serif font-bold text-sm">{e.name}</div>
                                    <div className="text-[11px] text-ink-soft">{cat.l}</div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="mono font-bold text-sm">{eur(e.amount)}</div>
                                  <div className="text-[10px] text-ink-soft mono">{FREQ_LABEL[e.frequency]}</div>
                                </div>
                              </div>
                              <div className="mt-3 flex items-center justify-between text-xs text-ink-soft">
                                <span>~ {eur(monthly(e))}/mes</span>
                                <div className="flex gap-0.5">
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditExp(e); setExpProp(p); setExpOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => delExp(e)}><Trash2 className="w-3.5 h-3.5 text-terracotta" /></Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={unitOpen} onOpenChange={(v) => { setUnitOpen(v); if (!v) setEditUnit(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editUnit ? "Editar" : "Nueva"} unidad · {unitProp?.name}</DialogTitle></DialogHeader>
          {unitProp && <UnitForm initial={editUnit} propertyId={unitProp.id} onSaved={load} onClose={() => { setUnitOpen(false); setEditUnit(null); }} />}
        </DialogContent>
      </Dialog>

      <Dialog open={expOpen} onOpenChange={(v) => { setExpOpen(v); if (!v) setEditExp(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editExp ? "Editar" : "Nuevo"} gasto fijo · {expProp?.name}</DialogTitle></DialogHeader>
          {expProp && <ExpenseForm initial={editExp} propertyId={expProp.id} onSaved={load} onClose={() => { setExpOpen(false); setEditExp(null); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
