"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ChevronLeft, ChevronRight, CalendarDays, Trash2, Loader2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  isSameMonth,
  isWithinInterval,
  parseISO,
} from "date-fns"
import { es } from "date-fns/locale"

interface Unit {
  id: string
  name: string
  property?: { id: string; name: string }
}

interface Reservation {
  id: string
  unit_id: string
  guest_name: string
  check_in: string
  check_out: string
  total_amount: number
  status: string
  unit?: { id: string; name: string; property?: { id: string; name: string } }
}

interface VacationCalendarProps {
  units: Unit[]
  reservations: Reservation[]
  workspaceId: string
}

export function VacationCalendar({ units, reservations }: VacationCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [deletingReservation, setDeletingReservation] = useState<string | null>(null)
  const router = useRouter()

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  })

  const getReservationsForDay = (day: Date, unitId: string) => {
    return reservations.filter((res) => {
      if (res.unit_id !== unitId) return false
      const checkIn = parseISO(res.check_in)
      const checkOut = parseISO(res.check_out)
      return isWithinInterval(day, { start: checkIn, end: checkOut })
    })
  }

  const handleDeleteReservation = async (id: string) => {
    if (!confirm("Eliminar esta reserva?")) return
    setDeletingReservation(id)
    const supabase = createClient()
    await supabase.from("reservations").delete().eq("id", id)
    setDeletingReservation(null)
    router.refresh()
  }

  if (units.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No hay unidades vacacionales
        </h3>
        <p className="text-muted-foreground">
          Crea unidades con modo &quot;Vacacional&quot; para gestionar reservas
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-semibold text-foreground capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: es })}
          </h2>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-left text-sm font-medium text-muted-foreground border-b border-border sticky left-0 bg-card min-w-[150px]">
                  Unidad
                </th>
                {days.map((day) => (
                  <th
                    key={day.toISOString()}
                    className={`p-2 text-center text-sm font-medium border-b border-border min-w-[40px] ${
                      isSameMonth(day, currentMonth)
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    <div>{format(day, "d")}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(day, "EEE", { locale: es })}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id}>
                  <td className="p-2 border-b border-border sticky left-0 bg-card">
                    <div className="font-medium text-foreground text-sm">
                      {unit.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {unit.property?.name}
                    </div>
                  </td>
                  {days.map((day) => {
                    const dayReservations = getReservationsForDay(day, unit.id)
                    const hasReservation = dayReservations.length > 0
                    const reservation = dayReservations[0]
                    const isCheckIn = reservation && format(parseISO(reservation.check_in), "yyyy-MM-dd") === format(day, "yyyy-MM-dd")
                    const isCheckOut = reservation && format(parseISO(reservation.check_out), "yyyy-MM-dd") === format(day, "yyyy-MM-dd")

                    return (
                      <td
                        key={day.toISOString()}
                        className={`p-0 border-b border-border text-center ${
                          hasReservation
                            ? isCheckIn
                              ? "bg-primary/80"
                              : isCheckOut
                                ? "bg-primary/40"
                                : "bg-primary/60"
                            : "bg-emerald-50"
                        }`}
                        title={
                          reservation
                            ? `${reservation.guest_name} (${reservation.check_in} - ${reservation.check_out})`
                            : "Disponible"
                        }
                      >
                        <div className="h-10" />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-emerald-100 rounded" />
            <span className="text-muted-foreground">Disponible</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-primary/60 rounded" />
            <span className="text-muted-foreground">Ocupado</span>
          </div>
        </div>
      </div>

      {/* Reservations List */}
      <div className="bg-card rounded-xl border border-border">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Reservas del mes</h3>
        </div>
        <div className="divide-y divide-border">
          {reservations.filter((r) => {
            const checkIn = parseISO(r.check_in)
            return isSameMonth(checkIn, currentMonth)
          }).length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No hay reservas este mes
            </div>
          ) : (
            reservations
              .filter((r) => {
                const checkIn = parseISO(r.check_in)
                return isSameMonth(checkIn, currentMonth)
              })
              .map((reservation) => (
                <div
                  key={reservation.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                >
                  <div>
                    <h4 className="font-medium text-foreground">
                      {reservation.guest_name}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {reservation.unit?.property?.name} - {reservation.unit?.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(reservation.check_in), "d MMM", { locale: es })} -{" "}
                      {format(parseISO(reservation.check_out), "d MMM yyyy", { locale: es })}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold text-foreground">
                        {formatCurrency(reservation.total_amount)}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          reservation.status === "confirmed"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {reservation.status === "confirmed" ? "Confirmada" : "Pendiente"}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteReservation(reservation.id)}
                      disabled={deletingReservation === reservation.id}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {deletingReservation === reservation.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  )
}
