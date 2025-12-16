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
  IonBadge,
  IonItem,
  IonList,
} from "@ionic/react";
import { supabase } from "../../supbaseclient.tsx";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { FileOpener } from "@capacitor-community/file-opener";
import { Capacitor } from "@capacitor/core";
import { useHistory } from "react-router-dom";

interface QuoteSignageSummary {
  signage_name: string;
  count: number;
}

interface Quote {
  quote_id: string;
  user_id: string;
  user_name?: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  total_cost: number;
  created_at: string;
  signages: QuoteSignageSummary[];
  signage_count: number;
  material_count: number;
  addon_count: number;
  misc_count: number;
}

export const QuoteHistory: React.FC = () => {
  const history = useHistory();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [showPermissionAlert, setShowPermissionAlert] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Fetch quotes with related data
  const fetchQuotes = async () => {
    try {
      setLoading(true);

      // Fetch base quotes
      const { data: quotesData, error: quotesError } = await supabase
        .from("quotes")
        .select("*")
        .order("created_at", { ascending: false });

      if (quotesError || !quotesData) throw quotesError;

      // Fetch users
      const { data: users } = await supabase.from("users").select("user_id, name");

      // Fetch all quote signages
      const { data: allSignages } = await supabase
        .from("quote_signages")
        .select(`
          quote_id,
          signage_types(name)
        `);

      // Fetch counts for materials, addons, misc items
      const quoteIds = quotesData.map(q => q.quote_id);

      const [materialsData, addonsData, miscData] = await Promise.all([
        supabase.from("quote_materials").select("quote_id").in("quote_id", quoteIds),
        supabase.from("quote_addons").select("quote_id").in("quote_id", quoteIds),
        supabase.from("quote_misc_items").select("quote_id").in("quote_id", quoteIds),
      ]);

      // Build material/addon/misc counts per quote
      const materialCounts: Record<string, number> = {};
      const addonCounts: Record<string, number> = {};
      const miscCounts: Record<string, number> = {};

      materialsData.data?.forEach(m => {
        materialCounts[m.quote_id] = (materialCounts[m.quote_id] || 0) + 1;
      });

      addonsData.data?.forEach(a => {
        addonCounts[a.quote_id] = (addonCounts[a.quote_id] || 0) + 1;
      });

      miscData.data?.forEach(m => {
        miscCounts[m.quote_id] = (miscCounts[m.quote_id] || 0) + 1;
      });

      // Build signage summary per quote
      const signagesByQuote: Record<string, QuoteSignageSummary[]> = {};

      allSignages?.forEach((s: any) => {
        const quoteId = s.quote_id;
        const signageName = s.signage_types?.name || "Unknown";

        if (!signagesByQuote[quoteId]) {
          signagesByQuote[quoteId] = [];
        }

        const existing = signagesByQuote[quoteId].find(x => x.signage_name === signageName);
        if (existing) {
          existing.count++;
        } else {
          signagesByQuote[quoteId].push({ signage_name: signageName, count: 1 });
        }
      });

      // Map quotes with all data
      const mappedQuotes: Quote[] = quotesData.map((q) => ({
        quote_id: q.quote_id,
        user_id: q.user_id,
        user_name: users?.find((u) => u.user_id === q.user_id)?.name || "Unknown",
        company_name: q.company_name || "N/A",
        contact_name: q.contact_name || "N/A",
        contact_email: q.contact_email || "N/A",
        total_cost: q.total_cost || 0,
        created_at: q.created_at,
        signages: signagesByQuote[q.quote_id] || [],
        signage_count: signagesByQuote[q.quote_id]?.reduce((sum, s) => sum + s.count, 0) || 0,
        material_count: materialCounts[q.quote_id] || 0,
        addon_count: addonCounts[q.quote_id] || 0,
        misc_count: miscCounts[q.quote_id] || 0,
      }));

      setQuotes(mappedQuotes);
    } catch (err) {
      console.error("❌ Error fetching quotes:", err);
      setToastMessage("Failed to fetch quotes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotes();
  }, []);

  // Runtime storage permission check for Android
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

  // PDF generation + open with FileOpener
  const handleGeneratePDF = async (quoteId: string) => {
    setPdfLoading(quoteId);
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
      setPdfLoading(null);
    }
  };

  // Delete quote
  const handleDelete = async (quoteId: string) => {
    if (!confirm("Are you sure you want to delete this quote?")) return;

    try {
      // Delete related records first (cascade should handle this, but being explicit)
      await Promise.all([
        supabase.from("quote_signages").delete().eq("quote_id", quoteId),
        supabase.from("quote_materials").delete().eq("quote_id", quoteId),
        supabase.from("quote_addons").delete().eq("quote_id", quoteId),
        supabase.from("quote_misc_items").delete().eq("quote_id", quoteId),
      ]);

      // Delete the quote
      const { error } = await supabase.from("quotes").delete().eq("quote_id", quoteId);

      if (error) throw error;

      setToastMessage("Quote deleted successfully.");
      fetchQuotes(); // Refresh list
    } catch (err) {
      console.error("❌ Error deleting quote:", err);
      setToastMessage("Failed to delete quote.");
    }
  };

  // Filter quotes
  const filteredQuotes = quotes.filter((q) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      q.company_name.toLowerCase().includes(searchLower) ||
      q.contact_name.toLowerCase().includes(searchLower) ||
      q.contact_email.toLowerCase().includes(searchLower) ||
      q.quote_id.toLowerCase().includes(searchLower) ||
      q.signages.some(s => s.signage_name.toLowerCase().includes(searchLower))
    );
  });

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

        <IonAlert
          isOpen={showPermissionAlert}
          onDidDismiss={() => setShowPermissionAlert(false)}
          header="Permission Required"
          message="Storage permission is required to save PDFs. Please enable it in Settings."
          buttons={["OK"]}
        />

        <IonInput
          placeholder="Search by company, contact, email, or signage..."
          value={searchTerm}
          onIonChange={(e: any) => setSearchTerm(e.detail.value)}
          className="ion-margin-bottom"
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "8px 12px",
            marginBottom: 16
          }}
        />

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
            <IonSpinner name="crescent" />
          </div>
        ) : filteredQuotes.length === 0 ? (
          <IonCard>
            <IonCardContent>
              <IonLabel>No quotes found.</IonLabel>
            </IonCardContent>
          </IonCard>
        ) : (
          filteredQuotes.map((q) => (
            <IonCard key={q.quote_id} className="ion-margin-bottom">
              <IonCardHeader>
                <IonCardTitle style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Quote #{q.quote_id.slice(0, 8)}</span>
                  <IonBadge color="success">R{q.total_cost.toFixed(2)}</IonBadge>
                </IonCardTitle>
              </IonCardHeader>

              <IonCardContent>
                {/* Customer Info */}
                <div style={{ marginBottom: 12 }}>
                  <div><strong>Company:</strong> {q.company_name}</div>
                  <div style={{ marginTop: 4 }}><strong>Contact:</strong> {q.contact_name}</div>
                  <div style={{ marginTop: 4, fontSize: 14, color: "#666" }}>{q.contact_email}</div>
                </div>

                {/* Signages Summary */}
                {q.signages.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <strong>Signages ({q.signage_count}):</strong>
                    <div style={{ marginTop: 4, marginLeft: 8 }}>
                      {q.signages.map((sig, idx) => (
                        <div key={idx} style={{ fontSize: 14, color: "#555" }}>
                          • {sig.signage_name} {sig.count > 1 ? `(×${sig.count})` : ""}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Item Counts */}
                <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                  {q.material_count > 0 && (
                    <IonBadge color="medium">{q.material_count} Materials</IonBadge>
                  )}
                  {q.addon_count > 0 && (
                    <IonBadge color="medium">{q.addon_count} Add-ons</IonBadge>
                  )}
                  {q.misc_count > 0 && (
                    <IonBadge color="medium">{q.misc_count} Misc Items</IonBadge>
                  )}
                </div>

                {/* Meta Info */}
                <div style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>
                  <div><strong>Created by:</strong> {q.user_name}</div>
                  <div><strong>Date:</strong> {new Date(q.created_at).toLocaleString()}</div>
                </div>

                {/* Actions */}
                <IonRow style={{ marginTop: 12 }}>
                  <IonCol>
                    <IonButton
                      expand="block"
                      fill="outline"
                      size="small"
                      onClick={() => history.push(`/quote-edit/${q.quote_id}`)}
                    >
                      Edit
                    </IonButton>
                  </IonCol>
                  <IonCol>
                    <IonButton
                      expand="block"
                      fill="outline"
                      size="small"
                      color="secondary"
                      onClick={() => handleGeneratePDF(q.quote_id)}
                      disabled={pdfLoading === q.quote_id}
                    >
                      {pdfLoading === q.quote_id ? <IonSpinner name="dots" /> : "PDF"}
                    </IonButton>
                  </IonCol>
                  <IonCol>
                    <IonButton
                      expand="block"
                      fill="outline"
                      size="small"
                      color="danger"
                      onClick={() => handleDelete(q.quote_id)}
                    >
                      Delete
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