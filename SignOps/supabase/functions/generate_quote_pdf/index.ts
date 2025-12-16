// edge-function/generate_quote_pdf.ts
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.0/+esm";
import { PDFDocument, rgb, StandardFonts } from "https://cdn.skypack.dev/pdf-lib";

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { quoteId } = body;
    if (!quoteId) return new Response(JSON.stringify({ error: "Missing quoteId" }), { status: 400, headers: corsHeaders() });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Server not configured" }), { status: 500, headers: corsHeaders() });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch quote
    const { data: quoteData, error: qErr } = await supabase
      .from("quotes")
      .select(`
        quote_id, company_name, contact_name, contact_email, contact_phone, client_address,
        signage_id, signage_cost, material_cost, addon_cost, misc_cost, petrol_fee,
        total_cost, width, height, area, google_distance_km, created_at, user_id
      `)
      .eq("quote_id", quoteId)
      .single();

    if (qErr || !quoteData) {
      console.error("quote fetch error", qErr);
      return new Response(JSON.stringify({ error: "Quote not found" }), { status: 404, headers: corsHeaders() });
    }

    // Signage name
    let signageName = "N/A";
    if (quoteData.signage_id) {
      const { data: st, error: stErr } = await supabase
        .from("signage_types")
        .select("name")
        .eq("signage_id", quoteData.signage_id)
        .single();
      signageName = !st || stErr ? "N/A" : st.name ?? "N/A";
    }

    // Quote materials
    const { data: qMaterials = [] } = await supabase
      .from("quote_materials")
      .select(`quote_id, material_id, quantity, unit_price, total, materials(material_id, name, unit_type, price_per_unit, price)`)
      .eq("quote_id", quoteId);

    // Quote addons
    const { data: qAddons = [] } = await supabase
      .from("quote_addons")
      .select(`quote_id, addon_id, override_flat_rate, override_per_sqm_rate, addons(addon_id, name, is_flat, flat_rate, per_sqm_rate)`)
      .eq("quote_id", quoteId);

    // Misc items
    const { data: qMisc = [] } = await supabase
      .from("quote_misc_items")
      .select(`id, name, quantity, unit_price, total`)
      .eq("quote_id", quoteId);

    // Safe numeric helpers
    const width = safeNumber(quoteData.width, 0);
    const height = safeNumber(quoteData.height, 0);
    const area = safeNumber(quoteData.area, width && height ? width * height : 0);

    // Materials & signage cost
    const materials = Array.isArray(qMaterials) ? qMaterials : [];
    let signageCost = safeNumber(quoteData.signage_cost, materials.reduce((sum, m) => sum + safeNumber(m.total, safeNumber(m.quantity) * safeNumber(m.unit_price)), 0));
    const materialCost = safeNumber(quoteData.material_cost, materials.reduce((sum, m) => sum + safeNumber(m.total, safeNumber(m.quantity) * safeNumber(m.unit_price)), 0));

    // Addon cost
    const addons = Array.isArray(qAddons) ? qAddons : [];
    let addonCost = 0;
    for (const row of addons) {
      const a = row.addons ?? {};
      const isFlat = a.is_flat === true;
      const flatRate = row.override_flat_rate ?? a.flat_rate ?? 0;
      const perSqmRate = row.override_per_sqm_rate ?? a.per_sqm_rate ?? 0;
      addonCost += isFlat ? flatRate : perSqmRate * area;
    }

    // Misc cost
    const miscItems = Array.isArray(qMisc) ? qMisc : [];
    const miscCost = miscItems.reduce((sum, m) => sum + safeNumber(m.total, safeNumber(m.quantity) * safeNumber(m.unit_price)), 0);

    // Petrol fee
    let petrolFee = safeNumber(quoteData.petrol_fee, 0);
    if (!petrolFee && quoteData.google_distance_km) {
      petrolFee = Math.max(0, quoteData.google_distance_km - 5) * 6.5;
    }

    // Total
    const recomputed = roundTwo(signageCost + materialCost + addonCost + miscCost + petrolFee);
    const totalCost = safeNumber(quoteData.total_cost, recomputed);

    // Logo fetch (optional)
    let logoImage: ArrayBuffer | null = null;
    try {
      const logoResp = await supabase.storage.from("logo").download("icon.png");
      if (!logoResp.error && logoResp.data) logoImage = await logoResp.data.arrayBuffer();
    } catch { /* ignore */ }

    // Build PDF
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([600, 900]);
    let y = page.getHeight() - 40;
    const margin = 40;
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const drawText = (text: string, size = 12, offsetX = margin, bold = false, color = rgb(0, 0, 0)) => {
      page.drawText(text, { x: offsetX, y, size, font: bold ? boldFont : font, color });
      y -= size + 6;
    };

    const drawTable = (headers: string[], rows: string[][]) => {
      const colWidth = (page.getWidth() - 2 * margin) / headers.length;
      const rowHeight = 22;

      const checkPageOverflow = () => {
        if (y - rowHeight < 60) {
          page = pdfDoc.addPage([600, 900]);
          y = page.getHeight() - 40;
        }
      };

      page.drawRectangle({ x: margin, y: y - 4, width: page.getWidth() - 2 * margin, height: rowHeight, color: rgb(0.9, 0.9, 0.9) });
      headers.forEach((h, i) => page.drawText(h, { x: margin + i * colWidth + 4, y, size: 12, font: boldFont, color: rgb(0, 0, 0.2) }));
      y -= rowHeight;

      for (let ri = 0; ri < rows.length; ri++) {
        checkPageOverflow();
        const row = rows[ri];
        if (ri % 2 === 0) page.drawRectangle({ x: margin, y: y - 4, width: page.getWidth() - 2 * margin, height: rowHeight, color: rgb(0.96, 0.96, 0.96) });
        row.forEach((cell, i) => page.drawText(cell, { x: margin + i * colWidth + 4, y, size: 11, font }));
        y -= rowHeight;
      }
      y -= 12;
    };

    // Logo
    if (logoImage) {
      try {
        const pngLogo = await pdfDoc.embedPng(logoImage);
        const logoDims = pngLogo.scale(0.15);
        page.drawImage(pngLogo, { x: page.getWidth() - logoDims.width - margin, y: page.getHeight() - logoDims.height - margin, width: logoDims.width, height: logoDims.height });
      } catch { /* ignore */ }
    }

    drawText("QUOTATION", 24, margin, true, rgb(0.15, 0.15, 0.45));
    y -= 20;
    drawText(`Company: ${quoteData.company_name}`);
    drawText(`Contact: ${quoteData.contact_name} (${quoteData.contact_email ?? "-"}, ${quoteData.contact_phone ?? "-"})`);
    drawText(`Address: ${quoteData.client_address ?? "-"}`);
    y -= 8;
    drawText(`Signage: ${signageName}`);
    drawText(`Dimensions: ${width}m × ${height}m`);
    y -= 12;

    drawTable(["Signage", "Dimensions", "Signage Cost"], [[signageName, `${width}m × ${height}m`, `R${signageCost.toFixed(2)}`]]);

    if (materials.length) {
      const matRows = materials.map(m => {
        const mat = m.materials ?? {};
        const qty = safeNumber(m.quantity, 0);
        const total = safeNumber(m.total, qty * safeNumber(m.unit_price, 0));
        return [mat.name ?? `#${m.material_id}`, `${qty}`, `R${total.toFixed(2)}`];
      });
      drawTable(["Material", "Qty", "Cost"], matRows);
    }

    if (addons.length) {
      const addonRows = addons.map(r => {
        const a = r.addons ?? {};
        const isFlat = a.is_flat === true;
        const flatRate = r.override_flat_rate ?? a.flat_rate ?? 0;
        const perSqmRate = r.override_per_sqm_rate ?? a.per_sqm_rate ?? 0;
        const cost = isFlat ? flatRate : perSqmRate * area;
        return [a.name ?? `#${r.addon_id}`, isFlat ? "Flat" : "Per sqm", `R${cost.toFixed(2)}`];
      });
      drawTable(["Add-on", "Type", "Cost"], addonRows);
    }

    if (miscItems.length) {
      const miscRows = miscItems.map(m => [m.name, `x${safeNumber(m.quantity, 0)}`, `R${safeNumber(m.total, safeNumber(m.quantity) * safeNumber(m.unit_price)).toFixed(2)}`]);
      drawTable(["Misc Item", "Qty", "Cost"], miscRows);
    }

    drawText(`Signage Cost: R${signageCost.toFixed(2)}`);
    drawText(`Material Cost: R${materialCost.toFixed(2)}`);
    drawText(`Add-on Cost: R${addonCost.toFixed(2)}`);
    drawText(`Misc Items Cost: R${miscCost.toFixed(2)}`);
    drawText(`Petrol Fee: R${petrolFee.toFixed(2)}`, 12, margin, false, rgb(0.4, 0.4, 0.4));
    drawText(`TOTAL: R${totalCost.toFixed(2)}`, 16, margin, true, rgb(0.07, 0.45, 0.12));
    y -= 25;

    const nowStr = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" });
    drawText(`Generated on: ${nowStr}`, 10, margin, false, rgb(0.4, 0.4, 0.4));
    page.drawLine({ start: { x: margin, y: 80 }, end: { x: page.getWidth() - margin, y: 80 }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });

    const pdfBytes = await pdfDoc.save();
    return new Response(pdfBytes, { status: 200, headers: { ...corsHeaders(), "Content-Type": "application/pdf", "Content-Disposition": `inline; filename=quote-${quoteId}.pdf` } });

  } catch (err) {
    console.error("Server error:", err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), { status: 500, headers: corsHeaders() });
  }
});

// helpers
function corsHeaders() {
  return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "*" };
}

function safeNumber(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function roundTwo(v: number) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
