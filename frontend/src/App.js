import { useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import Properties from "@/pages/Properties";
import Tenants from "@/pages/Tenants";
import Invoices from "@/pages/Invoices";
import Vacation from "@/pages/Vacation";
import { Toaster } from "@/components/ui/sonner";
import { Building2, LayoutDashboard, Users, Receipt, CalendarDays, Menu, X, Leaf } from "lucide-react";

function Sidebar({ open, onClose }) {
  const items = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
    { to: "/inmuebles", label: "Inmuebles", icon: Building2, testid: "nav-properties" },
    { to: "/inquilinos", label: "Inquilinos", icon: Users, testid: "nav-tenants" },
    { to: "/facturacion", label: "Facturación", icon: Receipt, testid: "nav-invoices" },
    { to: "/vacacional", label: "Vacacional", icon: CalendarDays, testid: "nav-vacation" },
  ];
  return (
    <aside
      className={`fixed lg:static z-40 top-0 left-0 h-full w-64 bg-cream-card border-r border-border flex flex-col transition-transform ${
        open ? "translate-x-0" : "-translate-x-full"
      } lg:translate-x-0`}
      data-testid="sidebar"
    >
      <div className="h-20 flex items-center justify-between px-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sage-700 text-white grid place-items-center">
            <Leaf className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <div>
            <div className="font-serif font-bold text-lg leading-none">RCT</div>
            <div className="text-[11px] text-ink-soft tracking-wide">Inmobiliaria</div>
          </div>
        </div>
        <button className="lg:hidden text-ink-soft" onClick={onClose} data-testid="sidebar-close">
          <X className="w-5 h-5" />
        </button>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === "/"}
            data-testid={it.testid}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sage-700 text-white shadow-sm"
                  : "text-ink-soft hover:bg-sage-50 hover:text-sage-700"
              }`
            }
          >
            <it.icon className="w-4 h-4" />
            {it.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-5 mx-3 mb-3 rounded-xl bg-sage-50 border border-border">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-sage-600">
          IA · GPT-4o
        </div>
        <div className="text-xs text-ink-soft mt-1 leading-relaxed">
          Sube facturas en PDF o imagen. La IA reparte entre inquilinos.
        </div>
      </div>
    </aside>
  );
}

function Shell() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen flex text-ink">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-20 bg-cream-card/80 backdrop-blur-sm border-b border-border flex items-center px-4 lg:px-10 sticky top-0 z-30">
          <button className="lg:hidden mr-3 text-ink-soft" onClick={() => setOpen(true)} data-testid="sidebar-open">
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <div className="font-serif font-bold text-xl">Gestión Inmobiliaria</div>
            <div className="text-[11px] text-ink-soft tracking-wide">Panel de control</div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-sage-50 border border-border">
              <div className="w-2 h-2 rounded-full bg-sage-500" />
              <span className="text-xs font-medium text-sage-700">En línea</span>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-10 w-full max-w-[1500px] mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inmuebles" element={<Properties />} />
            <Route path="/inquilinos" element={<Tenants />} />
            <Route path="/facturacion" element={<Invoices />} />
            <Route path="/vacacional" element={<Vacation />} />
          </Routes>
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}

export default App;
