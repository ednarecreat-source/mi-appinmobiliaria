import { createClient } from "@/lib/supabase/server"
import { TenantsList } from "@/components/tenants-list"
import { TenantForm } from "@/components/tenant-form"

export default async function InquilinosPage() {
  const supabase = await createClient()
  
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id")
    .limit(1)
    .single()

  const workspaceId = workspaces?.id

  const [{ data: tenants }, { data: properties }, { data: units }] = await Promise.all([
    supabase
      .from("tenants")
      .select(`
        *,
        property:properties(id, name),
        unit:units(id, name)
      `)
      .eq("workspace_id", workspaceId || "")
      .order("created_at", { ascending: false }),
    supabase
      .from("properties")
      .select("id, name")
      .eq("workspace_id", workspaceId || ""),
    supabase
      .from("units")
      .select("id, name, property_id")
      .eq("workspace_id", workspaceId || ""),
  ])

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inquilinos</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tus inquilinos y contratos
          </p>
        </div>
        <TenantForm 
          workspaceId={workspaceId || ""} 
          properties={properties || []}
          units={units || []}
        />
      </div>

      <TenantsList 
        tenants={tenants || []} 
        properties={properties || []}
        units={units || []}
        workspaceId={workspaceId || ""}
      />
    </div>
  )
}
