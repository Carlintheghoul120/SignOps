import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.0/+esm";
import { PDFDocument, rgb, StandardFonts } from "https://cdn.skypack.dev/pdf-lib";

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  try {
    const { quoteId } = await req.json();
    if (!quoteId) return new Response(JSON.stringify({ error: "Missing quoteId" }), { status: 400, headers: corsHeaders() });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch base quote and signage name
    const { data: quoteData, error: qErr } = await supabase
      .from("quotes")
      .select(`quote_id, company_name, contact_name, contact_email, contact_phone, client_address, signage_id, signage_cost, material_cost, addon_cost, misc_cost, petrol_fee, total_cost, width, height, area, created_at, user_id`)
      .eq("quote_id", quoteId)
      .single();

    if (qErr || !quoteData) {
      console.error("quote fetch error", qErr);
      return new Response(JSON.stringify({ error: "Quote not found" }), { status: 404, headers: corsHeaders() });
    }

    // signage type name
    let signageName = "N/A";
    if (quoteData.signage_id) {
      const { data: st } = await supabase.from("signage_types").select("name").eq("signage_id", quoteData.signage_id).single();
      signageName = st?.name ?? "N/A";
    }

    // Fetch quote_materials with joined material info
    const { data: qMaterials } = await supabase
      .from("quote_materials")
      .select(`quote_id, material_id, quantity, unit_price, total, materials(material_id, name, unit_type, price_per_unit, price)`)
      .eq("quote_id", quoteId);

    // Fetch quote_addons with addon details
    const { data: qAddons } = await supabase
      .from("quote_addons")
      .select(`addon_id, addons(addon_id, name, is_flat, flat_rate, per_sqm_rate)`)
      .eq("quote_id", quoteId);

    // Fetch misc items
    const { data: qMisc } = await supabase
      .from("quote_misc_items")
      .select(`id, name, quantity, unit_price, total`)
      .eq("quote_id", quoteId);

    // Compute area (fallback to width * height)
    const width = safeNumber(quoteData.width, 0);
    const height = safeNumber(quoteData.height, 0);
    const area = quoteData.area ?? (width * height);

    // Compute signageCost:
    // Prefer stored quote.signage_cost (if non-zero). If zero or null, derive from quote_materials where materials.unit_type 'sqm' scaled by area
    let signageCost = safeNumber(quoteData.signage_cost, 0);
    if (!signageCost || signageCost === 0) {
      signageCost = (qMaterials ?? []).reduce((s: number, m: any) => {
        const unitType = m.materials?.unit_type ?? null;
        // If material supplies signage cost by scaling with area, approximate by unit_price * quantity * area when unit_type is 'sqm'
        if (unitType === "sqm") {
          const unitPrice = safeNumber(m.unit_price ?? m.materials?.price_per_unit ?? m.materials?.price, 0);
          const qtyBase = safeNumber(m.quantity ?? 0, 0);
          // If the quantity stored already included area multiplication, then total already includes it; check total presence
          if (m.total && m.total > 0) {
            // If quantity is already large (>1) and appears scaled, skip extra multiplication.
            return s + safeNumber(m.total, 0);
          } else {
            // fallback: quantity * unitPrice
            return s + (qtyBase * unitPrice);
          }
        }
        return s;
      }, 0);
    }

    // Material cost: sum of quote_materials totals (fallback to 0)
    const materialCost = (qMaterials ?? []).reduce((s: number, m: any) => s + safeNumber(m.total, 0), 0);

    // Addon cost: sum of each addon row (flat or per sqm)
    const addonCost = (qAddons ?? []).reduce((s: number, row: any) => {
      const a = row.addons ?? row; // depending on select shape
      if (!a) return s;
      if (a.is_flat) return s + safeNumber(a.flat_rate, 0);
      return s + safeNumber(a.per_sqm_rate, 0) * area;
    }, 0);

    // Misc cost: sum of misc totals
    const miscCost = (qMisc ?? []).reduce((s: number, m: any) => s + safeNumber(m.total, 0), 0);

    // Petrol fee: prefer stored quoteData.petrol_fee else compute from google_distance_km column in quotes (if present) fallback
    let petrolFee = safeNumber(quoteData.petrol_fee, 0);
    if ((!petrolFee || petrolFee === 0) && (quoteData.google_distance_km !== undefined)) {
      petrolFee = Math.max(0, safeNumber(quoteData.google_distance_km, 0) - 5) * 6.5;
    }

    // Grand total (recompute from parts)
    const totalCost = roundTwo(signageCost + addonCost + miscCost + petrolFee);

    // Fetch logo if exists
    let logoImage;
    try {
      const logoResp = await supabase.storage.from("logo").download("icon.png");
      if (!logoResp.error && logoResp.data) {
        const bytes = await logoResp.data.arrayBuffer();
        logoImage = new Uint8Array(bytes);
      }
    } catch (e) {
      console.warn("no logo", e);
    }

    // Build PDF (keeps your original design)
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 900]);
    const { width: pw, height: ph } = page.getSize();
    const margin = 40;
    let y = ph - margin;

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const drawText = (text: string, size = 12, offsetX = margin, offsetY = y, bold = false, color = rgb(0, 0, 0)) => {
      page.drawText(text, { x: offsetX, y: offsetY, size, font: bold ? boldFont : font, color });
      y -= size + 6;
    };

    const drawTable = (headers: string[], rows: string[][]) => {
      const colWidth = (pw - 2 * margin) / headers.length;
      const rowHeight = 22;
      page.drawRectangle({ x: margin, y: y - 4, width: pw - 2 * margin, height: rowHeight, color: rgb(0.9, 0.9, 0.9) });
      headers.forEach((h, i) => page.drawText(h, { x: margin + i * colWidth + 4, y: y, size: 12, font: boldFont, color: rgb(0, 0, 0.2) }));
      y -= rowHeight;
      rows.forEach((row, ri) => {
        if (ri % 2 === 0) page.drawRectangle({ x: margin, y: y - 4, width: pw - 2 * margin, height: rowHeight, color: rgb(0.96, 0.96, 0.96) });
        row.forEach((cell, i) => page.drawText(cell, { x: margin + i * colWidth + 4, y: y, size: 11, font }));
        y -= rowHeight;
      });
      y -= 12;
    };

    // Logo
    if (logoImage) {
      try {
        const pngLogo = await pdfDoc.embedPng(logoImage);
        const logoDims = pngLogo.scale(0.15);
        page.drawImage(pngLogo, { x: pw - logoDims.width - margin, y: ph - logoDims.height - margin, width: logoDims.width, height: logoDims.height });
      } catch (e) {
        console.warn("bad logo", e);
      }
    }

    drawText("QUOTATION", 24, margin, y, true, rgb(0.2, 0.2, 0.6));
    y -= 20;
    drawText(`Company: ${quoteData.company_name}`);
    drawText(`Contact: ${quoteData.contact_name} (${quoteData.contact_email}, ${quoteData.contact_phone})`);
    drawText(`Address: ${quoteData.client_address}`);
    y -= 12;
    drawText(`Signage: ${signageName}`);
    drawText(`Dimensions: ${width}m × ${height}m`);
    y -= 12;

    // Signage table
    drawTable(["Signage", "Dimensions (WxH)", "Base Price"], [[signageName, `${width}m × ${height}m`, `R${signageCost.toFixed(2)}`]]);

    // Add-ons
    if ((qAddons ?? []).length) {
      const addonRows = (qAddons ?? []).map((r: any) => {
        const a = r.addons ?? r;
        const cost = a.is_flat ? safeNumber(a.flat_rate, 0) : safeNumber(a.per_sqm_rate, 0) * area;
        return [a.name, a.is_flat ? "Flat" : "Per sqm", `R${cost.toFixed(2)}`];
      });
      drawTable(["Add-on", "Type", "Cost"], addonRows);
    }

    // Misc
    if ((qMisc ?? []).length) {
      const miscRows = (qMisc ?? []).map((m: any) => [
        m.name,
        `x${m.quantity}`,
        `R${safeNumber(m.total, 0).toFixed(2)}`,
      ]);
      drawTable(["Misc Item", "Qty", "Cost"], miscRows);
    }

    // Summary
    drawText(`Signage Cost: R${signageCost.toFixed(2)}`);
    drawText(`Add-on Cost: R${addonCost.toFixed(2)}`);
    drawText(`Misc Items Cost: R${miscCost.toFixed(2)}`);
    drawText(`Petrol Fee: R${petrolFee.toFixed(2)}`, 12, margin, y, false, rgb(0.4, 0.4, 0.4));
    drawText(`TOTAL: R${totalCost.toFixed(2)}`, 16, margin, y, true, rgb(0.1, 0.5, 0.1));
    y -= 25;

    // Footer with SAST time
    const nowStr = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" });
    drawText(`Generated on: ${nowStr}`, 10, margin, 60, false, rgb(0.4, 0.4, 0.4));
    page.drawLine({ start: { x: margin, y: 80 }, end: { x: pw - margin, y: 80 }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });

    const pdfBytes = await pdfDoc.save();
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=quote-${quoteId}.pdf`,
      },
    });

  } catch (err) {
    console.error("Server error:", err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), { status: 500, headers: corsHeaders() });
  }
});

// helpers
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

function safeNumber(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function roundTwo(v: number) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
