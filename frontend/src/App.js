import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import Properties from "@/pages/Properties";
import Tenants from "@/pages/Tenants";
import Invoices from "@/pages/Invoices";
import Vacation from "@/pages/Vacation";
import { Toaster } from "@/components/ui/sonner";
import { Building2, LayoutDashboard, Users, Receipt, CalendarDays, Menu, X } from "lucide-react";

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
      className={`fixed lg:static z-40 top-0 left-0 h-full w-64 bg-white border-r border-border flex flex-col transition-transform ${
        open ? "translate-x-0" : "-translate-x-full"
      } lg:translate-x-0`}
      data-testid="sidebar"
    >
      <div className="h-16 flex items-center justify-between px-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-black text-white grid place-items-center font-black">R</div>
          <div className="font-bold tracking-tight">RCT Inmobiliaria</div>
        </div>
        <button className="lg:hidden" onClick={onClose} data-testid="sidebar-close">
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
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive ? "bg-black text-white" : "text-neutral-700 hover:bg-neutral-100"
              }`
            }
          >
            <it.icon className="w-4 h-4" />
            {it.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 text-[11px] font-mono uppercase tracking-[0.2em] text-neutral-500 border-t border-border">
        v1.0 · IA GPT-4o
      </div>
    </aside>
  );
}

function Shell() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen flex bg-[#F9F9FB] text-neutral-900">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-border flex items-center px-4 lg:px-8 sticky top-0 z-30">
          <button className="lg:hidden mr-3" onClick={() => setOpen(true)} data-testid="sidebar-open">
            <Menu className="w-5 h-5" />
          </button>
          <div className="font-bold tracking-tight text-lg">Gestión Inmobiliaria</div>
          <div className="ml-auto text-xs font-mono uppercase tracking-[0.2em] text-neutral-500">
            Panel · Admin
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8 w-full max-w-[1600px] mx-auto">
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
