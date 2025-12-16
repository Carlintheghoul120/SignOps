import React, { useEffect, useState, useRef } from "react";
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonSpinner,
  IonText,
  IonButton,
  IonToast,
  IonAlert,
} from "@ionic/react";
import html2canvas from "html2canvas";
import { supabase } from "../../supbaseclient";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";
import { FileOpener } from "@capacitor-community/file-opener";

/* ===========================
   Helpers
=========================== */
const n = (v?: number | null) => Number.isFinite(v as number) ? (v as number) : 0;
const money = (v?: number | null) => n(v).toFixed(2);

/* ===========================
   Types
=========================== */
interface PreviewQuoteProps { quoteId: string; }

interface Addon {
  name: string;
  flat_rate?: number | null;
  per_sqm_rate?: number | null;
  is_flat?: boolean | null;
}

interface MiscItem {
  name: string;
  quantity?: number | null;
  unit_price?: number | null;
}

interface Quote {
  quote_id: string;
  company_name?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  client_address?: string | null;

  signage_name?: string | null;
  width?: number | null; // in meters
  height?: number | null;

  signage_cost?: number | null;
  material_cost?: number | null;
  addon_cost?: number | null;
  misc_cost?: number | null;
  petrol_fee?: number | null;
  total_cost?: number | null;

  addons?: Addon[] | null;
  misc_items?: MiscItem[] | null;
}

const PreviewQuote: React.FC<PreviewQuoteProps> = ({ quoteId }) => {
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showPermissionAlert, setShowPermissionAlert] = useState(false);
  const quoteRef = useRef<HTMLIonCardElement>(null);

  const computeTotal = (q: Quote) =>
    n(q.signage_cost) + n(q.material_cost) + n(q.addon_cost) + n(q.misc_cost) + n(q.petrol_fee);

  /* ===========================
     Fetch Quote
  =========================== */
  useEffect(() => {
    const fetchQuote = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("preview_quote")
          .select("*")
          .eq("quote_id", quoteId)
          .single();

        if (error || !data) throw error ?? new Error("Quote not found");
        setQuote(data as Quote);
      } catch (err: any) {
        console.error("Error fetching quote:", err);
        setError(err.message || "Failed to fetch quote");
      } finally {
        setLoading(false);
      }
    };
    fetchQuote();
  }, [quoteId]);

  /* ===========================
     Permissions
  =========================== */
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

  /* ===========================
     Screenshot
  =========================== */
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

  /* ===========================
     PDF
  =========================== */
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

  /* ===========================
     UI
  =========================== */
  if (loading)
    return (
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>Loading Quote…</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <IonSpinner />
        </IonCardContent>
      </IonCard>
    );

  if (error)
    return (
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>Error</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <IonText color="danger">{error}</IonText>
        </IonCardContent>
      </IonCard>
    );

  if (!quote)
    return <IonCard><IonCardContent>No quote found.</IonCardContent></IonCard>;

  return (
    <>
      <IonCard ref={quoteRef}>
        <IonCardHeader>
          <IonCardTitle>Quote Preview</IonCardTitle>
        </IonCardHeader>

        <IonCardContent>
          <p><strong>Company:</strong> {quote.company_name ?? "-"}</p>
          <p>
            <strong>Contact:</strong>{" "}
            {quote.contact_name ?? "-"} ({quote.contact_email ?? "-"}, {quote.contact_phone ?? "-"})
          </p>
          <p><strong>Address:</strong> {quote.client_address ?? "-"}</p>

          <p><strong>Signage:</strong> {quote.signage_name ?? "-"}</p>
          <p><strong>Dimensions:</strong> {n(quote.width)*1000}mm × {n(quote.height)*1000}mm</p>

          <h3>Breakdown</h3>
          <ul>
            <li>Signage: R{money(quote.signage_cost)}</li>
            <li>Add-ons: R{money(quote.addon_cost)}</li>
            <li>Misc: R{money(quote.misc_cost)}</li>
            <li>Petrol Fee: R{money(quote.petrol_fee)}</li>
          </ul>

          <p><strong>Total:</strong> R{money(quote.total_cost ?? computeTotal(quote))}</p>

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

      <IonToast
        isOpen={!!toastMessage}
        message={toastMessage ?? ""}
        duration={3000}
        onDidDismiss={() => setToastMessage(null)}
        color="success"
      />

      <IonAlert
        isOpen={showPermissionAlert}
        onDidDismiss={() => setShowPermissionAlert(false)}
        header="Permission Required"
        message="Storage permission is required to save screenshots or PDFs."
        buttons={["OK"]}
      />
    </>
  );
};

export default PreviewQuote;
