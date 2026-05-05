import { Building2, Users, Home, TrendingUp, TrendingDown } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface DashboardStatsProps {
  properties: number
  units: number
  tenants: number
  income: number
  expenses: number
}

export function DashboardStats({
  properties,
  units,
  tenants,
  income,
  expenses,
}: DashboardStatsProps) {
  const stats = [
    {
      name: "Inmuebles",
      value: properties,
      icon: Building2,
      color: "bg-primary",
    },
    {
      name: "Unidades",
      value: units,
      icon: Home,
      color: "bg-accent",
    },
    {
      name: "Inquilinos",
      value: tenants,
      icon: Users,
      color: "bg-amber-500",
    },
    {
      name: "Ingresos",
      value: formatCurrency(income),
      icon: TrendingUp,
      color: "bg-emerald-500",
      isMonetary: true,
    },
    {
      name: "Gastos",
      value: formatCurrency(expenses),
      icon: TrendingDown,
      color: "bg-rose-500",
      isMonetary: true,
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {stats.map((stat) => (
        <div
          key={stat.name}
          className="bg-card rounded-xl border border-border p-6 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className={`${stat.color} p-3 rounded-lg`}>
              <stat.icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{stat.name}</p>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
