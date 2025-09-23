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

    // Fetch quote details (height, width, salesperson included in RPC now)
    const { data, error } = await supabase.rpc("get_quote_details", { qid: quoteId });
    if (error || !data || data.length === 0) {
      console.error("DB error:", error);
      return new Response(JSON.stringify({ error: "Quote not found" }), { status: 404 });
    }
    const quote = data[0];

    // Fetch logo from Supabase storage
    const { data: logoData } = await supabase.storage.from("logo").download("icon.png");
    let logoImage;
    if (logoData) {
      const logoBytes = await logoData.arrayBuffer();
      logoImage = new Uint8Array(logoBytes);
    }

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const { width, height } = page.getSize();
    const margin = 40;
    let y = height - margin;

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    function drawText(
      text: string,
      size = 12,
      offsetX = margin,
      offsetY = y,
      bold = false,
      color = rgb(0, 0, 0)
    ) {
      page.drawText(text, {
        x: offsetX,
        y: offsetY,
        size,
        font: bold ? boldFont : font,
        color,
      });
      y -= size + 6;
    }

    function drawTable(headers: string[], rows: string[][]) {
      const colWidth = (width - 2 * margin) / headers.length;
      const rowHeight = 22;

      // Header row background
      page.drawRectangle({
        x: margin,
        y: y - 4,
        width: width - 2 * margin,
        height: rowHeight,
        color: rgb(0.9, 0.9, 0.9),
      });

      headers.forEach((h, i) => {
        page.drawText(h, {
          x: margin + i * colWidth + 4,
          y: y,
          size: 12,
          font: boldFont,
          color: rgb(0, 0, 0.2),
        });
      });
      y -= rowHeight;

      rows.forEach((row, ri) => {
        // Alternating row background
        if (ri % 2 === 0) {
          page.drawRectangle({
            x: margin,
            y: y - 4,
            width: width - 2 * margin,
            height: rowHeight,
            color: rgb(0.96, 0.96, 0.96),
          });
        }

        row.forEach((cell, i) => {
          page.drawText(cell, {
            x: margin + i * colWidth + 4,
            y: y,
            size: 11,
            font,
          });
        });
        y -= rowHeight;
      });
      y -= 12;
    }

    // Insert logo (top-right)
    if (logoImage) {
      const pngLogo = await pdfDoc.embedPng(logoImage);
      const logoDims = pngLogo.scale(0.15);
      page.drawImage(pngLogo, {
        x: width - logoDims.width - margin,
        y: height - logoDims.height - margin,
        width: logoDims.width,
        height: logoDims.height,
      });
    }

    // Title
    drawText("QUOTATION", 24, margin, y, true, rgb(0.2, 0.2, 0.6));
    y -= 20;

    // Client info block
    drawText(`Company: ${quote.company_name}`, 12, margin, y);
    drawText(`Contact: ${quote.contact_name}`, 12, margin, y);
    drawText(`Email: ${quote.contact_email}`, 12, margin, y);
    drawText(`Phone: ${quote.contact_phone}`, 12, margin, y);
    drawText(`Address: ${quote.client_address}`, 12, margin, y);
    y -= 15;

    // Signage info with dimensions
    drawTable(
      ["Signage", "Dimensions (WxH)", "Base Price (Excl. Materials)"],
      [[
        quote.signage_name ?? "N/A",
        `${quote.width ?? 0}m × ${quote.height ?? 0}m`,
        `R${quote.signage_cost ?? 0}`,
      ]]
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
    drawText(`Petrol Fee: R${quote.petrol_fee ?? 0}`, 12, margin, y, false, rgb(0.4, 0.4, 0.4));
    drawText(`TOTAL: R${quote.grand_total ?? 0}`, 16, margin, y, true, rgb(0.1, 0.5, 0.1));
    y -= 25;

    // Footer
    const now = new Date();
    drawText(`Generated by: ${quote.salesperson ?? "Unknown"}`, 10, margin, 60, false, rgb(0.4, 0.4, 0.4));
    drawText(`Generated on: ${now.toLocaleString()}`, 10, margin, 45, false, rgb(0.4, 0.4, 0.4));

    // Line above footer
    page.drawLine({
      start: { x: margin, y: 80 },
      end: { x: width - margin, y: 80 },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
    });

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
