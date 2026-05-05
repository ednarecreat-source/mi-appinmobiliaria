"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Landmark, Trash2, Loader2, ArrowDownLeft, ArrowUpRight, Building2, Users } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  direction: string
  category: string
  property?: { id: string; name: string }
  tenant?: { id: string; name: string }
  reconciled: boolean
  notes?: string
}

interface TransactionsListProps {
  transactions: Transaction[]
  properties: { id: string; name: string }[]
  tenants: { id: string; name: string }[]
  workspaceId: string
}

const categoryLabels: Record<string, string> = {
  rent: "Alquiler",
  deposit: "Deposito",
  utilities: "Suministros",
  maintenance: "Mantenimiento",
  insurance: "Seguros",
  taxes: "Impuestos",
  mortgage: "Hipoteca",
  other: "Otros",
}

export function TransactionsList({ transactions }: TransactionsListProps) {
  const [deletingTransaction, setDeletingTransaction] = useState<string | null>(null)
  const router = useRouter()

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminar este movimiento?")) return
    setDeletingTransaction(id)
    const supabase = createClient()
    await supabase.from("bank_transactions").delete().eq("id", id)
    setDeletingTransaction(null)
    router.refresh()
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <Landmark className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No hay movimientos
        </h3>
        <p className="text-muted-foreground">
          Agrega tu primer movimiento bancario
        </p>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="divide-y divide-border">
        {transactions.map((transaction) => (
          <div
            key={transaction.id}
            className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div
                className={`p-3 rounded-lg ${
                  transaction.direction === "in"
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-rose-100 text-rose-600"
                }`}
              >
                {transaction.direction === "in" ? (
                  <ArrowDownLeft className="w-5 h-5" />
                ) : (
                  <ArrowUpRight className="w-5 h-5" />
                )}
              </div>
              <div>
                <h4 className="font-medium text-foreground">
                  {transaction.description}
                </h4>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-muted-foreground">
                    {formatDate(transaction.date)}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                    {categoryLabels[transaction.category] || transaction.category}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  {transaction.property && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="w-3 h-3" />
                      {transaction.property.name}
                    </span>
                  )}
                  {transaction.tenant && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="w-3 h-3" />
                      {transaction.tenant.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <p
                className={`text-lg font-semibold ${
                  transaction.direction === "in"
                    ? "text-emerald-600"
                    : "text-rose-600"
                }`}
              >
                {transaction.direction === "in" ? "+" : "-"}
                {formatCurrency(transaction.amount)}
              </p>
              <button
                onClick={() => handleDelete(transaction.id)}
                disabled={deletingTransaction === transaction.id}
                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
              >
                {deletingTransaction === transaction.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
