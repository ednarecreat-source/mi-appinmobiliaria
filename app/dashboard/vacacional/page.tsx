import { createClient } from "@/lib/supabase/server"
import { VacationCalendar } from "@/components/vacation-calendar"
import { ReservationForm } from "@/components/reservation-form"

export default async function VacacionalPage() {
  const supabase = await createClient()
  
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id")
    .limit(1)
    .single()

  const workspaceId = workspaces?.id

  const [{ data: units }, { data: reservations }] = await Promise.all([
    supabase
      .from("units")
      .select(`
        *,
        property:properties(id, name)
      `)
      .eq("workspace_id", workspaceId || "")
      .eq("rental_mode", "vacation"),
    supabase
      .from("reservations")
      .select(`
        *,
        unit:units(id, name, property:properties(id, name))
      `)
      .eq("workspace_id", workspaceId || "")
      .order("check_in", { ascending: true }),
  ])

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Vacacional</h1>
          <p className="text-muted-foreground mt-1">
            Calendario de reservas y disponibilidad
          </p>
        </div>
        <ReservationForm 
          workspaceId={workspaceId || ""} 
          units={units || []}
        />
      </div>

      <VacationCalendar 
        units={units || []} 
        reservations={reservations || []}
        workspaceId={workspaceId || ""}
      />
    </div>
  )
}
