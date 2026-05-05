"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Plus, X, Loader2 } from "lucide-react"

interface Unit {
  id: string
  name: string
  daily_rate: number
  weekly_rate: number
  monthly_rate: number
  property?: { id: string; name: string }
}

interface ReservationFormProps {
  workspaceId: string
  units: Unit[]
}

export function ReservationForm({ workspaceId, units }: ReservationFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [unitId, setUnitId] = useState("")
  const [guestName, setGuestName] = useState("")
  const [guestContact, setGuestContact] = useState("")
  const [checkIn, setCheckIn] = useState("")
  const [checkOut, setCheckOut] = useState("")
  const [rateType, setRateType] = useState("daily")
  const [totalAmount, setTotalAmount] = useState("")
  const [notes, setNotes] = useState("")
  const router = useRouter()

  const selectedUnit = units.find((u) => u.id === unitId)

  const calculateTotal = () => {
    if (!checkIn || !checkOut || !selectedUnit) return

    const start = new Date(checkIn)
    const end = new Date(checkOut)
    const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

    let total = 0
    if (rateType === "daily") {
      total = nights * (selectedUnit.daily_rate || 0)
    } else if (rateType === "weekly") {
      const weeks = Math.ceil(nights / 7)
      total = weeks * (selectedUnit.weekly_rate || 0)
    } else if (rateType === "monthly") {
      const months = Math.ceil(nights / 30)
      total = months * (selectedUnit.monthly_rate || 0)
    }

    setTotalAmount(total.toFixed(2))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const start = new Date(checkIn)
    const end = new Date(checkOut)
    const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

    const supabase = createClient()
    
    await supabase.from("reservations").insert({
      workspace_id: workspaceId,
      unit_id: unitId,
      guest_name: guestName,
      guest_contact: guestContact || null,
      check_in: checkIn,
      check_out: checkOut,
      rate_type: rateType,
      nights,
      total_amount: parseFloat(totalAmount) || 0,
      status: "confirmed",
      notes: notes || null,
    })

    setLoading(false)
    handleClose()
    router.refresh()
  }

  const handleClose = () => {
    setOpen(false)
    setUnitId("")
    setGuestName("")
    setGuestContact("")
    setCheckIn("")
    setCheckOut("")
    setRateType("daily")
    setTotalAmount("")
    setNotes("")
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
      >
        <Plus className="w-5 h-5" />
        Nueva Reserva
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card">
              <h2 className="text-xl font-semibold text-foreground">
                Nueva Reserva
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
                  Unidad Vacacional *
                </label>
                <select
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                >
                  <option value="">Seleccionar unidad</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.property?.name} - {unit.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nombre del Huesped *
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Nombre completo"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Contacto
                </label>
                <input
                  type="text"
                  value={guestContact}
                  onChange={(e) => setGuestContact(e.target.value)}
                  className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Email o telefono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Check-in *
                  </label>
                  <input
                    type="date"
                    value={checkIn}
                    onChange={(e) => {
                      setCheckIn(e.target.value)
                      setTimeout(calculateTotal, 100)
                    }}
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Check-out *
                  </label>
                  <input
                    type="date"
                    value={checkOut}
                    onChange={(e) => {
                      setCheckOut(e.target.value)
                      setTimeout(calculateTotal, 100)
                    }}
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Tipo de Tarifa
                  </label>
                  <select
                    value={rateType}
                    onChange={(e) => {
                      setRateType(e.target.value)
                      setTimeout(calculateTotal, 100)
                    }}
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="daily">Diaria</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Total
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Notas
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  rows={3}
                  placeholder="Notas adicionales..."
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
