"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Plus, X, Loader2 } from "lucide-react"

interface Property {
  id: string
  name: string
}

interface Unit {
  id: string
  name: string
  property_id: string
}

interface TenantFormProps {
  workspaceId: string
  properties: Property[]
  units: Unit[]
  tenant?: {
    id: string
    name: string
    email?: string
    phone?: string
    property_id?: string
    unit_id?: string
    split_percentage: number
    monthly_rent: number
    start_date?: string
  }
  onClose?: () => void
}

export function TenantForm({ workspaceId, properties, units, tenant, onClose }: TenantFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState(tenant?.name || "")
  const [email, setEmail] = useState(tenant?.email || "")
  const [phone, setPhone] = useState(tenant?.phone || "")
  const [propertyId, setPropertyId] = useState(tenant?.property_id || "")
  const [unitId, setUnitId] = useState(tenant?.unit_id || "")
  const [splitPercentage, setSplitPercentage] = useState(tenant?.split_percentage?.toString() || "100")
  const [monthlyRent, setMonthlyRent] = useState(tenant?.monthly_rent?.toString() || "")
  const [startDate, setStartDate] = useState(tenant?.start_date || "")
  const router = useRouter()

  const filteredUnits = propertyId
    ? units.filter((u) => u.property_id === propertyId)
    : units

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    
    const data = {
      name,
      email: email || null,
      phone: phone || null,
      property_id: propertyId || null,
      unit_id: unitId || null,
      split_percentage: parseFloat(splitPercentage) || 100,
      monthly_rent: parseFloat(monthlyRent) || 0,
      start_date: startDate || null,
    }

    if (tenant) {
      await supabase.from("tenants").update(data).eq("id", tenant.id)
    } else {
      await supabase.from("tenants").insert({
        workspace_id: workspaceId,
        ...data,
      })
    }

    // Update unit status if assigned
    if (unitId) {
      await supabase.from("units").update({ status: "occupied" }).eq("id", unitId)
    }

    setLoading(false)
    setOpen(false)
    resetForm()
    onClose?.()
    router.refresh()
  }

  const resetForm = () => {
    setName("")
    setEmail("")
    setPhone("")
    setPropertyId("")
    setUnitId("")
    setSplitPercentage("100")
    setMonthlyRent("")
    setStartDate("")
  }

  const handleClose = () => {
    setOpen(false)
    onClose?.()
  }

  if (!open && !tenant) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
      >
        <Plus className="w-5 h-5" />
        Nuevo Inquilino
      </button>
    )
  }

  if (!open && !tenant) return null

  return (
    <>
      {!tenant && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card">
              <h2 className="text-xl font-semibold text-foreground">
                Nuevo Inquilino
              </h2>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Juan Garcia"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="email@ejemplo.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Telefono
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="+34 600 000 000"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Inmueble
                  </label>
                  <select
                    value={propertyId}
                    onChange={(e) => {
                      setPropertyId(e.target.value)
                      setUnitId("")
                    }}
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Sin asignar</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Unidad
                  </label>
                  <select
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    disabled={!propertyId}
                  >
                    <option value="">Sin asignar</option>
                    {filteredUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Renta Mensual
                  </label>
                  <input
                    type="number"
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    % Reparto
                  </label>
                  <input
                    type="number"
                    value={splitPercentage}
                    onChange={(e) => setSplitPercentage(e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Fecha Inicio Contrato
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
