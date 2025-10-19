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
  IonAlert,
} from "@ionic/react";
import { supabase } from "../../supbaseclient.tsx";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { FileOpener } from "@capacitor-community/file-opener";
import { Capacitor } from "@capacitor/core";

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
  const [showPermissionAlert, setShowPermissionAlert] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // ✅ Fetch quotes
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
      console.error("❌ Error fetching quotes:", err);
      setToastMessage("Failed to fetch quotes.");
    }
  };

  useEffect(() => {
    fetchQuotes();
  }, []);

  // ✅ Runtime storage permission check for Android
  const requestStoragePermission = async (): Promise<boolean> => {
    if (Capacitor.getPlatform() === "android") {
      try {
        const status = await Filesystem.checkPermissions();
        if (status.publicStorage === "granted") return true;

        const request = await Filesystem.requestPermissions();
        if (request.publicStorage === "granted") return true;

        setShowPermissionAlert(true);
        return false;
      } catch (err) {
        console.error("❌ Permission request failed:", err);
        setShowPermissionAlert(true);
        return false;
      }
    }
    return true;
  };

  // ✅ PDF generation + open with FileOpener
  const handleGeneratePDF = async (quoteId: string) => {
    setPdfLoading(true);
    try {
      const hasPermission = await requestStoragePermission();
      if (!hasPermission) return;

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
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );

      const fileName = `quote_${quoteId}_${Date.now()}.pdf`;

      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Documents,
        recursive: true,
      });

      console.log("📄 PDF saved at:", savedFile.uri);
      setToastMessage("✅ PDF saved successfully!");

      if (Capacitor.getPlatform() === "android" || Capacitor.getPlatform() === "ios") {
        await FileOpener.open({
          filePath: savedFile.uri,
          contentType: "application/pdf",
          openWithDefault: true,
        });
      } else {
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
      }
    } catch (err) {
      console.error("❌ PDF generation failed:", err);
      setToastMessage("PDF generation failed.");
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
          color="success"
        />

        <IonAlert
          isOpen={showPermissionAlert}
          onDidDismiss={() => setShowPermissionAlert(false)}
          header="Permission Required"
          message="Storage permission is required to save PDFs. Please enable it in Settings."
          buttons={["OK"]}
        />

        <IonInput
          placeholder="Search quotes..."
          value={searchTerm}
          onIonInput={(e: any) => setSearchTerm(e.detail.value)}
          className="ion-margin-bottom"
        />

        {filteredQuotes.length === 0 ? (
          <IonCard>
            <IonCardContent>
              <IonLabel>No quotes found.</IonLabel>
            </IonCardContent>
          </IonCard>
        ) : (
          filteredQuotes.map((q) => (
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
                  <IonCol size="auto">
                    <IonButton
                      onClick={() => handleGeneratePDF(q.quote_id)}
                      disabled={pdfLoading}
                      color="secondary"
                    >
                      {pdfLoading ? <IonSpinner name="dots" /> : "Download PDF"}
                    </IonButton>
                  </IonCol>
                </IonRow>
              </IonCardContent>
            </IonCard>
          ))
        )}
      </IonContent>
    </IonPage>
  );
};

export default QuoteHistory;
