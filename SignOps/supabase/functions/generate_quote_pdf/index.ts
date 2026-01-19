import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.0/+esm";
import { PDFDocument, rgb, StandardFonts } from "https://cdn.skypack.dev/pdf-lib";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { quoteId } = body;

    if (!quoteId) {
      return new Response(JSON.stringify({ error: "Missing quoteId" }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1️⃣ Main quote
    const { data: quoteData } = await supabase
      .from("quotes")
      .select(`
        quote_id,
        company_name,
        contact_name,
        contact_email,
        contact_phone,
        client_address,
        petrol_fee,
        google_distance_km
      `)
      .eq("quote_id", quoteId)
      .single();

    if (!quoteData) {
      return new Response(JSON.stringify({ error: "Quote not found" }), {
        status: 404,
        headers: corsHeaders(),
      });
    }

    // 2️⃣ Quote signages (CORRECT JOIN)
    const { data: quoteSignagesData, error: signageErr } = await supabase
      .from("quote_signages")
      .select(`
        signage_id,
        width_m,
        height_m,
        signage_cost,
        signage_types (
          name
        )
      `)
      .eq("quote_id", quoteId)
      .order("id", { ascending: true });

    if (signageErr) {
      console.error("Signage fetch error:", signageErr);
    }

    const quoteSignages = (quoteSignagesData ?? []).map((s) => ({
      name: s.signage_types?.name ?? `Signage ${s.signage_id}`,
      width: safeNumber(s.width_m),
      height: safeNumber(s.height_m),
      cost: safeNumber(s.signage_cost),
    }));

    const signageCost = quoteSignages.reduce((sum, s) => sum + s.cost, 0);
    const totalArea = quoteSignages.reduce(
      (sum, s) => sum + s.width * s.height,
      0
    );

    // 3️⃣ Materials
    const { data: qMaterialsData } = await supabase
      .from("quote_materials")
      .select("quantity, unit_price, total, materials(name)")
      .eq("quote_id", quoteId);

    const materialCost = (qMaterialsData ?? []).reduce(
      (sum, m) =>
        sum +
        safeNumber(
          m.total,
          safeNumber(m.quantity) * safeNumber(m.unit_price)
        ),
      0
    );

    // 4️⃣ Add-ons
    const { data: qAddonsData } = await supabase
      .from("quote_addons")
      .select(`
        override_flat_rate,
        override_per_sqm_rate,
        addons(name, is_flat, flat_rate, per_sqm_rate)
      `)
      .eq("quote_id", quoteId);

    const addonCost = (qAddonsData ?? []).reduce((sum, a) => {
      const isFlat = a.addons?.is_flat ?? true;
      const cost = isFlat
        ? safeNumber(a.override_flat_rate ?? a.addons?.flat_rate)
        : safeNumber(a.override_per_sqm_rate ?? a.addons?.per_sqm_rate) *
          totalArea;
      return sum + cost;
    }, 0);

    // 5️⃣ Misc items
    const { data: qMiscData } = await supabase
      .from("quote_misc_items")
      .select("name, quantity, unit_price, total")
      .eq("quote_id", quoteId);

    const miscCost = (qMiscData ?? []).reduce(
      (sum, m) =>
        sum +
        safeNumber(
          m.total,
          safeNumber(m.quantity) * safeNumber(m.unit_price)
        ),
      0
    );

    // 6️⃣ Petrol
    let petrolFee = safeNumber(quoteData.petrol_fee);
    if (!petrolFee && quoteData.google_distance_km) {
      petrolFee = Math.max(0, quoteData.google_distance_km - 5) * 6.5;
    }

    const totalCost = roundTwo(
      signageCost + materialCost + addonCost + miscCost + petrolFee
    );

    // 7️⃣ Logo
    let logoImage: ArrayBuffer | null = null;
    try {
      const logo = await supabase.storage.from("logo").download("icon.png");
      if (!logo.error && logo.data) {
        logoImage = await logo.data.arrayBuffer();
      }
    } catch {}

    // 8️⃣ PDF setup
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([600, 900]);
    let y = page.getHeight() - 40;
    const margin = 40;

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const drawText = (text: string, size = 12, bold = false) => {
      page.drawText(text, {
        x: margin,
        y,
        size,
        font: bold ? boldFont : font,
      });
      y -= size + 6;
    };

    const drawTable = (headers: string[], rows: string[][]) => {
      const colWidth = (page.getWidth() - margin * 2) / headers.length;
      const rowHeight = 22;

      headers.forEach((h, i) =>
        page.drawText(h, {
          x: margin + i * colWidth + 4,
          y,
          size: 12,
          font: boldFont,
        })
      );
      y -= rowHeight;

      rows.forEach((row, idx) => {
        if (y < 80) {
          page = pdfDoc.addPage([600, 900]);
          y = page.getHeight() - 40;
        }
        if (idx % 2 === 0) {
          page.drawRectangle({
            x: margin,
            y: y - 4,
            width: page.getWidth() - margin * 2,
            height: rowHeight,
            color: rgb(0.96, 0.96, 0.96),
          });
        }
        row.forEach((cell, i) =>
          page.drawText(cell, {
            x: margin + i * colWidth + 4,
            y,
            size: 11,
            font,
          })
        );
        y -= rowHeight;
      });

      y -= 12;
    };

    // Logo
    if (logoImage) {
      try {
        const img = await pdfDoc.embedPng(logoImage);
        const dims = img.scale(0.15);
        page.drawImage(img, {
          x: page.getWidth() - dims.width - margin,
          y: page.getHeight() - dims.height - margin,
          width: dims.width,
          height: dims.height,
        });
      } catch {}
    }

    // Header
    drawText("QUOTATION", 24, true);
    y -= 12;
    drawText(`Company: ${quoteData.company_name ?? "-"}`);
    drawText(
      `Contact: ${quoteData.contact_name ?? "-"} (${quoteData.contact_email ?? "-"}, ${quoteData.contact_phone ?? "-"})`
    );
    drawText(`Address: ${quoteData.client_address ?? "-"}`);
    y -= 10;

    // Signages table
    drawTable(
      ["Signage", "Dimensions", "Cost"],
      quoteSignages.map((s) => [
        s.name,
        `${s.width}m × ${s.height}m`,
        `R${s.cost.toFixed(2)}`,
      ])
    );

    if (qMaterialsData?.length) {
      drawTable(
        ["Material", "Qty", "Cost"],
        qMaterialsData.map((m) => [
          m.materials?.name ?? "N/A",
          String(safeNumber(m.quantity)),
          `R${safeNumber(
            m.total,
            safeNumber(m.quantity) * safeNumber(m.unit_price)
          ).toFixed(2)}`,
        ])
      );
    }

    if (qAddonsData?.length) {
      drawTable(
        ["Add-on", "Type", "Cost"],
        qAddonsData.map((a) => {
          const isFlat = a.addons?.is_flat ?? true;
          const cost = isFlat
            ? safeNumber(a.override_flat_rate ?? a.addons?.flat_rate)
            : safeNumber(a.override_per_sqm_rate ?? a.addons?.per_sqm_rate) *
              totalArea;
          return [
            a.addons?.name ?? "N/A",
            isFlat ? "Flat" : "Per sqm",
            `R${cost.toFixed(2)}`,
          ];
        })
      );
    }

    if (qMiscData?.length) {
      drawTable(
        ["Item", "Qty", "Cost"],
        qMiscData.map((m) => [
          m.name ?? "N/A",
          `x${safeNumber(m.quantity)}`,
          `R${safeNumber(
            m.total,
            safeNumber(m.quantity) * safeNumber(m.unit_price)
          ).toFixed(2)}`,
        ])
      );
    }

    drawText(`Signage: R${signageCost.toFixed(2)}`);
    drawText(`Materials: R${materialCost.toFixed(2)}`);
    drawText(`Add-ons: R${addonCost.toFixed(2)}`);
    drawText(`Misc: R${miscCost.toFixed(2)}`);
    drawText(`Petrol: R${petrolFee.toFixed(2)}`);
    drawText(`TOTAL: R${totalCost.toFixed(2)}`, 16, true);

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
    console.error("PDF error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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
