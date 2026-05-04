import { useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Properties from "@/pages/Properties";
import Tenants from "@/pages/Tenants";
import Invoices from "@/pages/Invoices";
import Vacation from "@/pages/Vacation";
import Bank from "@/pages/Bank";
import History from "@/pages/History";
import WorkspaceSettings from "@/pages/WorkspaceSettings";
import { Toaster } from "@/components/ui/sonner";
import { Building2, LayoutDashboard, Users, Receipt, CalendarDays, Menu, X, Leaf, LogOut, Landmark, History as HistoryIcon, Settings, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

function Sidebar({ open, onClose }) {
  const items = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
    { to: "/inmuebles", label: "Inmuebles", icon: Building2, testid: "nav-properties" },
    { to: "/inquilinos", label: "Inquilinos", icon: Users, testid: "nav-tenants" },
    { to: "/facturacion", label: "Facturación", icon: Receipt, testid: "nav-invoices" },
    { to: "/banco", label: "Banco", icon: Landmark, testid: "nav-bank" },
    { to: "/vacacional", label: "Vacacional", icon: CalendarDays, testid: "nav-vacation" },
    { to: "/historico", label: "Histórico", icon: HistoryIcon, testid: "nav-history" },
  ];
  return (
    <aside className={`fixed lg:static z-40 top-0 left-0 h-full w-64 bg-cream-card border-r border-border flex flex-col transition-transform ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`} data-testid="sidebar">
      <div className="h-20 flex items-center justify-between px-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sage-700 text-white grid place-items-center"><Leaf className="w-5 h-5" /></div>
          <div>
            <div className="font-serif font-bold text-lg leading-none">RCT</div>
            <div className="text-[11px] text-ink-soft tracking-wide">Inmobiliaria</div>
          </div>
        </div>
        <button className="lg:hidden text-ink-soft" onClick={onClose} data-testid="sidebar-close"><X className="w-5 h-5" /></button>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} data-testid={it.testid} onClick={onClose}
            className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${isActive ? "bg-sage-700 text-white shadow-sm" : "text-ink-soft hover:bg-sage-50 hover:text-sage-700"}`}>
            <it.icon className="w-4 h-4" />{it.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-5 mx-3 mb-3 rounded-xl bg-sage-50 border border-border">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-sage-600">IA · GPT-4o</div>
        <div className="text-xs text-ink-soft mt-1 leading-relaxed">PDF de facturas, conciliación bancaria, multi-divisa.</div>
      </div>
    </aside>
  );
}

function WorkspaceMenu() {
  const { workspaces, activeWs, switchWorkspace, user, logout } = useAuth();
  if (!user) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sage-50 hover:bg-sage-100 border border-border transition" data-testid="workspace-menu">
          {user.picture ? (
            <img src={user.picture} alt="" className="w-7 h-7 rounded-full" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-sage-300 grid place-items-center text-white text-xs font-bold">{(user.name || user.email)[0]?.toUpperCase()}</div>
          )}
          <div className="text-left hidden sm:block">
            <div className="text-xs font-bold leading-none">{activeWs?.name || "—"}</div>
            <div className="text-[10px] text-ink-soft mt-0.5">{user.name?.split(" ")[0] || user.email}</div>
          </div>
          <ChevronDown className="w-4 h-4 text-ink-soft" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-ink-muted">Tus carteras</div>
        {workspaces.map((w) => (
          <DropdownMenuItem key={w.id} onClick={() => switchWorkspace(w)} className={w.id === activeWs?.id ? "bg-sage-50 text-sage-700 font-bold" : ""} data-testid={`ws-${w.id}`}>
            <Building2 className="w-4 h-4 mr-2" /> {w.name} <span className="ml-auto text-[10px] text-ink-muted">{w.display_currency}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <NavLink to="/workspace" className="flex items-center w-full"><Settings className="w-4 h-4 mr-2" /> Ajustes & divisas</NavLink>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={logout} data-testid="btn-logout"><LogOut className="w-4 h-4 mr-2" /> Cerrar sesión</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Shell() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen flex text-ink">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-20 bg-cream-card/80 backdrop-blur-sm border-b border-border flex items-center px-4 lg:px-10 sticky top-0 z-30">
          <button className="lg:hidden mr-3 text-ink-soft" onClick={() => setOpen(true)} data-testid="sidebar-open"><Menu className="w-5 h-5" /></button>
          <div>
            <div className="font-serif font-bold text-xl">Gestión Inmobiliaria</div>
            <div className="text-[11px] text-ink-soft tracking-wide">Panel de control</div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <WorkspaceMenu />
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-10 w-full max-w-[1500px] mx-auto">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/inmuebles" element={<Properties />} />
            <Route path="/inquilinos" element={<Tenants />} />
            <Route path="/facturacion" element={<Invoices />} />
            <Route path="/banco" element={<Bank />} />
            <Route path="/vacacional" element={<Vacation />} />
            <Route path="/historico" element={<History />} />
            <Route path="/workspace" element={<WorkspaceSettings />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}

function AppRouter() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center bg-cream"><div className="text-sm text-ink-soft">Cargando…</div></div>;
  if (!user) return <Login />;
  return <Shell />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
