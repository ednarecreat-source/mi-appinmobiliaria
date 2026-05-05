import { NextRequest, NextResponse } from "next/server"
import { createOpenAI } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { z } from "zod"

const invoiceSchema = z.object({
  vendor: z.string().optional().describe("Nombre del proveedor o emisor de la factura"),
  invoice_date: z.string().optional().describe("Fecha de la factura en formato YYYY-MM-DD"),
  concept: z.string().optional().describe("Concepto o descripcion del servicio/producto"),
  gross_amount: z.number().optional().describe("Base imponible sin IVA"),
  iva: z.number().optional().describe("Importe del IVA"),
  iva_rate: z.number().optional().describe("Porcentaje de IVA aplicado"),
  retenciones: z.number().optional().describe("Importe de retenciones IRPF"),
  retenciones_rate: z.number().optional().describe("Porcentaje de retencion aplicado"),
  net_amount: z.number().optional().describe("Total a pagar"),
})

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json()

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }

    const openai = createOpenAI()

    const { object } = await generateObject({
      model: openai("gpt-4o"),
      schema: invoiceSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extrae los datos de esta factura espanola. Identifica el proveedor, fecha, concepto, base imponible, IVA, retenciones si las hay, y el total. Devuelve los importes como numeros decimales.",
            },
            {
              type: "image",
              image: image,
            },
          ],
        },
      ],
    })

    return NextResponse.json(object)
  } catch (error) {
    console.error("Error extracting invoice:", error)
    return NextResponse.json(
      { error: "Failed to extract invoice data" },
      { status: 500 }
    )
  }
}
