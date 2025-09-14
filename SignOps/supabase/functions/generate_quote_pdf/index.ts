// supabase/functions/generate_quote_pdf/index.ts
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.0/+esm";
import { PDFDocument, rgb, StandardFonts } from "https://cdn.skypack.dev/pdf-lib";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const { quoteId } = await req.json();
    if (!quoteId) return new Response("Missing quoteId", { status: 400 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: quote, error } = await supabase
      .from("preview_quote")
      .select("*")
      .eq("quote_id", quoteId)
      .maybeSingle();

    if (error || !quote)
      return new Response(JSON.stringify({ error: "Quote not found" }), { status: 404 });

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const { width, height } = page.getSize();
    const margin = 40;
    let y = height - margin;

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    function drawText(text: string, size = 12, offsetX = margin, offsetY = y, bold = false) {
      page.drawText(text, {
        x: offsetX,
        y: offsetY,
        size,
        font: bold ? boldFont : font,
        color: rgb(0, 0, 0),
      });
      y -= size + 5;
    }

    function drawTable(headers: string[], rows: string[][]) {
      const colWidth = (width - 2 * margin) / headers.length;
      const rowHeight = 20;

      // Header
      headers.forEach((h, i) => {
        page.drawText(h, { x: margin + i * colWidth + 2, y, size: 12, font: boldFont, color: rgb(0,0,0) });
      });
      y -= rowHeight;

      // Rows
      rows.forEach((row) => {
        row.forEach((cell, i) => {
          page.drawText(cell, { x: margin + i * colWidth + 2, y, size: 12, font, color: rgb(0,0,0) });
        });
        y -= rowHeight;
      });
      y -= 10;
    }

    // Header
    drawText("Quotation / Invoice", 20, margin, y, true);
    y -= 20;

    // Client info
    drawText(`Company: ${quote.company_name}`);
    drawText(`Contact: ${quote.contact_name}`);
    drawText(`Email: ${quote.contact_email}`);
    drawText(`Phone: ${quote.contact_phone}`);
    drawText(`Address: ${quote.client_address}`);
    y -= 10;

    // Line items
    drawTable(
      ["Signage", "Materials", "Cost"],
      [[quote.signage_name, quote.material_names, `R${quote.signage_cost + quote.material_cost}`]]
    );

    // Add-ons
    if (quote.addons && quote.addons.length > 0) {
      const addonRows = quote.addons.map((a: any) => [
        a.name, "", `R${a.flat_rate ?? a.per_sqm_rate}`
      ]);
      drawTable(["Add-ons", "", "Cost"], addonRows);
    }

    // Misc items
    if (quote.misc_items && quote.misc_items.length > 0) {
      const miscRows = quote.misc_items.map((m: any) => [
        m.name, `x${m.quantity}`, `R${m.total}`
      ]);
      drawTable(["Misc Item", "Qty", "Cost"], miscRows);
    }

    // Total
    drawText(`TOTAL: R${quote.grand_total}`, 16, margin, y, true);

    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=quote-${quoteId}.pdf`,
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
});
