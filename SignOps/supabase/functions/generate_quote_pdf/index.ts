import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.0/+esm";
import { PDFDocument, rgb, StandardFonts } from "https://cdn.skypack.dev/pdf-lib";

serve(async (req) => {
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

    // Use raw SQL to pull full quote details with addons & misc items
    const { data, error } = await supabase.rpc("get_quote_details", { qid: quoteId });

    if (error || !data || data.length === 0) {
      console.error("DB error:", error);
      return new Response(JSON.stringify({ error: "Quote not found" }), { status: 404 });
    }

    const quote = data[0];

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

      headers.forEach((h, i) => {
        page.drawText(h, { x: margin + i * colWidth + 2, y, size: 12, font: boldFont });
      });
      y -= rowHeight;

      rows.forEach((row) => {
        row.forEach((cell, i) => {
          page.drawText(cell, { x: margin + i * colWidth + 2, y, size: 12, font });
        });
        y -= rowHeight;
      });
      y -= 10;
    }

    // Header
    drawText("Quotation", 20, margin, y, true);
    y -= 20;

    // Client info
    drawText(`Company: ${quote.company_name}`);
    drawText(`Contact: ${quote.contact_name}`);
    drawText(`Email: ${quote.contact_email}`);
    drawText(`Phone: ${quote.contact_phone}`);
    drawText(`Address: ${quote.client_address}`);
    y -= 10;

    // Signage
    drawTable(
      ["Signage", "Base price per sqm (Excl. Materials)"],
      [[quote.signage_name ?? "N/A", `R${quote.signage_cost ?? 0}`]]
    );

    // Add-ons
    if (quote.addons?.length) {
      const addonRows = quote.addons.map((a: any) => [
        a.name,
        a.is_flat ? "Flat" : "Per sqm",
        `R${a.flat_rate ?? a.per_sqm_rate ?? 0}`,
      ]);
      drawTable(["Add-on", "Type", "Cost"], addonRows);
    }

    // Misc items
    if (quote.misc_items?.length) {
      const miscRows = quote.misc_items.map((m: any) => [
        m.name,
        `x${m.quantity}`,
        `R${m.total}`,
      ]);
      drawTable(["Misc Item", "Qty", "Cost"], miscRows);
    }

    // Totals
    drawText(`Petrol Fee: R${quote.petrol_fee ?? 0}`);
    drawText(`TOTAL: R${quote.grand_total ?? 0}`, 16, margin, y, true);

    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=quote-${quoteId}.pdf`,
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("Server error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
});
