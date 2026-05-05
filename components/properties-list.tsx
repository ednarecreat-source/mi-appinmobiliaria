"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Building2, Home, ChevronDown, ChevronRight, Plus, Trash2, Edit2, Loader2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface Unit {
  id: string
  name: string
  unit_type: string
  rental_mode: string
  rent_amount: number
  status: string
}

interface Property {
  id: string
  name: string
  address: string
  category: string
  units: Unit[]
}

interface PropertiesListProps {
  properties: Property[]
  workspaceId: string
}

export function PropertiesList({ properties, workspaceId }: PropertiesListProps) {
  const [expandedProperties, setExpandedProperties] = useState<Set<string>>(new Set())
  const [addingUnitTo, setAddingUnitTo] = useState<string | null>(null)
  const [deletingProperty, setDeletingProperty] = useState<string | null>(null)
  const [deletingUnit, setDeletingUnit] = useState<string | null>(null)
  const router = useRouter()

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedProperties)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedProperties(newExpanded)
  }

  const handleDeleteProperty = async (id: string) => {
    if (!confirm("Eliminar este inmueble y todas sus unidades?")) return
    setDeletingProperty(id)
    const supabase = createClient()
    await supabase.from("properties").delete().eq("id", id)
    setDeletingProperty(null)
    router.refresh()
  }

  const handleDeleteUnit = async (id: string) => {
    if (!confirm("Eliminar esta unidad?")) return
    setDeletingUnit(id)
    const supabase = createClient()
    await supabase.from("units").delete().eq("id", id)
    setDeletingUnit(null)
    router.refresh()
  }

  if (properties.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No hay inmuebles
        </h3>
        <p className="text-muted-foreground">
          Crea tu primer inmueble para empezar
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {properties.map((property) => (
        <div
          key={property.id}
          className="bg-card rounded-xl border border-border overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
            <button
              onClick={() => toggleExpanded(property.id)}
              className="flex items-center gap-3 flex-1 text-left"
            >
              {expandedProperties.has(property.id) ? (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              )}
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{property.name}</h3>
                <p className="text-sm text-muted-foreground">{property.address}</p>
              </div>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground px-3 py-1 bg-muted rounded-full">
                {property.units?.length || 0} unidades
              </span>
              <button
                onClick={() => setAddingUnitTo(property.id)}
                className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                title="Agregar unidad"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleDeleteProperty(property.id)}
                disabled={deletingProperty === property.id}
                className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                title="Eliminar inmueble"
              >
                {deletingProperty === property.id ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {expandedProperties.has(property.id) && (
            <div className="border-t border-border">
              {property.units?.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  No hay unidades. Agrega una nueva unidad.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {property.units?.map((unit) => (
                    <div
                      key={unit.id}
                      className="flex items-center justify-between p-4 pl-12 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-accent/10 rounded-lg">
                          <Home className="w-4 h-4 text-accent" />
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">{unit.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {unit.unit_type} - {unit.rental_mode === "long_term" ? "Larga temporada" : "Vacacional"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold text-foreground">
                            {formatCurrency(unit.rent_amount || 0)}
                          </p>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              unit.status === "occupied"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {unit.status === "occupied" ? "Ocupada" : "Vacante"}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteUnit(unit.id)}
                          disabled={deletingUnit === unit.id}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {deletingUnit === unit.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {addingUnitTo === property.id && (
            <UnitForm
              workspaceId={workspaceId}
              propertyId={property.id}
              onClose={() => setAddingUnitTo(null)}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function UnitForm({
  workspaceId,
  propertyId,
  onClose,
}: {
  workspaceId: string
  propertyId: string
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [unitType, setUnitType] = useState("apartment")
  const [rentalMode, setRentalMode] = useState("long_term")
  const [rentAmount, setRentAmount] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    await supabase.from("units").insert({
      workspace_id: workspaceId,
      property_id: propertyId,
      name,
      unit_type: unitType,
      rental_mode: rentalMode,
      rent_amount: parseFloat(rentAmount) || 0,
      status: "vacant",
    })

    setLoading(false)
    onClose()
    router.refresh()
  }

  return (
    <div className="border-t border-border p-4 bg-muted/30">
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-5">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Nombre unidad"
          required
        />
        <select
          value={unitType}
          onChange={(e) => setUnitType(e.target.value)}
          className="px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="apartment">Apartamento</option>
          <option value="studio">Estudio</option>
          <option value="house">Casa</option>
          <option value="room">Habitacion</option>
          <option value="office">Oficina</option>
          <option value="local">Local</option>
        </select>
        <select
          value={rentalMode}
          onChange={(e) => setRentalMode(e.target.value)}
          className="px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="long_term">Larga temporada</option>
          <option value="vacation">Vacacional</option>
        </select>
        <input
          type="number"
          value={rentAmount}
          onChange={(e) => setRentAmount(e.target.value)}
          className="px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Renta mensual"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-3 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  )
}
