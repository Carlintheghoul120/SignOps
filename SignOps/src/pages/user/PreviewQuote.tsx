import React, { useEffect, useState, useRef } from "react";
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonSpinner, IonText, IonButton, IonToast, IonAlert
} from "@ionic/react";
import html2canvas from "html2canvas";
import { supabase } from "../../supbaseclient";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";
import { FileOpener } from "@capacitor-community/file-opener";

const n = (v?: number | null) => Number.isFinite(v as number) ? (v as number) : 0;
const money = (v?: number | null) => n(v).toFixed(2);

interface PreviewQuoteProps { quoteId: string; }

interface Addon { addon_id: number; name: string; flat_rate?: number | null; per_sqm_rate?: number | null; is_flat?: boolean | null; selected?: boolean; }
interface MiscItem { name: string; quantity?: number | null; unit_price?: number | null; }
interface Signage { signage_id: number; name: string; width_m: number; height_m: number; }
interface Material { material_id: number; name: string; price_per_unit?: number | null; quantity?: number; calculation_method?: string; unit_type?: string; scale_with_area?: boolean; }

interface Quote {
  quote_id: string;
  company_name?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  client_address?: string;
  distance_km?: number;
  petrol_fee?: number;
  signages: Signage[];
  materials: Material[];
  addons: Addon[];
  misc_items: MiscItem[];
}

const PreviewQuote: React.FC<PreviewQuoteProps> = ({ quoteId }) => {
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showPermissionAlert, setShowPermissionAlert] = useState(false);
  const quoteRef = useRef<HTMLIonCardElement>(null);

  // ----------------------
  // Fetch Quote & related data
  // ----------------------
  const fetchQuoteData = async () => {
    try {
      setLoading(true);
      const { data: qData, error: qErr } = await supabase
        .from("quotes")
        .select("*")
        .eq("quote_id", quoteId)
        .single();
      if (qErr || !qData) throw qErr ?? new Error("Quote not found");

      const [{ data: signagesData }, { data: materialsData }, { data: addonsData }, { data: miscData }] = await Promise.all([
        supabase.from("quote_signages").select("*").eq("quote_id", quoteId),
        supabase.from("quote_materials").select("*,materials(*)").eq("quote_id", quoteId),
        supabase.from("quote_addons").select("*,addons(*)").eq("quote_id", quoteId),
        supabase.from("quote_misc_items").select("*").eq("quote_id", quoteId),
      ]);

      const signages: Signage[] = (signagesData || []).map(s => ({
        signage_id: s.signage_id,
        name: s.signage_name || `Signage ${s.signage_id}`,
        width_m: n(s.width_m),
        height_m: n(s.height_m),
      }));

      const materials: Material[] = (materialsData || []).map(m => ({
        material_id: m.material_id,
        name: m.materials?.name || "Material",
        price_per_unit: n(m.unit_price ?? m.materials?.price),
        quantity: n(m.quantity),
        calculation_method: m.calculation_method ?? m.materials?.calculation_method,
        unit_type: m.unit_type ?? m.materials?.unit_type,
        scale_with_area: m.scale_with_area ?? true,
      }));

      const addons: Addon[] = (addonsData || []).map(a => ({
        addon_id: a.addon_id,
        name: a.addons?.name ?? "Addon",
        flat_rate: n(a.override_flat_rate ?? a.addons?.flat_rate),
        per_sqm_rate: n(a.override_per_sqm_rate ?? a.addons?.per_sqm_rate),
        is_flat: a.addons?.is_flat,
        selected: true,
      }));

      const misc_items: MiscItem[] = miscData || [];

      setQuote({ ...qData, signages, materials, addons, misc_items });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load quote");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQuoteData(); }, [quoteId]);

  // ----------------------
  // Compute Totals
  // ----------------------
  const computeTotals = () => {
    if (!quote) return { signageCost: 0, materialCost: 0, addonCost: 0, miscCost: 0, petrolFee: 0, total: 0 };

    const firstSignage = quote.signages[0];
    const width = firstSignage?.width_m ?? 1;
    const height = firstSignage?.height_m ?? 1;
    const area = width * height;
    const perimeter = 2 * (width + height);

    let signageCost = 0, materialCost = 0, addonCost = 0, miscCost = 0;

    // Materials
    quote.materials.forEach(m => {
      const unitPrice = n(m.price_per_unit);
      const baseQty = n(m.quantity);
      let qtyMultiplier = 1;
      const method = (m.calculation_method || "").toLowerCase();
      const utype = (m.unit_type || "").toLowerCase();
      if (method === "perimeter" || utype === "meter") qtyMultiplier = perimeter;
      else if (method === "area" || utype === "sqm") qtyMultiplier = area;
      else qtyMultiplier = m.scale_with_area ? area : 1;

      const quantityUsed = baseQty * qtyMultiplier;
      if (m.scale_with_area) signageCost += unitPrice * quantityUsed;
      else materialCost += unitPrice * quantityUsed;
    });

    // Addons
    quote.addons.forEach(a => {
      if (!a.selected) return;
      if (!a.is_flat && n(a.per_sqm_rate) > 0) addonCost += n(a.per_sqm_rate) * area;
      else addonCost += n(a.flat_rate);
    });

    // Misc
    miscCost = quote.misc_items.reduce((s, mi) => s + n(mi.quantity) * n(mi.unit_price), 0);

    const total = signageCost + materialCost + addonCost + miscCost + n(quote.petrol_fee);

    return { signageCost, materialCost, addonCost, miscCost, petrolFee: n(quote.petrol_fee), total };
  };

  const totals = computeTotals();

  // ----------------------
  // Permissions & File Handling
  // ----------------------
  const requestPermissions = async (): Promise<boolean> => {
    if (Capacitor.getPlatform() === "android") {
      try {
        const perm = await Filesystem.checkPermissions();
        if (perm.publicStorage === "granted") return true;
        const req = await Filesystem.requestPermissions();
        if (req.publicStorage !== "granted") {
          setShowPermissionAlert(true);
          return false;
        }
        return true;
      } catch {
        setShowPermissionAlert(true);
        return false;
      }
    }
    return true;
  };

  const openFile = async (uri: string, mimeType: string) => {
    try {
      if (Capacitor.getPlatform() === "web") {
        window.open(uri, "_blank");
        return;
      }
      await FileOpener.open({ filePath: uri, contentType: mimeType, openWithDefault: true });
    } catch {
      setToastMessage("Failed to open file.");
    }
  };

  const handleScreenshot = async () => {
    if (!quoteRef.current) return;
    if (!(await requestPermissions())) return;

    try {
      const canvas = await html2canvas(quoteRef.current, { scale: 2 });
      const base64 = canvas.toDataURL("image/png").split(",")[1];

      const fileName = `quote_${quote?.quote_id}_screenshot.png`;
      const saved = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Documents,
        recursive: true,
      });

      setToastMessage("Screenshot saved!");
      await openFile(saved.uri, "image/png");
    } catch {
      setToastMessage("Failed to save screenshot.");
    }
  };

  const handleGeneratePDF = async () => {
    if (!quote) return;
    setPdfLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate_quote_pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ quoteId }),
      });

      if (!res.ok) throw new Error("PDF generation failed");

      const buffer = await res.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

      const fileName = `quote_${quote.quote_id}.pdf`;
      const saved = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Documents,
        recursive: true,
      });

      await openFile(saved.uri, "application/pdf");
      setToastMessage("PDF generated!");
    } catch {
      setToastMessage("PDF generation failed.");
    } finally {
      setPdfLoading(false);
    }
  };

  // ----------------------
  // Render
  // ----------------------
  if (loading) return <IonCard><IonCardHeader><IonCardTitle>Loading Quote…</IonCardTitle></IonCardHeader><IonCardContent><IonSpinner /></IonCardContent></IonCard>;
  if (error) return <IonCard><IonCardHeader><IonCardTitle>Error</IonCardTitle></IonCardHeader><IonCardContent><IonText color="danger">{error}</IonText></IonCardContent></IonCard>;
  if (!quote) return <IonCard><IonCardContent>No quote found.</IonCardContent></IonCard>;

  return (
    <>
      <IonCard ref={quoteRef}>
        <IonCardHeader><IonCardTitle>Quote Preview</IonCardTitle></IonCardHeader>
        <IonCardContent>
          <p><strong>Company:</strong> {quote.company_name ?? "-"}</p>
          <p><strong>Contact:</strong> {quote.contact_name ?? "-"} ({quote.contact_email ?? "-"}, {quote.contact_phone ?? "-"})</p>
          <p><strong>Address:</strong> {quote.client_address ?? "-"}</p>

          <p><strong>Signage:</strong> {quote.signages.map(s => s.name).join(", ") || "-"}</p>
          <p><strong>Dimensions:</strong> {quote.signages.map(s => `${n(s.width_m)*1000}mm × ${n(s.height_m)*1000}mm`).join(" | ") || "-"}</p>

          <h3>Breakdown</h3>
          <ul>
            <li>Signage: R{money(totals.signageCost)}</li>
            <li>Add-ons: R{money(totals.addonCost)}</li>
            <li>Misc: R{money(totals.miscCost)}</li>
            <li>Petrol Fee: R{money(totals.petrolFee)}</li>
          </ul>
          <p><strong>Total:</strong> R{money(totals.total)}</p>

          {quote.addons?.length ? (
            <>
              <h3>Add-ons</h3>
              <ul>
                {quote.addons.map((a, i) => (
                  <li key={i}>
                    {a.name} – {a.is_flat ? `R${money(a.flat_rate)}` : `R${money(a.per_sqm_rate)}/sqm`}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {quote.misc_items?.length ? (
            <>
              <h3>Misc Items</h3>
              <ul>
                {quote.misc_items.map((m, i) => (
                  <li key={i}>
                    {m.name} × {n(m.quantity)} @ R{money(m.unit_price)} = R{money(n(m.quantity) * n(m.unit_price))}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <IonButton expand="block" onClick={handleScreenshot}>Take Screenshot</IonButton>
          <IonButton expand="block" color="secondary" onClick={handleGeneratePDF} disabled={pdfLoading}>
            {pdfLoading ? "Generating PDF..." : "Download PDF"}
          </IonButton>
        </IonCardContent>
      </IonCard>

      <IonToast isOpen={!!toastMessage} message={toastMessage ?? ""} duration={3000} onDidDismiss={() => setToastMessage(null)} color="success" />
      <IonAlert isOpen={showPermissionAlert} onDidDismiss={() => setShowPermissionAlert(false)} header="Permission Required" message="Storage permission is required to save screenshots or PDFs." buttons={["OK"]} />
    </>
  );
};

export default PreviewQuote;
