import { createClient } from "@/lib/supabase/server"
import { History, TrendingUp, TrendingDown, FileText, CalendarDays } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export default async function HistoricoPage() {
  const supabase = await createClient()
  
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id")
    .limit(1)
    .single()

  const workspaceId = workspaces?.id

  // Fetch historical data
  const [
    { data: snapshots },
    { data: invoices },
    { data: transactions },
    { data: reservations },
  ] = await Promise.all([
    supabase
      .from("monthly_snapshots")
      .select("*")
      .eq("workspace_id", workspaceId || "")
      .order("year_month", { ascending: false }),
    supabase
      .from("invoices")
      .select("*")
      .eq("workspace_id", workspaceId || ""),
    supabase
      .from("bank_transactions")
      .select("*")
      .eq("workspace_id", workspaceId || ""),
    supabase
      .from("reservations")
      .select("*")
      .eq("workspace_id", workspaceId || ""),
  ])

  // Calculate totals
  const totalInvoices = invoices?.reduce((sum, inv) => sum + Number(inv.net_amount || 0), 0) || 0
  const totalIncome = transactions?.filter(t => t.direction === "in").reduce((sum, t) => sum + Number(t.amount || 0), 0) || 0
  const totalExpenses = transactions?.filter(t => t.direction === "out").reduce((sum, t) => sum + Number(t.amount || 0), 0) || 0
  const totalReservations = reservations?.reduce((sum, r) => sum + Number(r.total_amount || 0), 0) || 0

  // Group by month
  const monthlyData = transactions?.reduce((acc, t) => {
    const month = t.date.substring(0, 7)
    if (!acc[month]) {
      acc[month] = { income: 0, expenses: 0 }
    }
    if (t.direction === "in") {
      acc[month].income += Number(t.amount)
    } else {
      acc[month].expenses += Number(t.amount)
    }
    return acc
  }, {} as Record<string, { income: number; expenses: number }>) || {}

  const sortedMonths = Object.keys(monthlyData).sort().reverse()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Historico</h1>
        <p className="text-muted-foreground mt-1">
          Resumen historico de tu cartera
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-sm text-muted-foreground">Total Ingresos</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(totalIncome)}
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-rose-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-rose-600" />
            </div>
            <span className="text-sm text-muted-foreground">Total Gastos</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(totalExpenses)}
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <FileText className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm text-muted-foreground">Facturas</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(totalInvoices)}
          </p>
          <p className="text-sm text-muted-foreground">{invoices?.length || 0} facturas</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <CalendarDays className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Reservas</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(totalReservations)}
          </p>
          <p className="text-sm text-muted-foreground">{reservations?.length || 0} reservas</p>
        </div>
      </div>

      {/* Monthly Breakdown */}
      <div className="bg-card rounded-xl border border-border">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Resumen Mensual</h2>
        </div>
        
        {sortedMonths.length === 0 ? (
          <div className="p-12 text-center">
            <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No hay datos historicos
            </h3>
            <p className="text-muted-foreground">
              Los datos apareceran aqui a medida que agregues movimientos
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sortedMonths.map((month) => {
              const data = monthlyData[month]
              const balance = data.income - data.expenses
              const [year, monthNum] = month.split("-")
              const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" })

              return (
                <div key={month} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div>
                    <h4 className="font-medium text-foreground capitalize">{monthName}</h4>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Ingresos</p>
                      <p className="font-semibold text-emerald-600">+{formatCurrency(data.income)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Gastos</p>
                      <p className="font-semibold text-rose-600">-{formatCurrency(data.expenses)}</p>
                    </div>
                    <div className="text-right min-w-[100px]">
                      <p className="text-sm text-muted-foreground">Balance</p>
                      <p className={`font-semibold ${balance >= 0 ? "text-foreground" : "text-rose-600"}`}>
                        {formatCurrency(balance)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
