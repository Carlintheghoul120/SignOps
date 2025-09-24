import React, { useEffect, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonInput,
  IonButton,
  IonToast,
  IonSpinner,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonLabel,
  IonRow,
  IonCol,
  IonButtons,
  IonMenuButton,
} from "@ionic/react";
import { supabase } from "../../supbaseclient.tsx";

interface Quote {
  quote_id: string;
  user_id: string;
  user_name?: string;
  signage_id: string;
  total_cost?: string | undefined;
  signage_name?: string;
  created_at: string;
  [key: string]: string | undefined;
}

export const QuoteHistory: React.FC = () => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const fetchQuotes = async () => {
    try {
      const { data: quotesData, error: quotesError } = await supabase
        .from("quotes")
        .select("*")
        .order("created_at", { ascending: false });
      if (quotesError || !quotesData) throw quotesError;

      const { data: users } = await supabase.from("users").select("user_id, name");
      const { data: signage } = await supabase
        .from("signage_types")
        .select("signage_id, name");

      const mappedQuotes = quotesData.map((q) => ({
        ...q,
        user_name: users?.find((u) => u.user_id === q.user_id)?.name || q.user_id,
        signage_name:
          signage?.find((s) => s.signage_id === q.signage_id)?.name || q.signage_id,
      }));

      setQuotes(mappedQuotes);
    } catch (err) {
      console.error("Error fetching quotes:", err);
      setToastMessage("Error fetching quotes");
    }
  };


  useEffect(() => {
    fetchQuotes();
  }, []);


  const handleGeneratePDF = async (quoteId: string) => {
    setPdfLoading(true);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
	const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
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

  const filteredQuotes = quotes.filter((q) =>
    Object.values(q).some((val) =>
      val?.toString().toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <IonPage>
      <IonHeader>
			<IonToolbar color="primary">
					  <IonButtons slot="start">
						<IonMenuButton />
					  </IonButtons>
          <IonTitle>Quote History</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonToast
          isOpen={!!toastMessage}
          message={toastMessage}
          duration={3000}
          onDidDismiss={() => setToastMessage("")}
        />

        <IonInput
          placeholder="Search quotes..."
          value={searchTerm}
          onIonInput={(e: any) => setSearchTerm(e.detail.value)}
          className="ion-margin-bottom"
        />

        {filteredQuotes.map((q) => (
          <IonCard key={q.quote_id} className="ion-margin-bottom">
            <IonCardHeader>
              <IonCardTitle>Quote ID: {q.quote_id}</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonRow>
                <IonCol>
                  <IonLabel>
                    <strong>User:</strong> {q.user_name}
                  </IonLabel>
                </IonCol>
                <IonCol>
                  <IonLabel>
                    <strong>Signage:</strong> {q.signage_name}
                  </IonLabel>
                </IonCol>
				<IonCol>
                  <IonLabel>
                    <strong>Total Cost:</strong> {q.total_cost}
                  </IonLabel>
                </IonCol>
              </IonRow>
              <IonRow>
                <IonCol>
                  <IonLabel>
                    <strong>Created:</strong>{" "}
                    {new Date(q.created_at).toLocaleString()}
                  </IonLabel>
                </IonCol>
                <IonCol>
                  <IonButton
                    onClick={() => handleGeneratePDF(q.quote_id)}
                    disabled={pdfLoading}
                  >
                    {pdfLoading ? <IonSpinner name="dots" /> : "Generate PDF"}
                  </IonButton>
                </IonCol>
              </IonRow>
            </IonCardContent>
          </IonCard>
        ))}
      </IonContent>
    </IonPage>
  );
};

export default QuoteHistory;
