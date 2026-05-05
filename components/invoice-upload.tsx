"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Upload, X, Loader2, FileText, Sparkles } from "lucide-react"

interface Property {
  id: string
  name: string
}

interface InvoiceUploadProps {
  workspaceId: string
  properties: Property[]
}

interface ExtractedData {
  vendor?: string
  invoice_date?: string
  concept?: string
  gross_amount?: number
  iva?: number
  iva_rate?: number
  retenciones?: number
  retenciones_rate?: number
  net_amount?: number
}

export function InvoiceUpload({ workspaceId, properties }: InvoiceUploadProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [propertyId, setPropertyId] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Form state
  const [vendor, setVendor] = useState("")
  const [invoiceDate, setInvoiceDate] = useState("")
  const [concept, setConcept] = useState("")
  const [grossAmount, setGrossAmount] = useState("")
  const [iva, setIva] = useState("")
  const [ivaRate, setIvaRate] = useState("21")
  const [retenciones, setRetenciones] = useState("")
  const [retencionesRate, setRetencionesRate] = useState("0")
  const [netAmount, setNetAmount] = useState("")

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Convert to base64 for preview
    const reader = new FileReader()
    reader.onload = async (event) => {
      const base64 = event.target?.result as string
      setImagePreview(base64)
      
      // Extract data using AI
      setExtracting(true)
      try {
        const response = await fetch("/api/extract-invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64 }),
        })
        
        if (response.ok) {
          const data = await response.json()
          setExtractedData(data)
          
          // Auto-fill form
          if (data.vendor) setVendor(data.vendor)
          if (data.invoice_date) setInvoiceDate(data.invoice_date)
          if (data.concept) setConcept(data.concept)
          if (data.gross_amount) setGrossAmount(data.gross_amount.toString())
          if (data.iva) setIva(data.iva.toString())
          if (data.iva_rate) setIvaRate(data.iva_rate.toString())
          if (data.retenciones) setRetenciones(data.retenciones.toString())
          if (data.retenciones_rate) setRetencionesRate(data.retenciones_rate.toString())
          if (data.net_amount) setNetAmount(data.net_amount.toString())
        }
      } catch (error) {
        console.error("Error extracting invoice data:", error)
      }
      setExtracting(false)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    
    await supabase.from("invoices").insert({
      workspace_id: workspaceId,
      vendor,
      invoice_date: invoiceDate || null,
      concept,
      gross_amount: parseFloat(grossAmount) || 0,
      iva: parseFloat(iva) || 0,
      iva_rate: parseFloat(ivaRate) || 21,
      retenciones: parseFloat(retenciones) || 0,
      retenciones_rate: parseFloat(retencionesRate) || 0,
      net_amount: parseFloat(netAmount) || 0,
      property_id: propertyId || null,
      image_base64: imagePreview,
    })

    setLoading(false)
    handleClose()
    router.refresh()
  }

  const handleClose = () => {
    setOpen(false)
    setImagePreview(null)
    setExtractedData(null)
    setVendor("")
    setInvoiceDate("")
    setConcept("")
    setGrossAmount("")
    setIva("")
    setIvaRate("21")
    setRetenciones("")
    setRetencionesRate("0")
    setNetAmount("")
    setPropertyId("")
  }

  // Calculate net amount automatically
  const calculateNet = () => {
    const gross = parseFloat(grossAmount) || 0
    const ivaAmount = parseFloat(iva) || 0
    const ret = parseFloat(retenciones) || 0
    return (gross + ivaAmount - ret).toFixed(2)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
      >
        <Upload className="w-5 h-5" />
        Subir Factura
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card">
              <h2 className="text-xl font-semibold text-foreground">
                Nueva Factura
              </h2>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Imagen de la factura (opcional)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {!imagePreview ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-8 border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Upload className="w-8 h-8" />
                      <span>Sube una imagen para extraer datos con IA</span>
                    </div>
                  </button>
                ) : (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Factura"
                      className="w-full max-h-48 object-contain rounded-lg border border-border"
                    />
                    {extracting && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                        <div className="flex items-center gap-2 text-white">
                          <Sparkles className="w-5 h-5 animate-pulse" />
                          <span>Extrayendo datos...</span>
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setImagePreview(null)}
                      className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Proveedor
                  </label>
                  <input
                    type="text"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Nombre del proveedor"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Concepto
                </label>
                <input
                  type="text"
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Descripcion del gasto"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Inmueble asociado
                </label>
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Sin asignar</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Base Imponible
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={grossAmount}
                    onChange={(e) => setGrossAmount(e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    IVA ({ivaRate}%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={iva}
                    onChange={(e) => setIva(e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Retenciones ({retencionesRate}%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={retenciones}
                    onChange={(e) => setRetenciones(e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">Total Neto</span>
                  <span className="text-2xl font-bold text-primary">
                    {calculateNet()} EUR
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Guardar Factura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
