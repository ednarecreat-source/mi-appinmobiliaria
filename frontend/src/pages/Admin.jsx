import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ShieldCheck, Mail, User as UserIcon, Crown, Lock } from "lucide-react";
import { toast } from "sonner";

export default function Admin() {
  const { user } = useAuth();
  const [allowlist, setAllowlist] = useState([]);
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  const load = async () => {
    try {
      const [a, u] = await Promise.all([api.get("/admin/allowlist"), api.get("/admin/users")]);
      setAllowlist(a.data); setUsers(u.data);
    } catch (e) { toast.error("Error al cargar admin"); }
  };
  useEffect(() => { load(); }, []);

  const addEmail = async (e) => {
    e.preventDefault();
    if (!email.trim()) return toast.error("Email requerido");
    try {
      await api.post("/admin/allowlist", { email: email.trim().toLowerCase(), note: note.trim() });
      toast.success("Email añadido a la lista blanca");
      setEmail(""); setNote("");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error");
    }
  };

  const removeEmail = async (id) => {
    if (!window.confirm("¿Quitar este email de la lista?")) return;
    await api.delete(`/admin/allowlist/${id}`);
    toast.success("Eliminado");
    load();
  };

  const removeUser = async (uid, name) => {
    if (!window.confirm(`¿Eliminar al usuario "${name}"? Su sesión se cierra.`)) return;
    try {
      await api.delete(`/admin/users/${uid}`);
      toast.success("Usuario eliminado");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error");
    }
  };

  const toggleAdmin = async (uid, currentlyAdmin) => {
    const next = !currentlyAdmin;
    if (!window.confirm(next ? "¿Hacer administrador a este usuario?" : "¿Quitar privilegios de admin?")) return;
    try {
      await api.put(`/admin/users/${uid}/admin`, { is_admin: next });
      toast.success("Permisos actualizados");
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Error"); }
  };

  if (!user?.is_admin) {
    return (
      <div className="card-soft p-10 text-center">
        <Lock className="w-10 h-10 mx-auto text-terracotta mb-3" />
        <div className="font-serif font-bold text-xl">Acceso restringido</div>
        <p className="text-sm text-ink-soft mt-2">Esta sección es solo para administradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 fade-in">
      <div>
        <div className="text-xs font-mono uppercase tracking-[0.25em] text-sage-600 mb-2">Administración</div>
        <h1 className="text-4xl font-serif font-bold tracking-tight flex items-center gap-3">
          <Crown className="w-8 h-8 text-sage-700" /> Panel de administrador
        </h1>
        <p className="text-sm text-ink-soft mt-2">Controla qué emails pueden registrarse y gestiona los usuarios de la app.</p>
      </div>

      {/* Allowlist */}
      <div className="card-soft p-7">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-sage-100 text-sage-700 grid place-items-center"><ShieldCheck className="w-5 h-5" /></div>
          <div className="flex-1">
            <h2 className="font-serif font-bold text-xl">Lista de emails autorizados</h2>
            <div className="text-xs text-ink-soft">
              {allowlist.length === 0
                ? "Lista vacía: cualquier persona puede registrarse. Añade un email para activar el control."
                : `Solo estos emails (y el admin) pueden registrarse o iniciar sesión por primera vez con Google.`}
            </div>
          </div>
        </div>

        <form onSubmit={addEmail} className="grid md:grid-cols-[1.5fr_1.5fr_140px] gap-3 mb-5">
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3 top-3 text-ink-muted" />
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@ejemplo.com" className="pl-9 h-11" data-testid="allowlist-email" />
          </div>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (ej. Mi hermano)" className="h-11" data-testid="allowlist-note" />
          <Button type="submit" className="btn-primary h-11" data-testid="allowlist-add">
            <Plus className="w-4 h-4 mr-1" /> Añadir
          </Button>
        </form>

        {allowlist.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-sage-50/40 p-8 text-center text-sm text-ink-soft">
            Sin emails en la lista. Cualquier email se puede registrar.
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="grid grid-cols-[1.4fr_1.4fr_180px_60px] text-[11px] font-mono uppercase tracking-[0.2em] text-ink-muted bg-sage-50 px-4 py-3">
              <div>Email</div><div>Nota</div><div>Añadido</div><div></div>
            </div>
            {allowlist.map((a) => (
              <div key={a.id} className="grid grid-cols-[1.4fr_1.4fr_180px_60px] items-center px-4 py-3 border-t border-border" data-testid={`allow-${a.id}`}>
                <div className="font-medium">{a.email}</div>
                <div className="text-sm text-ink-soft">{a.note || "—"}</div>
                <div className="text-xs text-ink-soft mono">{a.created_at?.slice(0, 10)}</div>
                <div className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => removeEmail(a.id)}><Trash2 className="w-4 h-4 text-terracotta" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Users */}
      <div className="card-soft p-7">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-sage-100 text-sage-700 grid place-items-center"><UserIcon className="w-5 h-5" /></div>
          <div>
            <h2 className="font-serif font-bold text-xl">Usuarios registrados ({users.length})</h2>
            <div className="text-xs text-ink-soft">Puedes promover a admin, degradar o eliminar usuarios.</div>
          </div>
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-[1.5fr_1.5fr_120px_120px_140px_70px] text-[11px] font-mono uppercase tracking-[0.2em] text-ink-muted bg-sage-50 px-4 py-3">
            <div>Nombre</div><div>Email</div><div>Provider</div><div>Rol</div><div>Creado</div><div></div>
          </div>
          {users.map((u) => (
            <div key={u.user_id} className="grid grid-cols-[1.5fr_1.5fr_120px_120px_140px_70px] items-center px-4 py-3 border-t border-border" data-testid={`u-${u.user_id}`}>
              <div className="flex items-center gap-2">
                {u.picture ? <img src={u.picture} alt="" className="w-7 h-7 rounded-full" /> : <div className="w-7 h-7 rounded-full bg-sage-100 grid place-items-center text-xs">{(u.name || u.email)[0]?.toUpperCase()}</div>}
                <span className="font-medium">{u.name}</span>
              </div>
              <div className="text-sm text-ink-soft truncate">{u.email}</div>
              <div className="text-xs">
                <span className="px-2 py-0.5 rounded-full bg-sage-50 border border-border">{u.auth_provider || "email"}</span>
              </div>
              <div>
                <button onClick={() => toggleAdmin(u.user_id, u.is_admin)} className={`text-xs px-2 py-1 rounded-full border ${u.is_admin ? "bg-sage-100 text-sage-700 border-sage-300" : "bg-cream-100 text-ink-soft border-border"}`} disabled={u.user_id === user.user_id}>
                  {u.is_admin ? "👑 Admin" : "Usuario"}
                </button>
              </div>
              <div className="text-xs text-ink-soft mono">{u.created_at?.slice(0, 10)}</div>
              <div className="text-right">
                {u.user_id !== user.user_id && !u.is_admin && (
                  <Button size="icon" variant="ghost" onClick={() => removeUser(u.user_id, u.name)}><Trash2 className="w-4 h-4 text-terracotta" /></Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
