import { useEffect, useMemo, useState } from "react";
import { api, eur } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

function daysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}
function fmt(d) {
  return d.toISOString().slice(0, 10);
}

function ReservationForm({ units, initial, onSaved, onClose }) {
  const [f, setF] = useState(
    initial || {
      unit_id: "",
      guest_name: "",
      guest_contact: "",
      check_in: "",
      check_out: "",
      rate_type: "daily",
      nights: 1,
      total_amount: 0,
      status: "confirmed",
      notes: "",
    }
  );

  const selUnit = units.find((u) => u.id === f.unit_id);

  // auto calc
  const compute = (upd) => {
    const next = { ...f, ...upd };
    if (next.check_in && next.check_out) {
      const d1 = new Date(next.check_in);
      const d2 = new Date(next.check_out);
      const nights = Math.max(1, Math.round((d2 - d1) / 86400000));
      next.nights = nights;
      const u = units.find((x) => x.id === next.unit_id);
      if (u) {
        if (next.rate_type === "daily") next.total_amount = +(u.daily_rate * nights).toFixed(2);
        else if (next.rate_type === "weekly") next.total_amount = +(u.weekly_rate * (nights / 7)).toFixed(2);
        else if (next.rate_type === "monthly") next.total_amount = +(u.monthly_rate * (nights / 30)).toFixed(2);
      }
    }
    setF(next);
  };

  const save = async () => {
    if (!f.unit_id || !f.guest_name || !f.check_in || !f.check_out) return toast.error("Completa los campos");
    try {
      if (initial?.id) await api.put(`/reservations/${initial.id}`, f);
      else await api.post("/reservations", f);
      toast.success("Reserva guardada");
      onSaved(); onClose();
    } catch { toast.error("Error"); }
  };
  return (
    <div className="space-y-3">
      <div>
        <Label>Unidad vacacional</Label>
        <Select value={f.unit_id} onValueChange={(v) => compute({ unit_id: v })}>
          <SelectTrigger data-testid="res-unit"><SelectValue placeholder="Selecciona unidad" /></SelectTrigger>
          <SelectContent>
            {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name} · {u.unit_type}</SelectItem>)}
          </SelectContent>
        </Select>
        {selUnit && (
          <div className="text-xs text-neutral-500 mt-1 mono">
            Día {eur(selUnit.daily_rate)} · Semana {eur(selUnit.weekly_rate)} · Mes {eur(selUnit.monthly_rate)}
          </div>
        )}
      </div>
      <div><Label>Huésped</Label><Input data-testid="res-guest" value={f.guest_name} onChange={(e) => setF({ ...f, guest_name: e.target.value })} /></div>
      <div><Label>Contacto</Label><Input value={f.guest_contact} onChange={(e) => setF({ ...f, guest_contact: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Check-in</Label><Input type="date" value={f.check_in} onChange={(e) => compute({ check_in: e.target.value })} data-testid="res-checkin" /></div>
        <div><Label>Check-out</Label><Input type="date" value={f.check_out} onChange={(e) => compute({ check_out: e.target.value })} data-testid="res-checkout" /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Tarifa</Label>
          <Select value={f.rate_type} onValueChange={(v) => compute({ rate_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Día</SelectItem>
              <SelectItem value="weekly">Semana</SelectItem>
              <SelectItem value="monthly">Mes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Noches</Label><Input type="number" value={f.nights} onChange={(e) => setF({ ...f, nights: parseInt(e.target.value || 1) })} /></div>
        <div><Label>Total €</Label><Input type="number" value={f.total_amount} onChange={(e) => setF({ ...f, total_amount: parseFloat(e.target.value || 0) })} /></div>
      </div>
      <div>
        <Label>Estado</Label>
        <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="confirmed">Confirmada</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} className="bg-black hover:bg-neutral-800" data-testid="save-reservation">Guardar</Button>
      </DialogFooter>
    </div>
  );
}

export default function Vacation() {
  const [units, setUnits] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [open, setOpen] = useState(false);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const load = async () => {
    const [u, r] = await Promise.all([api.get("/units"), api.get("/reservations")]);
    setUnits(u.data.filter((x) => x.rental_mode === "vacation"));
    setReservations(r.data);
  };
  useEffect(() => { load(); }, []);

  const days = daysInMonth(year, month);
  const dates = Array.from({ length: days }, (_, i) => new Date(year, month, i + 1));

  const byUnit = useMemo(() => {
    const m = {};
    units.forEach((u) => (m[u.id] = []));
    reservations.forEach((r) => { if (m[r.unit_id]) m[r.unit_id].push(r); });
    return m;
  }, [units, reservations]);

  const cellStatus = (unitId, day) => {
    const ds = fmt(day);
    const r = (byUnit[unitId] || []).find((x) => x.check_in <= ds && ds < x.check_out);
    return r;
  };

  const monthLabel = new Date(year, month, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  const shift = (d) => {
    let m = month + d;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  };

  const del = async (r) => {
    if (!window.confirm(`¿Eliminar reserva de ${r.guest_name}?`)) return;
    await api.delete(`/reservations/${r.id}`);
    load();
  };

  const totalMonth = reservations
    .filter((r) => r.check_in.slice(0, 7) === `${year}-${String(month + 1).padStart(2, "0")}`)
    .reduce((a, b) => a + Number(b.total_amount || 0), 0);

  return (
    <div className="space-y-8 fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-[0.25em] text-sage-600 mb-2">Vacacional</div>
          <h1 className="text-4xl font-serif font-bold tracking-tight">Alquiler vacacional</h1>
          <p className="text-sm text-ink-soft mt-2">Calendario de disponibilidad por unidad · tarifas por día, semana o mes.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary h-11 px-5" data-testid="btn-new-reservation"><Plus className="w-4 h-4 mr-1" /> Nueva reserva</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Nueva reserva</DialogTitle></DialogHeader>
            <ReservationForm units={units} onSaved={load} onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="card-soft p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" className="rounded-full" onClick={() => shift(-1)} data-testid="cal-prev"><ChevronLeft className="w-4 h-4" /></Button>
            <div className="capitalize font-serif font-bold text-xl w-56 text-center">{monthLabel}</div>
            <Button size="icon" variant="outline" className="rounded-full" onClick={() => shift(1)} data-testid="cal-next"><ChevronRight className="w-4 h-4" /></Button>
          </div>
          <div className="text-sm">
            <span className="text-ink-soft">Ingresos del mes:</span> <b className="mono text-sage-700">{eur(totalMonth)}</b>
          </div>
        </div>

        {units.length === 0 ? (
          <div className="text-sm text-ink-soft p-8 text-center bg-sage-50/40 rounded-xl border border-dashed border-border">
            No hay unidades vacacionales. Crea una unidad con modalidad "Vacacional" en Inmuebles.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <div className="min-w-max">
              <div className="grid" style={{ gridTemplateColumns: `180px repeat(${days}, 32px)` }}>
                <div className="text-[10px] font-mono uppercase tracking-wider text-ink-muted py-2 px-3 border-b border-border bg-sage-50 sticky left-0 z-10">Unidad</div>
                {dates.map((d) => (
                  <div key={fmt(d)} className="text-[10px] font-mono text-ink-muted text-center border-b border-border bg-sage-50 py-2">
                    {d.getDate()}
                  </div>
                ))}
                {units.flatMap((u) => [
                  <div key={`u-${u.id}`} className="py-3 px-3 border-b border-border sticky left-0 bg-cream-card z-10 text-sm">
                    <div className="font-serif font-bold truncate">{u.name}</div>
                    <div className="text-[11px] text-ink-soft">{u.unit_type}</div>
                  </div>,
                  ...dates.map((d) => {
                    const r = cellStatus(u.id, d);
                    const cls = r
                      ? r.status === "confirmed"
                        ? "bg-sage-500"
                        : r.status === "pending"
                          ? "bg-terracotta"
                          : "bg-cream-200"
                      : "bg-cream-card hover:bg-sage-50";
                    return (
                      <div
                        key={`${u.id}-${fmt(d)}`}
                        title={r ? `${r.guest_name} · ${r.check_in} → ${r.check_out}` : fmt(d)}
                        className={`h-10 border-b border-r border-border ${cls} cursor-pointer transition-colors`}
                      />
                    );
                  }),
                ])}
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-4 mt-4 text-xs text-ink-soft">
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-sage-500 rounded-sm" /> Confirmada</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-terracotta rounded-sm" /> Pendiente</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-cream-200 rounded-sm" /> Cancelada</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-cream-card border border-border rounded-sm" /> Disponible</div>
        </div>
      </div>

      <div className="card-soft overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_140px_140px_100px_110px_90px] text-[11px] font-mono uppercase tracking-[0.2em] text-ink-muted bg-sage-50 border-b border-border px-5 py-3.5">
          <div>Huésped</div>
          <div>Unidad</div>
          <div>Check-in</div>
          <div>Check-out</div>
          <div className="text-right">Noches</div>
          <div className="text-right">Total</div>
          <div className="text-right">Acciones</div>
        </div>
        {reservations.length === 0 && <div className="p-10 text-center text-sm text-ink-soft">Sin reservas.</div>}
        {reservations.map((r) => (
          <div key={r.id} className="grid grid-cols-[1fr_1fr_140px_140px_100px_110px_90px] items-center px-5 py-4 border-b border-border last:border-0 hover:bg-sage-50/60 transition-colors">
            <div>
              <div className="font-serif font-bold">{r.guest_name}</div>
              <div className="text-xs text-ink-soft">{r.guest_contact}</div>
            </div>
            <div className="text-sm">{units.find((u) => u.id === r.unit_id)?.name || "—"}</div>
            <div className="text-sm mono">{r.check_in}</div>
            <div className="text-sm mono">{r.check_out}</div>
            <div className="text-right mono">{r.nights}</div>
            <div className="text-right mono font-bold">{eur(r.total_amount)}</div>
            <div className="flex justify-end"><Button size="icon" variant="ghost" onClick={() => del(r)}><Trash2 className="w-4 h-4 text-terracotta" /></Button></div>
          </div>
        ))}
      </div>
    </div>
  );
}
