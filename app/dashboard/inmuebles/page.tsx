import { createClient } from "@/lib/supabase/server"
import { PropertiesList } from "@/components/properties-list"
import { PropertyForm } from "@/components/property-form"

export default async function InmueblesPage() {
  const supabase = await createClient()
  
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id")
    .limit(1)
    .single()

  const workspaceId = workspaces?.id

  const { data: properties } = await supabase
    .from("properties")
    .select(`
      *,
      units (*)
    `)
    .eq("workspace_id", workspaceId || "")
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inmuebles</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tus propiedades y unidades
          </p>
        </div>
        <PropertyForm workspaceId={workspaceId || ""} />
      </div>

      <PropertiesList 
        properties={properties || []} 
        workspaceId={workspaceId || ""} 
      />
    </div>
  )
}
