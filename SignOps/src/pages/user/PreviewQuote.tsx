import React, { useEffect, useState } from "react";
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonText, IonSpinner
} from "@ionic/react";
import { supabase } from "../../supbaseclient";

interface PreviewQuoteProps {
  quoteId: string;
}

const PreviewQuote: React.FC<PreviewQuoteProps> = ({ quoteId }) => {
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuote = async () => {
      const { data, error } = await supabase
        .from("quote_costs")
        .select("*")
        .eq("quote_id", quoteId)
        .single();

      if (error) {
        console.error("Error fetching preview:", error);
      } else {
        setQuote(data);
      }
      setLoading(false);
    };

    fetchQuote();
  }, [quoteId]);

  if (loading) {
    return <IonSpinner />;
  }

  if (!quote) {
    return <IonText color="danger">Failed to load quote preview</IonText>;
  }

  return (
    <IonCard>
      <IonCardHeader>
        <IonCardTitle>Quote Preview</IonCardTitle>
      </IonCardHeader>
      <IonCardContent>
        <IonText>
          <p><strong>Company:</strong> {quote.company_name}</p>
          <p><strong>Contact:</strong> {quote.contact_name} ({quote.contact_email}, {quote.contact_phone})</p>
          <p><strong>Address:</strong> {quote.client_address}</p>
          <p><strong>Signage:</strong> {quote.signage_name}</p>
          <p><strong>Material:</strong> {quote.material_name}</p>
          <p><strong>Area:</strong> {quote.area.toFixed(2)} m²</p>
          <p><strong>Base Cost:</strong> R{quote.base_cost.toFixed(2)}</p>
          <p><strong>Material Cost:</strong> R{quote.material_cost.toFixed(2)}</p>
          <p><strong>Add-ons:</strong> R{quote.addon_cost.toFixed(2)}</p>
          <p><strong>Misc Items:</strong> R{quote.misc_cost.toFixed(2)}</p>
          <p><strong>Petrol Fee:</strong> R{quote.petrol_fee?.toFixed(2) || 0}</p>
          <p><strong>Total:</strong> R{quote.total_cost.toFixed(2)}</p>
        </IonText>
      </IonCardContent>
    </IonCard>
  );
};

export default PreviewQuote;
