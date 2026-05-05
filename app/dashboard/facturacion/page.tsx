import { createClient } from "@/lib/supabase/server"
import { InvoicesList } from "@/components/invoices-list"
import { InvoiceUpload } from "@/components/invoice-upload"

export default async function FacturacionPage() {
  const supabase = await createClient()
  
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id")
    .limit(1)
    .single()

  const workspaceId = workspaces?.id

  const [{ data: invoices }, { data: properties }] = await Promise.all([
    supabase
      .from("invoices")
      .select(`
        *,
        property:properties(id, name)
      `)
      .eq("workspace_id", workspaceId || "")
      .order("invoice_date", { ascending: false }),
    supabase
      .from("properties")
      .select("id, name")
      .eq("workspace_id", workspaceId || ""),
  ])

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Facturacion</h1>
          <p className="text-muted-foreground mt-1">
            Sube facturas y extrae datos con IA
          </p>
        </div>
        <InvoiceUpload 
          workspaceId={workspaceId || ""} 
          properties={properties || []}
        />
      </div>

      <InvoicesList 
        invoices={invoices || []} 
        workspaceId={workspaceId || ""}
      />
    </div>
  )
}
