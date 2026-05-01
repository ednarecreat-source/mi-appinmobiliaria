import { useEffect, useState } from "react";
import { api, eur, CURRENCIES } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, UserPlus, Coins, Globe2 } from "lucide-react";
import { toast } from "sonner";

export default function WorkspaceSettings() {
  const { activeWs, fetchWorkspaces, user, workspaces, switchWorkspace } = useAuth();
  const [name, setName] = useState("");
  const [displayCur, setDisplayCur] = useState("EUR");
  const [rates, setRates] = useState({ USD: 0.92, GBP: 1.18, MXN: 0.052, ARS: 0.0011, COP: 0.00024 });
  const [inviteEmail, setInviteEmail] = useState("");
  const [newWsName, setNewWsName] = useState("");

  useEffect(() => {
    if (activeWs) {
      setName(activeWs.name);
      setDisplayCur(activeWs.display_currency || "EUR");
      setRates({ ...{ USD: 0.92, GBP: 1.18, MXN: 0.052, ARS: 0.0011, COP: 0.00024 }, ...(activeWs.exchange_rates || {}) });
    }
  }, [activeWs]);

  const save = async () => {
    if (!activeWs) return;
    try {
      await api.put(`/workspaces/${activeWs.id}`, { name, display_currency: displayCur, exchange_rates: rates });
      toast.success("Cartera actualizada");
      const list = await fetchWorkspaces();
      const updated = list.find((w) => w.id === activeWs.id);
      if (updated) switchWorkspace(updated);
    } catch { toast.error("Error al guardar"); }
  };

  const createWs = async () => {
    if (!newWsName) return;
    try {
      const { data } = await api.post(`/workspaces`, { name: newWsName, display_currency: "EUR", exchange_rates: {} });
      toast.success("Cartera creada");
      const list = await fetchWorkspaces();
      const found = list.find((w) => w.id === data.id);
      if (found) switchWorkspace(found);
      setNewWsName("");
    } catch { toast.error("Error"); }
  };

  const invite = async () => {
    if (!inviteEmail || !activeWs) return;
    try {
      await api.post(`/workspaces/${activeWs.id}/invite`, { email: inviteEmail });
      toast.success("Miembro añadido a la cartera");
      setInviteEmail("");
      await fetchWorkspaces();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al invitar");
    }
  };

  const isOwner = activeWs && user && activeWs.owner_id === user.user_id;

  return (
    <div className="space-y-8 fade-in">
      <div>
        <div className="text-xs font-mono uppercase tracking-[0.25em] text-sage-600 mb-2">Configuración</div>
        <h1 className="text-4xl font-serif font-bold">Ajustes de cartera</h1>
        <p className="text-sm text-ink-soft mt-2">Nombre, divisa de visualización, tipos de cambio y miembros.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card-soft p-6">
          <div className="flex items-center gap-2 mb-5">
            <Globe2 className="w-4 h-4 text-sage-700" />
            <h2 className="font-serif font-bold text-lg">Cartera activa</h2>
          </div>
          <div className="space-y-4">
            <div><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isOwner} data-testid="ws-name" /></div>
            <div>
              <Label>Divisa de visualización (totales del dashboard)</Label>
              <Select value={displayCur} onValueChange={setDisplayCur} disabled={!isOwner}>
                <SelectTrigger data-testid="ws-currency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-4 h-4 text-sage-700" />
                <Label>Tipos de cambio (1 unidad → {displayCur})</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {CURRENCIES.filter((c) => c !== displayCur).map((c) => (
                  <div key={c}>
                    <Label className="text-xs">1 {c} = </Label>
                    <Input type="number" step="0.0001" value={rates[c] ?? ""} onChange={(e) => setRates({ ...rates, [c]: parseFloat(e.target.value || 0) })} disabled={!isOwner} data-testid={`rate-${c}`} />
                  </div>
                ))}
              </div>
            </div>
            <Button onClick={save} className="btn-primary w-full" disabled={!isOwner} data-testid="save-ws">Guardar cambios</Button>
            {!isOwner && <p className="text-xs text-ink-soft text-center">Solo el propietario de la cartera puede editar.</p>}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card-soft p-6">
            <div className="flex items-center gap-2 mb-5">
              <UserPlus className="w-4 h-4 text-sage-700" />
              <h2 className="font-serif font-bold text-lg">Compartir con familia</h2>
            </div>
            {isOwner ? (
              <>
                <Label>Email del miembro a invitar</Label>
                <div className="flex gap-2 mt-2">
                  <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="hermano@email.com" data-testid="invite-email" />
                  <Button onClick={invite} className="btn-primary" data-testid="btn-invite">Invitar</Button>
                </div>
                <p className="text-xs text-ink-soft mt-2">El usuario debe haber iniciado sesión al menos una vez con Google.</p>
                <div className="mt-5 border-t border-border pt-4">
                  <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-muted mb-2">Miembros actuales</div>
                  <ul className="space-y-1 text-sm">
                    {(activeWs?.member_ids || []).map((m) => (
                      <li key={m} className="flex items-center justify-between">
                        <span className="mono text-xs">{m === activeWs?.owner_id ? `👑 ${m}` : m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-soft">Estás en una cartera compartida. Solo el propietario puede invitar.</p>
            )}
          </div>

          <div className="card-soft p-6">
            <div className="flex items-center gap-2 mb-5">
              <Plus className="w-4 h-4 text-sage-700" />
              <h2 className="font-serif font-bold text-lg">Crear nueva cartera</h2>
            </div>
            <Label>Nombre</Label>
            <div className="flex gap-2 mt-2">
              <Input value={newWsName} onChange={(e) => setNewWsName(e.target.value)} placeholder="Ej: Inmuebles España" data-testid="new-ws-name" />
              <Button onClick={createWs} className="btn-primary" data-testid="btn-create-ws">Crear</Button>
            </div>
            <p className="text-xs text-ink-soft mt-2">Cada cartera es independiente. Útil para separar inmuebles por país o por dueño.</p>

            <div className="mt-5 border-t border-border pt-4">
              <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-muted mb-2">Tus carteras</div>
              <ul className="space-y-1 text-sm">
                {workspaces.map((w) => (
                  <li key={w.id} className="flex items-center justify-between py-1">
                    <span>{w.name}</span>
                    <span className="text-[10px] text-ink-muted mono">{w.display_currency} · {w.owner_id === user?.user_id ? "propietario" : "miembro"}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
