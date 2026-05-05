import { createClient } from "@/lib/supabase/server"
import { TransactionsList } from "@/components/transactions-list"
import { TransactionForm } from "@/components/transaction-form"

export default async function BancoPage() {
  const supabase = await createClient()
  
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id")
    .limit(1)
    .single()

  const workspaceId = workspaces?.id

  const [{ data: transactions }, { data: properties }, { data: tenants }] = await Promise.all([
    supabase
      .from("bank_transactions")
      .select(`
        *,
        property:properties(id, name),
        tenant:tenants(id, name)
      `)
      .eq("workspace_id", workspaceId || "")
      .order("date", { ascending: false }),
    supabase
      .from("properties")
      .select("id, name")
      .eq("workspace_id", workspaceId || ""),
    supabase
      .from("tenants")
      .select("id, name")
      .eq("workspace_id", workspaceId || ""),
  ])

  // Calculate totals
  const income = transactions?.filter(t => t.direction === "in").reduce((sum, t) => sum + Number(t.amount), 0) || 0
  const expenses = transactions?.filter(t => t.direction === "out").reduce((sum, t) => sum + Number(t.amount), 0) || 0

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Banco</h1>
          <p className="text-muted-foreground mt-1">
            Conciliacion bancaria y movimientos
          </p>
        </div>
        <TransactionForm 
          workspaceId={workspaceId || ""} 
          properties={properties || []}
          tenants={tenants || []}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-card rounded-xl border border-border p-6">
          <p className="text-sm text-muted-foreground">Ingresos</p>
          <p className="text-2xl font-bold text-emerald-600">
            +{new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(income)}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-6">
          <p className="text-sm text-muted-foreground">Gastos</p>
          <p className="text-2xl font-bold text-rose-600">
            -{new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(expenses)}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-6">
          <p className="text-sm text-muted-foreground">Balance</p>
          <p className={`text-2xl font-bold ${income - expenses >= 0 ? "text-foreground" : "text-rose-600"}`}>
            {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(income - expenses)}
          </p>
        </div>
      </div>

      <TransactionsList 
        transactions={transactions || []} 
        properties={properties || []}
        tenants={tenants || []}
        workspaceId={workspaceId || ""}
      />
    </div>
  )
}
