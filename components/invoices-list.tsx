"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { FileText, Trash2, Loader2, Building2 } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

interface Invoice {
  id: string
  vendor?: string
  invoice_date?: string
  concept?: string
  gross_amount: number
  iva: number
  iva_rate: number
  retenciones: number
  retenciones_rate: number
  net_amount: number
  property?: { id: string; name: string }
  created_at: string
}

interface InvoicesListProps {
  invoices: Invoice[]
  workspaceId: string
}

export function InvoicesList({ invoices }: InvoicesListProps) {
  const [deletingInvoice, setDeletingInvoice] = useState<string | null>(null)
  const router = useRouter()

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminar esta factura?")) return
    setDeletingInvoice(id)
    const supabase = createClient()
    await supabase.from("invoices").delete().eq("id", id)
    setDeletingInvoice(null)
    router.refresh()
  }

  if (invoices.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No hay facturas
        </h3>
        <p className="text-muted-foreground">
          Sube tu primera factura para empezar
        </p>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-4 font-medium text-muted-foreground">Fecha</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Proveedor</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Concepto</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Inmueble</th>
              <th className="text-right p-4 font-medium text-muted-foreground">Base</th>
              <th className="text-right p-4 font-medium text-muted-foreground">IVA</th>
              <th className="text-right p-4 font-medium text-muted-foreground">Ret.</th>
              <th className="text-right p-4 font-medium text-muted-foreground">Total</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-muted/30 transition-colors">
                <td className="p-4 text-foreground">
                  {invoice.invoice_date ? formatDate(invoice.invoice_date) : "-"}
                </td>
                <td className="p-4 text-foreground font-medium">
                  {invoice.vendor || "Sin proveedor"}
                </td>
                <td className="p-4 text-muted-foreground max-w-xs truncate">
                  {invoice.concept || "-"}
                </td>
                <td className="p-4">
                  {invoice.property ? (
                    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                      <Building2 className="w-3 h-3" />
                      {invoice.property.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="p-4 text-right text-foreground">
                  {formatCurrency(invoice.gross_amount)}
                </td>
                <td className="p-4 text-right text-muted-foreground">
                  {formatCurrency(invoice.iva)}
                </td>
                <td className="p-4 text-right text-muted-foreground">
                  {invoice.retenciones > 0 ? `-${formatCurrency(invoice.retenciones)}` : "-"}
                </td>
                <td className="p-4 text-right font-semibold text-foreground">
                  {formatCurrency(invoice.net_amount)}
                </td>
                <td className="p-4">
                  <button
                    onClick={() => handleDelete(invoice.id)}
                    disabled={deletingInvoice === invoice.id}
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deletingInvoice === invoice.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
