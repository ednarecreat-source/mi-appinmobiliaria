import { useEffect, useState, useMemo } from "react";
import { api, eur } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Lock, ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export default function History() {
  const { activeWs } = useAuth();
  const [snaps, setSnaps] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [yearData, setYearData] = useState(null);

  const load = async () => {
    const { data } = await api.get("/history/months");
    setSnaps(data);
  };
  const loadYear = async (y) => {
    const { data } = await api.get(`/history/year/${y}`);
    setYearData(data);
  };

  useEffect(() => { load(); loadYear(year); }, [activeWs?.id]);
  useEffect(() => { loadYear(year); }, [year]);

  const closeMonth = async () => {
    const ym = new Date().toISOString().slice(0, 7);
    if (!window.confirm(`¿Cerrar el mes actual (${ym}) y guardar snapshot?\n(Si ya estaba cerrado se sobrescribe.)`)) return;
    try {
      await api.post("/history/close", { year_month: ym });
      toast.success("Mes cerrado y guardado");
      load(); loadYear(year);
    } catch { toast.error("Error al cerrar"); }
  };

  const closeSpecificMonth = async (ym) => {
    try {
      await api.post("/history/close", { year_month: ym });
      toast.success(`Snapshot de ${ym} guardado`);
      load(); loadYear(year);
    } catch { toast.error("Error"); }
  };

  const del = async (id) => {
    if (!window.confirm("¿Eliminar este snapshot?")) return;
    await api.delete(`/history/${id}`);
    load(); loadYear(year);
  };

  // Build complete year view (12 months)
  const yearMonths = useMemo(() => {
    const map = {};
    (yearData?.months || []).forEach((s) => { map[s.year_month] = s; });
    return Array.from({ length: 12 }, (_, i) => {
      const ym = `${year}-${String(i + 1).padStart(2, "0")}`;
      return { ym, month: i, snap: map[ym] };
    });
  }, [yearData, year]);

  const cur = yearData?.display_currency || activeWs?.display_currency || "EUR";

  // years with data
  const yearsWithData = useMemo(() => {
    const ys = new Set(snaps.map((s) => parseInt(s.year_month.slice(0, 4))));
    ys.add(new Date().getFullYear());
    return Array.from(ys).sort((a, b) => b - a);
  }, [snaps]);

  // Comparison: current month vs previous
  const sortedSnaps = [...snaps].sort((a, b) => a.year_month.localeCompare(b.year_month));
  const last = sortedSnaps[sortedSnaps.length - 1];
  const prev = sortedSnaps[sortedSnaps.length - 2];
  const compare = last && prev ? {
    income: ((last.stats.total_income || 0) - (prev.stats.total_income || 0)),
    expenses: ((last.stats.monthly_expenses || 0) - (prev.stats.monthly_expenses || 0)),
    net: ((last.stats.net_income || 0) - (prev.stats.net_income || 0)),
  } : null;

  return (
    <div className="space-y-8 fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-[0.25em] text-sage-600 mb-2">Histórico</div>
          <h1 className="text-4xl font-serif font-bold">Resúmenes financieros</h1>
          <p className="text-sm text-ink-soft mt-2">Cierra meses, conserva el histórico y compara la evolución año a año.</p>
        </div>
        <div className="flex gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-32" data-testid="year-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearsWithData.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={closeMonth} className="btn-primary" data-testid="btn-close-month"><Lock className="w-4 h-4 mr-1" /> Cerrar mes actual</Button>
        </div>
      </div>

      {/* Year summary */}
      {yearData && (
        <div className="card-soft p-7">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-sage-100 text-sage-700 grid place-items-center"><TrendingUp className="w-5 h-5" /></div>
            <div>
              <h2 className="font-serif font-bold text-xl">Resumen anual {year}</h2>
              <div className="text-xs text-ink-soft">{yearData.months?.length || 0} meses cerrados · divisa {cur}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-0 divide-x divide-border border border-border rounded-xl overflow-hidden bg-sage-50/30">
            <KpiCell label="Ingresos año" value={eur(yearData.totals?.total_income, cur)} accent="text-sage-700" />
            <KpiCell label="Gastos año" value={eur(yearData.totals?.monthly_expenses, cur)} accent="text-terracotta" />
            <KpiCell label="IVA año" value={eur(yearData.totals?.invoice_iva, cur)} accent="text-ink" />
            <KpiCell label="Retenciones año" value={eur(yearData.totals?.invoice_retenciones, cur)} accent="text-ink" />
            <KpiCell label="Neto limpio año" value={eur(yearData.totals?.net_income, cur)} accent={(yearData.totals?.net_income ?? 0) >= 0 ? "text-sage-700" : "text-terracotta"} bg="bg-sage-50/60" />
          </div>
        </div>
      )}

      {/* Comparison card */}
      {compare && (
        <div className="card-soft p-6">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-muted mb-3">Comparación · {prev.year_month} → {last.year_month}</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <CompareCell label="Ingresos" delta={compare.income} cur={cur} />
            <CompareCell label="Gastos" delta={compare.expenses} cur={cur} negativeIsGood />
            <CompareCell label="Neto limpio" delta={compare.net} cur={cur} />
          </div>
        </div>
      )}

      {/* 12 months grid */}
      <div className="card-soft overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-sage-50">
          <div className="font-serif font-bold">Meses {year}</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-5">
          {yearMonths.map(({ ym, month, snap }) => (
            <div key={ym} className={`card-soft p-4 ${snap ? "" : "opacity-70"}`} data-testid={`month-${ym}`}>
              <div className="flex items-center justify-between">
                <div className="capitalize font-serif font-bold">{MONTHS_ES[month]}</div>
                {snap ? (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => del(snap.id)}><Trash2 className="w-3.5 h-3.5 text-terracotta" /></Button>
                ) : (
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => closeSpecificMonth(ym)}>Cerrar</Button>
                )}
              </div>
              {snap ? (
                <div className="mt-3 space-y-1.5 text-sm mono">
                  <div className="flex justify-between text-ink-soft"><span>Ingresos</span><b className="text-sage-700">{eur(snap.stats?.total_income, cur)}</b></div>
                  <div className="flex justify-between text-ink-soft"><span>Gastos</span><b className="text-terracotta">{eur(snap.stats?.monthly_expenses, cur)}</b></div>
                  <div className="flex justify-between border-t border-border pt-1.5 mt-1.5"><span className="text-ink-soft">Neto limpio</span><b>{eur(snap.stats?.net_income, cur)}</b></div>
                </div>
              ) : (
                <div className="text-xs text-ink-soft mt-3">Sin snapshot. Pulsa "Cerrar" para guardarlo con los datos actuales.</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCell({ label, value, accent, bg }) {
  return (
    <div className={`p-5 ${bg || ""}`}>
      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-muted">{label}</div>
      <div className={`mt-2 text-xl font-serif font-bold mono ${accent || ""}`}>{value}</div>
    </div>
  );
}

function CompareCell({ label, delta, cur, negativeIsGood }) {
  const positive = delta >= 0;
  const good = negativeIsGood ? !positive : positive;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="rounded-xl border border-border bg-cream-card p-4">
      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-muted">{label}</div>
      <div className="flex items-center gap-2 mt-1.5">
        <Icon className={`w-4 h-4 ${good ? "text-sage-700" : "text-terracotta"}`} />
        <div className={`text-lg font-bold mono ${good ? "text-sage-700" : "text-terracotta"}`}>
          {positive ? "+" : ""}{eur(delta, cur)}
        </div>
      </div>
    </div>
  );
}
