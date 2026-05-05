"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Users, Mail, Phone, Building2, Home, Trash2, Loader2 } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

interface Tenant {
  id: string
  name: string
  email?: string
  phone?: string
  property?: { id: string; name: string }
  unit?: { id: string; name: string }
  split_percentage: number
  monthly_rent: number
  start_date?: string
}

interface TenantsListProps {
  tenants: Tenant[]
  properties: { id: string; name: string }[]
  units: { id: string; name: string; property_id: string }[]
  workspaceId: string
}

export function TenantsList({ tenants, workspaceId }: TenantsListProps) {
  const [deletingTenant, setDeletingTenant] = useState<string | null>(null)
  const router = useRouter()

  const handleDelete = async (id: string, unitId?: string) => {
    if (!confirm("Eliminar este inquilino?")) return
    setDeletingTenant(id)
    const supabase = createClient()
    
    // Update unit status back to vacant if there was one assigned
    if (unitId) {
      await supabase.from("units").update({ status: "vacant" }).eq("id", unitId)
    }
    
    await supabase.from("tenants").delete().eq("id", id)
    setDeletingTenant(null)
    router.refresh()
  }

  if (tenants.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No hay inquilinos
        </h3>
        <p className="text-muted-foreground">
          Agrega tu primer inquilino para empezar
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tenants.map((tenant) => (
        <div
          key={tenant.id}
          className="bg-card rounded-xl border border-border p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-lg font-semibold text-primary">
                  {tenant.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{tenant.name}</h3>
                {tenant.start_date && (
                  <p className="text-sm text-muted-foreground">
                    Desde {formatDate(tenant.start_date)}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => handleDelete(tenant.id, tenant.unit?.id)}
              disabled={deletingTenant === tenant.id}
              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
            >
              {deletingTenant === tenant.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="space-y-2 text-sm">
            {tenant.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span>{tenant.email}</span>
              </div>
            )}
            {tenant.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-4 h-4" />
                <span>{tenant.phone}</span>
              </div>
            )}
            {tenant.property && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="w-4 h-4" />
                <span>{tenant.property.name}</span>
              </div>
            )}
            {tenant.unit && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Home className="w-4 h-4" />
                <span>{tenant.unit.name}</span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Renta mensual</p>
              <p className="text-lg font-semibold text-foreground">
                {formatCurrency(tenant.monthly_rent || 0)}
              </p>
            </div>
            {tenant.split_percentage < 100 && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Reparto</p>
                <p className="text-lg font-semibold text-accent">
                  {tenant.split_percentage}%
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
