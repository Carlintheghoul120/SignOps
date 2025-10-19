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
import { supabase } from "../../supbaseclient.tsx";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";
import { FileOpener } from "@capacitor-community/file-opener";

interface PreviewQuoteProps {
  quoteId: string;
}

interface Addon {
  name: string;
  flat_rate?: number;
  per_sqm_rate?: number;
  is_flat?: boolean;
}

interface MiscItem {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Quote {
  quote_id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  client_address: string;
  signage_name?: string;
  width: number;
  height: number;
  area: number;
  signage_cost: number;
  material_cost: number;
  addon_cost: number;
  misc_cost: number;
  petrol_fee?: number;
  total_cost: number;
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

  // === Fetch quote from Supabase ===
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
        console.error("❌ Error fetching quote:", err);
        setError(err.message || "Failed to fetch quote");
      } finally {
        setLoading(false);
      }
    };
    fetchQuote();
  }, [quoteId]);

  // === Request storage permissions (Android only) ===
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
      } catch (err) {
        console.error("Permission error:", err);
        setShowPermissionAlert(true);
        return false;
      }
    }
    return true;
  };

  // === Open file using Capacitor FileOpener ===
  const openFile = async (uri: string, mimeType: string) => {
    try {
      if (Capacitor.getPlatform() === "web") {
        window.open(uri, "_blank");
        return;
      }

      await FileOpener.open({
        filePath: uri,
        contentType: mimeType,
        openWithDefault: true,
      });
    } catch (err) {
      console.error("❌ File open error:", err);
      setToastMessage("Failed to open file.");
    }
  };

  // === Take Screenshot ===
  const handleScreenshot = async () => {
    if (!quoteRef.current) return;
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const canvas = await html2canvas(quoteRef.current, { scale: 2 });
      const dataUrl = canvas.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1];
      const fileName = `quote_${quote?.quote_id}_screenshot.png`;

      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Documents,
        recursive: true,
      });

      setToastMessage("✅ Screenshot saved successfully!");
      console.log("📸 Screenshot saved at:", savedFile.uri);
      await openFile(savedFile.uri, "image/png");
    } catch (err) {
      console.error("❌ Screenshot error:", err);
      setToastMessage("Failed to save screenshot.");
    }
  };

  // === Generate PDF via Supabase Function ===
  const handleGeneratePDF = async () => {
    if (!quote) return;
    setPdfLoading(true);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate_quote_pdf`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ quoteId }),
        }
      );

      if (!res.ok) {
        const err = await res.text();
        console.error("❌ PDF generation error:", err);
        setToastMessage("Failed to generate PDF.");
        return;
      }

      const blob = await res.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );

      const fileName = `quote_${quote.quote_id}.pdf`;
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Documents,
        recursive: true,
      });

      console.log("📄 PDF saved at:", savedFile.uri);
      await openFile(savedFile.uri, "application/pdf");
      setToastMessage("✅ PDF generated & opened successfully!");
    } catch (err) {
      console.error("❌ PDF Generation Error:", err);
      setToastMessage("PDF generation failed.");
    } finally {
      setPdfLoading(false);
    }
  };

  // === UI Rendering ===
  if (loading)
    return (
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>Loading Quote…</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <IonSpinner name="crescent" />
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
    return (
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>No Quote Found</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <IonText>No data available for this quote.</IonText>
        </IonCardContent>
      </IonCard>
    );

  return (
    <>
      <IonCard ref={quoteRef}>
        <IonCardHeader>
          <IonCardTitle>Quote Preview</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <p>
            <strong>Company:</strong> {quote.company_name}
          </p>
          <p>
            <strong>Contact:</strong> {quote.contact_name} ({quote.contact_email},{" "}
            {quote.contact_phone})
          </p>
          <p>
            <strong>Address:</strong> {quote.client_address}
          </p>
          <p>
            <strong>Signage:</strong> {quote.signage_name ?? "-"}
          </p>
          <p>
            <strong>Dimensions:</strong> {quote.width}m × {quote.height}m
          </p>

          <h3>Breakdown:</h3>
          <ul>
            <li>Signage: R{quote.signage_cost}</li>
            <li>Add-ons: R{quote.addon_cost}</li>
            <li>Misc: R{quote.misc_cost}</li>
            <li>Petrol Fee: R{quote.petrol_fee ?? 0}</li>
          </ul>

          <p>
            <strong>Total Cost:</strong> R{quote.total_cost}
          </p>

          {quote.addons?.length > 0 && (
            <>
              <h3>Add-ons:</h3>
              <ul>
                {quote.addons.map((a, idx) => (
                  <li key={idx}>
                    {a.name} – {a.is_flat ? `R${a.flat_rate}` : `R${a.per_sqm_rate}/sqm`}
                  </li>
                ))}
              </ul>
            </>
          )}

          {quote.misc_items?.length > 0 && (
            <>
              <h3>Misc Items:</h3>
              <ul>
                {quote.misc_items.map((m, idx) => (
                  <li key={idx}>
                    {m.name} (x{m.quantity}) – R{m.unit_price} each = R{m.total}
                  </li>
                ))}
              </ul>
            </>
          )}

          <IonButton expand="block" color="primary" onClick={handleScreenshot}>
            Take Screenshot
          </IonButton>
          <IonButton
            expand="block"
            color="secondary"
            onClick={handleGeneratePDF}
            disabled={pdfLoading}
          >
            {pdfLoading ? "Generating PDF..." : "Download PDF"}
          </IonButton>
        </IonCardContent>
      </IonCard>

      <IonToast
        isOpen={!!toastMessage}
        message={toastMessage || ""}
        duration={3000}
        onDidDismiss={() => setToastMessage(null)}
        color="success"
      />

      <IonAlert
        isOpen={showPermissionAlert}
        onDidDismiss={() => setShowPermissionAlert(false)}
        header="Permission Required"
        message="Storage permission is required to save screenshots or PDFs. Please enable it in Settings."
        buttons={["OK"]}
      />
    </>
  );
};

export default PreviewQuote;
