import React, { useEffect, useState } from "react";
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonSpinner,
  IonText,
  IonButton,
  IonToast,
} from "@ionic/react";
import { supabase } from "../../supbaseclient.tsx";

interface PreviewQuoteProps {
  quoteId: string;
}

const PreviewQuote: React.FC<PreviewQuoteProps> = ({ quoteId }) => {
  const [loading, setLoading] = useState(true);
  interface Addon {
    name: string;
    flat_rate?: number;
    per_sqm_rate?: number;
  }

  interface MiscItem {
    name: string;
    quantity: number;
    unit_price: number;
    total: number;
  }

  interface Quote {
    company_name: string;
    contact_name: string;
    contact_email: string;
    contact_phone: string;
    client_address: string;
    signage_name: string;
    material_names: string;
    width: number;
    height: number;
    total_cost: number;
    addons?: Addon[];
    misc_items?: MiscItem[];
  }

  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Fetch quote data with retry mechanism
  useEffect(() => {
    let retries = 0;
    const fetchQuote = async () => {
      try {
        const { data, error } = await supabase
          .from("preview_quote")
          .select("*")
          .eq("quote_id", quoteId)
          .maybeSingle();

        if (error) throw error;
        if (!data && retries < 5) {
          retries++;
          setTimeout(fetchQuote, 1000);
          return;
        }
        if (!data) {
          setError("Quote not found");
          setLoading(false);
          return;
        }

        setQuote(data);
      } catch (err: unknown) {
        console.error("❌ Error fetching preview_quote:", err);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Failed to fetch quote");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchQuote();
  }, [quoteId]);

  // Print quote
  const handlePrint = () => {
    globalThis.print();
  };

  // Generate PDF using Supabase Edge Function
  const handleGeneratePDF = async () => {
    if (!quote) return;
    setPdfLoading(true);

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/generate_quote_pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ quoteId }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("❌ Error generating PDF:", err);
        setToastMessage("Failed to generate PDF. See console for details.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // Open PDF in new tab (works for Web & Android WebView)
      globalThis.open(url);
    } catch (err) {
      console.error("❌ Failed to generate PDF:", err);
      setToastMessage("Failed to generate PDF. See console for details.");
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>Generating Preview…</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <IonSpinner name="crescent" />
        </IonCardContent>
      </IonCard>
    );
  }

  if (error) {
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
  }

  if (!quote) {
    return (
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>No Preview Available</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <IonText>No data was found for this quote.</IonText>
        </IonCardContent>
      </IonCard>
    );
  }

  return (
    <>
      <IonCard>
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
            <strong>Signage:</strong> {quote.signage_name}
          </p>
          <p>
            <strong>Material(s):</strong> {quote.material_names}
          </p>
          <p>
            <strong>Dimensions:</strong> {quote.width}m × {quote.height}m
          </p>
          <p>
            <strong>Total Cost:</strong> R{quote.total_cost}
          </p>

          {quote.addons && quote.addons.length > 0 && (
            <>
              <h3>Add-ons:</h3>
              <ul>
                {quote.addons.map((a: Addon, idx: number) => (
                  <li key={idx}>
                    {a.name} – R{a.flat_rate ?? a.per_sqm_rate}
                  </li>
                ))}
              </ul>
            </>
          )}

          {(quote.misc_items ?? []).length > 0 && (
            <>
              <h3>Misc Items:</h3>
              <ul>
                {(quote.misc_items ?? []).map((m: MiscItem, idx: number) => (
                  <li key={idx}>
                    {m.name} (x{m.quantity}) – R{m.unit_price} each = R{m.total}
                  </li>
                ))}
              </ul>
            </>
          )}

          <IonButton expand="block" color="primary" onClick={handlePrint}>
            Print Quote
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
        color="danger"
      />
    </>
  );
};

export default PreviewQuote;
