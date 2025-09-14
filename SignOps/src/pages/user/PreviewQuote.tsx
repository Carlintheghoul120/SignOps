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
  quote_id: string;
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

const PreviewQuote: React.FC<PreviewQuoteProps> = ({ quoteId }) => {
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  useEffect(() => {
    let retries = 0;
    const fetchQuote = async () => {
      try {
        const { data, error } = await supabase
          .from("quotes")
          .select(`
            *,
            addons:quote_addons (
              name,
              flat_rate,
              per_sqm_rate
            ),
            misc_items:quote_misc_items (
              name,
              quantity,
              unit_price,
              total
            )
          `)
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
          return;
        }

        setQuote(data);
      } catch (err: unknown) {
        console.error("❌ Error fetching quote:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch quote");
      } finally {
        setLoading(false);
      }
    };

    fetchQuote();
  }, [quoteId]);

  const handlePrint = () => {
    globalThis.print();
  };

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
        setToastMessage("Failed to generate PDF. See console.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      globalThis.open(url);
    } catch (err) {
      console.error("❌ Failed to generate PDF:", err);
      setToastMessage("Failed to generate PDF. See console.");
    } finally {
      setPdfLoading(false);
    }
  };

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
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>Quote Preview</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <p><strong>Company:</strong> {quote.company_name}</p>
          <p><strong>Contact:</strong> {quote.contact_name} ({quote.contact_email}, {quote.contact_phone})</p>
          <p><strong>Address:</strong> {quote.client_address}</p>
          <p><strong>Signage:</strong> {quote.signage_name}</p>
          <p><strong>Dimensions:</strong> {quote.width}m × {quote.height}m</p>
          <p><strong>Total Cost:</strong> R{quote.total_cost}</p>

          {quote.addons && quote.addons.length > 0 && (
            <>
              <h3>Add-ons:</h3>
              <ul>
                {quote.addons.map((a, idx) => (
                  <li key={idx}>{a.name} – R{a.flat_rate ?? a.per_sqm_rate}</li>
                ))}
              </ul>
            </>
          )}

          {Array.isArray(quote.misc_items) && quote.misc_items.length > 0 && (
            <>
              <h3>Misc Items:</h3>
              <ul>
                {quote.misc_items.map((m, idx) => (
                  <li key={idx}>{m.name} (x{m.quantity}) – R{m.unit_price} each = R{m.total}</li>
                ))}
              </ul>
            </>
          )}

          <IonButton expand="block" color="primary" onClick={handlePrint}>Print Quote</IonButton>
          <IonButton expand="block" color="secondary" onClick={handleGeneratePDF} disabled={pdfLoading}>
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
