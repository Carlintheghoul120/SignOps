import React, { useEffect, useState } from "react";
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonSpinner, IonText, IonButton } from "@ionic/react";
import { supabase } from "../../supbaseclient";

interface PreviewQuoteProps {
  quoteId: string;
}

const PreviewQuote: React.FC<PreviewQuoteProps> = ({ quoteId }) => {
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("🔍 Previewing quote with ID:", quoteId);

    let retries = 0;

    const fetchQuote = async () => {
      const { data, error } = await supabase
        .from("preview_quote")
        .select("*")
        .eq("quote_id", quoteId)
        .maybeSingle();

      if (error) {
        console.error("❌ Error fetching preview_quote:", error);
        setError(error.message);
        setLoading(false);
        return;
      }

      if (!data && retries < 5) {
        retries++;
        console.log(`⏳ No data yet, retrying in 1s (attempt ${retries})...`);
        setTimeout(fetchQuote, 1000);
        return;
      }

      console.log("✅ Preview quote data:", data);
      setQuote(data);
      setLoading(false);
    };

    fetchQuote();
  }, [quoteId]);

  const handlePrint = () => {
    window.print();
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
    <IonCard>
      <IonCardHeader>
        <IonCardTitle>Quote Preview</IonCardTitle>
      </IonCardHeader>
      <IonCardContent>
        <p><strong>Company:</strong> {quote.company_name}</p>
        <p><strong>Contact:</strong> {quote.contact_name} ({quote.contact_email}, {quote.contact_phone})</p>
        <p><strong>Address:</strong> {quote.client_address}</p>
        <p><strong>Signage:</strong> {quote.signage_name}</p>
        <p><strong>Material(s):</strong> {quote.material_names}</p>
        <p><strong>Dimensions:</strong> {quote.width}m × {quote.height}m</p>
        <p><strong>Total Cost:</strong> R{quote.total_cost}</p>

        {quote.addons && quote.addons.length > 0 && (
          <>
            <h3>Add-ons:</h3>
            <ul>
              {quote.addons.map((a: any, idx: number) => (
                <li key={idx}>{a.name} – R{a.flat_rate ?? a.per_sqm_rate}</li>
              ))}
            </ul>
          </>
        )}

        {quote.misc_items && quote.misc_items.length > 0 && (
          <>
            <h3>Misc Items:</h3>
            <ul>
              {quote.misc_items.map((m: any, idx: number) => (
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
      </IonCardContent>
    </IonCard>
  );
};

export default PreviewQuote;
