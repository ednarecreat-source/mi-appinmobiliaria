import { formatCurrency, formatDate } from "@/lib/utils"
import { ArrowDownLeft, ArrowUpRight } from "lucide-react"

interface ActivityItem {
  id: string
  title: string
  subtitle: string
  amount: number
  date: string
  type: "income" | "expense"
}

interface RecentActivityProps {
  title: string
  items: ActivityItem[]
}

export function RecentActivity({ title, items }: RecentActivityProps) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm">
      <div className="p-6 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </div>
      <div className="divide-y divide-border">
        {items.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            No hay actividad reciente
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    item.type === "income"
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-rose-100 text-rose-600"
                  }`}
                >
                  {item.type === "income" ? (
                    <ArrowDownLeft className="w-4 h-4" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-foreground">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.subtitle}</p>
                </div>
              </div>
              <div className="text-right">
                <p
                  className={`font-semibold ${
                    item.type === "income" ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {item.type === "income" ? "+" : "-"}
                  {formatCurrency(Math.abs(item.amount))}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(item.date)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
