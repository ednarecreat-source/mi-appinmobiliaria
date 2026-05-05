import { createClient } from "@/lib/supabase/server"
import { DashboardStats } from "@/components/dashboard-stats"
import { RecentActivity } from "@/components/recent-activity"

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // Get user's workspaces
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name")
    .limit(1)
    .single()

  const workspaceId = workspaces?.id

  // Fetch dashboard data
  const [
    { count: propertiesCount },
    { count: tenantsCount },
    { count: unitsCount },
    { data: recentInvoices },
    { data: recentTransactions },
  ] = await Promise.all([
    supabase.from("properties").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId || ""),
    supabase.from("tenants").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId || ""),
    supabase.from("units").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId || ""),
    supabase.from("invoices").select("*").eq("workspace_id", workspaceId || "").order("created_at", { ascending: false }).limit(5),
    supabase.from("bank_transactions").select("*").eq("workspace_id", workspaceId || "").order("date", { ascending: false }).limit(5),
  ])

  // Calculate totals from invoices
  const totalExpenses = recentInvoices?.reduce((sum, inv) => sum + Number(inv.net_amount || 0), 0) || 0
  const totalIncome = recentTransactions?.filter(t => t.direction === "in").reduce((sum, t) => sum + Number(t.amount || 0), 0) || 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Bienvenido a tu panel de gestion inmobiliaria
        </p>
      </div>

      <DashboardStats
        properties={propertiesCount || 0}
        units={unitsCount || 0}
        tenants={tenantsCount || 0}
        income={totalIncome}
        expenses={totalExpenses}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentActivity
          title="Ultimas Facturas"
          items={(recentInvoices || []).map((inv) => ({
            id: inv.id,
            title: inv.vendor || "Sin proveedor",
            subtitle: inv.concept || "Sin concepto",
            amount: Number(inv.net_amount || 0),
            date: inv.invoice_date || inv.created_at,
            type: "expense" as const,
          }))}
        />
        <RecentActivity
          title="Ultimos Movimientos"
          items={(recentTransactions || []).map((tx) => ({
            id: tx.id,
            title: tx.description,
            subtitle: tx.category || "Sin categoria",
            amount: Number(tx.amount || 0),
            date: tx.date,
            type: tx.direction === "in" ? ("income" as const) : ("expense" as const),
          }))}
        />
      </div>
    </div>
  )
}
