import React, { useEffect, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonToast,
  IonSpinner,
  IonLabel,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonIcon,
  IonText,
} from "@ionic/react";
import { useParams, useHistory } from "react-router-dom";
import { supabase } from "../../supbaseclient";
import { closeCircle, addCircle } from "ionicons/icons";

interface Quote {
  quote_id: string;
  user_id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  client_address: string;
  google_distance_km?: number | null;
  notes?: string | null;
  signage_cost: number;
  material_cost: number;
  addon_cost: number;
  misc_cost: number;
  petrol_fee: number;
  total_cost: number;
}

interface QuoteSignage {
  quote_signage_id?: number;
  signage_id: number;
  width_m: number;
  height_m: number;
}

interface QuoteMaterial {
  quote_material_id?: number;
  material_id: number;
  quantity: number;
  unit_price: number;
  total: number;
}

interface QuoteAddon {
  quote_addon_id?: number;
  addon_id: number;
  override_flat_rate?: number | null;
  override_per_sqm_rate?: number | null;
}

interface QuoteMiscItem {
  quote_misc_item_id?: number;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

const safeFloat = (v: any, fallback = 0) => {
  const n = parseFloat(String(v ?? "").trim());
  return Number.isFinite(n) ? n : fallback;
};

const mmToMeters = (mm: number) => mm / 1000;
const metersToMm = (m: number) => m * 1000;

export const QuoteEdit: React.FC = () => {
  const { quoteId } = useParams<{ quoteId: string }>();
  const history = useHistory();

  const [toastMsg, setToastMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [signageTypes, setSignageTypes] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [addons, setAddons] = useState<any[]>([]);

  // Quote data
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteSignages, setQuoteSignages] = useState<QuoteSignage[]>([]);
  const [quoteMaterials, setQuoteMaterials] = useState<QuoteMaterial[]>([]);
  const [quoteAddons, setQuoteAddons] = useState<QuoteAddon[]>([]);
  const [quoteMiscItems, setQuoteMiscItems] = useState<QuoteMiscItem[]>([]);

  // Editable base fields
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [notes, setNotes] = useState("");

  // Load all data
  const fetchData = async () => {
    try {
      // Load quote
      const { data: q, error: qError } = await supabase
        .from("quotes")
        .select("*")
        .eq("quote_id", quoteId)
        .single();

      if (qError || !q) {
        setToastMsg("Failed to load quote.");
        return;
      }

      setQuote(q);
      setCompanyName(q.company_name || "");
      setContactName(q.contact_name || "");
      setContactEmail(q.contact_email || "");
      setContactPhone(q.contact_phone || "");
      setClientAddress(q.client_address || "");
      setDistanceKm(q.google_distance_km ?? 0);
      setNotes(q.notes ?? "");

      // Load signages
      const { data: signagesData } = await supabase
        .from("quote_signages")
        .select("*")
        .eq("quote_id", quoteId);

      if (signagesData) {
        setQuoteSignages(signagesData.map(s => ({
          quote_signage_id: s.quote_signage_id,
          signage_id: s.signage_id,
          width_m: s.width_m,
          height_m: s.height_m,
        })));
      }

      // Load materials
      const { data: materialsData } = await supabase
        .from("quote_materials")
        .select("*")
        .eq("quote_id", quoteId);

      if (materialsData) setQuoteMaterials(materialsData);

      // Load addons
      const { data: addonsData } = await supabase
        .from("quote_addons")
        .select("*")
        .eq("quote_id", quoteId);

      if (addonsData) setQuoteAddons(addonsData);

      // Load misc items
      const { data: miscData } = await supabase
        .from("quote_misc_items")
        .select("*")
        .eq("quote_id", quoteId);

      if (miscData) setQuoteMiscItems(miscData);

      // Load reference data
      const [sigTypes, mats, adds] = await Promise.all([
        supabase.from("signage_types").select("*").order("name"),
        supabase.from("materials").select("*").order("name"),
        supabase.from("addons").select("*").order("name"),
      ]);

      if (sigTypes.data) setSignageTypes(sigTypes.data);
      if (mats.data) setMaterials(mats.data);
      if (adds.data) setAddons(adds.data);
    } catch (err) {
      console.error(err);
      setToastMsg("Error loading data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [quoteId]);

  // Signage handlers
  const addSignage = () => {
    setQuoteSignages([...quoteSignages, { signage_id: 0, width_m: 1, height_m: 1 }]);
  };

  const removeSignage = (idx: number) => {
    const copy = [...quoteSignages];
    copy.splice(idx, 1);
    setQuoteSignages(copy);
  };

  const updateSignage = (idx: number, field: keyof QuoteSignage, value: any) => {
    const copy = [...quoteSignages];
    copy[idx] = { ...copy[idx], [field]: value };
    setQuoteSignages(copy);
  };

  // Misc item handlers
  const addMiscItem = () => {
    setQuoteMiscItems([...quoteMiscItems, { name: "", quantity: 1, unit_price: 0, total: 0 }]);
  };

  const removeMiscItem = (idx: number) => {
    const copy = [...quoteMiscItems];
    copy.splice(idx, 1);
    setQuoteMiscItems(copy);
  };

  const updateMiscItem = (idx: number, field: keyof QuoteMiscItem, value: any) => {
    const copy = [...quoteMiscItems];
    copy[idx] = { ...copy[idx], [field]: value };
    if (field === "quantity" || field === "unit_price") {
      copy[idx].total = safeFloat(copy[idx].quantity) * safeFloat(copy[idx].unit_price);
    }
    setQuoteMiscItems(copy);
  };

  // Save updates
  const saveQuote = async () => {
    if (!quote) return;
    setSaving(true);

    try {
      // Calculate totals
      const petrolFee = Math.max(0, distanceKm - 5) * 6.5;
      const miscCost = quoteMiscItems.reduce((sum, m) => sum + m.total, 0);

      // Update base quote
      const { error: quoteError } = await supabase
        .from("quotes")
        .update({
          company_name: companyName,
          contact_name: contactName,
          contact_email: contactEmail,
          contact_phone: contactPhone,
          client_address: clientAddress,
          google_distance_km: distanceKm,
          notes: notes || null,
          misc_cost: miscCost,
          petrol_fee: petrolFee,
          // Note: signage_cost, material_cost, addon_cost should be recalculated if materials/addons change
          total_cost: quote.signage_cost + quote.material_cost + quote.addon_cost + miscCost + petrolFee,
        })
        .eq("quote_id", quoteId);

      if (quoteError) throw quoteError;

      // Delete existing signages and re-insert
      await supabase.from("quote_signages").delete().eq("quote_id", quoteId);

      if (quoteSignages.length > 0) {
        const signagesToInsert = quoteSignages
          .filter(s => s.signage_id > 0)
          .map(s => ({
            quote_id: quoteId,
            signage_id: s.signage_id,
            width_m: s.width_m,
            height_m: s.height_m,
          }));

        if (signagesToInsert.length > 0) {
          const { error: sigError } = await supabase
            .from("quote_signages")
            .insert(signagesToInsert);
          if (sigError) throw sigError;
        }
      }

      // Delete existing misc items and re-insert
      await supabase.from("quote_misc_items").delete().eq("quote_id", quoteId);

      if (quoteMiscItems.length > 0) {
        const miscToInsert = quoteMiscItems
          .filter(m => m.name.trim().length > 0)
          .map(m => ({
            quote_id: quoteId,
            name: m.name,
            quantity: m.quantity,
            unit_price: m.unit_price,
            total: m.total,
          }));

        if (miscToInsert.length > 0) {
          const { error: miscError } = await supabase
            .from("quote_misc_items")
            .insert(miscToInsert);
          if (miscError) throw miscError;
        }
      }

      setToastMsg("Quote updated successfully.");
      setTimeout(() => history.goBack(), 1500);
    } catch (err) {
      console.error(err);
      setToastMsg("Failed to update quote.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar color="primary">
            <IonTitle>Edit Quote</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
            <IonSpinner name="dots" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (!quote) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar color="primary">
            <IonTitle>Edit Quote</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <IonText color="danger">Quote not found.</IonText>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButtons slot="start">
            <IonBackButton defaultHref="/quote-history" />
          </IonButtons>
          <IonTitle>Edit Quote</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {/* Customer Info */}
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Customer Information</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem>
              <IonLabel position="stacked">Company Name</IonLabel>
              <IonInput
                value={companyName}
                onIonChange={(e) => setCompanyName(e.detail.value ?? "")}
              />
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Contact Name</IonLabel>
              <IonInput
                value={contactName}
                onIonChange={(e) => setContactName(e.detail.value ?? "")}
              />
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Contact Email</IonLabel>
              <IonInput
                type="email"
                value={contactEmail}
                onIonChange={(e) => setContactEmail(e.detail.value ?? "")}
              />
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Contact Phone</IonLabel>
              <IonInput
                value={contactPhone}
                onIonChange={(e) => setContactPhone(e.detail.value ?? "")}
              />
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Address</IonLabel>
              <IonInput
                value={clientAddress}
                onIonChange={(e) => setClientAddress(e.detail.value ?? "")}
              />
            </IonItem>
          </IonCardContent>
        </IonCard>

        {/* Signages */}
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>
              Signages ({quoteSignages.length})
              <IonButton
                size="small"
                fill="clear"
                onClick={addSignage}
                style={{ float: "right" }}
              >
                <IonIcon icon={addCircle} slot="icon-only" />
              </IonButton>
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {quoteSignages.length === 0 ? (
              <IonText color="medium">No signages added.</IonText>
            ) : (
              quoteSignages.map((sig, idx) => (
                <IonCard key={idx} style={{ marginBottom: 12 }}>
                  <IonCardContent>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <strong>Signage {idx + 1}</strong>
                      <IonButton
                        size="small"
                        fill="clear"
                        color="danger"
                        onClick={() => removeSignage(idx)}
                      >
                        <IonIcon icon={closeCircle} slot="icon-only" />
                      </IonButton>
                    </div>

                    <IonItem>
                      <IonLabel>Type</IonLabel>
                      <IonSelect
                        value={sig.signage_id}
                        onIonChange={(e) => updateSignage(idx, "signage_id", e.detail.value)}
                      >
                        {signageTypes.map((st) => (
                          <IonSelectOption key={st.signage_id} value={st.signage_id}>
                            {st.name}
                          </IonSelectOption>
                        ))}
                      </IonSelect>
                    </IonItem>

                    <IonItem>
                      <IonLabel position="stacked">Width (mm)</IonLabel>
                      <IonInput
                        type="number"
                        value={metersToMm(sig.width_m)}
                        onIonChange={(e) =>
                          updateSignage(idx, "width_m", mmToMeters(safeFloat(e.detail.value, 1000)))
                        }
                      />
                    </IonItem>

                    <IonItem>
                      <IonLabel position="stacked">Height (mm)</IonLabel>
                      <IonInput
                        type="number"
                        value={metersToMm(sig.height_m)}
                        onIonChange={(e) =>
                          updateSignage(idx, "height_m", mmToMeters(safeFloat(e.detail.value, 1000)))
                        }
                      />
                    </IonItem>

                    <div style={{ marginTop: 8, fontSize: 14, color: "#666" }}>
                      Area: {(sig.width_m * sig.height_m).toFixed(2)} m²
                    </div>
                  </IonCardContent>
                </IonCard>
              ))
            )}
          </IonCardContent>
        </IonCard>

        {/* Misc Items */}
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>
              Misc Items ({quoteMiscItems.length})
              <IonButton
                size="small"
                fill="clear"
                onClick={addMiscItem}
                style={{ float: "right" }}
              >
                <IonIcon icon={addCircle} slot="icon-only" />
              </IonButton>
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {quoteMiscItems.length === 0 ? (
              <IonText color="medium">No misc items.</IonText>
            ) : (
              quoteMiscItems.map((misc, idx) => (
                <IonCard key={idx} style={{ marginBottom: 12 }}>
                  <IonCardContent>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <strong>{misc.name || `Item ${idx + 1}`}</strong>
                      <IonButton
                        size="small"
                        fill="clear"
                        color="danger"
                        onClick={() => removeMiscItem(idx)}
                      >
                        <IonIcon icon={closeCircle} slot="icon-only" />
                      </IonButton>
                    </div>

                    <IonItem>
                      <IonLabel position="stacked">Name</IonLabel>
                      <IonInput
                        value={misc.name}
                        onIonChange={(e) => updateMiscItem(idx, "name", e.detail.value ?? "")}
                      />
                    </IonItem>

                    <IonItem>
                      <IonLabel position="stacked">Quantity</IonLabel>
                      <IonInput
                        type="number"
                        value={misc.quantity}
                        onIonChange={(e) => updateMiscItem(idx, "quantity", safeFloat(e.detail.value, 1))}
                      />
                    </IonItem>

                    <IonItem>
                      <IonLabel position="stacked">Unit Price (R)</IonLabel>
                      <IonInput
                        type="number"
                        value={misc.unit_price}
                        onIonChange={(e) => updateMiscItem(idx, "unit_price", safeFloat(e.detail.value, 0))}
                      />
                    </IonItem>

                    <div style={{ marginTop: 8, fontSize: 14, color: "#666" }}>
                      Total: R{misc.total.toFixed(2)}
                    </div>
                  </IonCardContent>
                </IonCard>
              ))
            )}
          </IonCardContent>
        </IonCard>

        {/* Other Details */}
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Other Details</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem>
              <IonLabel position="stacked">Distance (km)</IonLabel>
              <IonInput
                type="number"
                value={distanceKm}
                onIonChange={(e) => setDistanceKm(safeFloat(e.detail.value, 0))}
              />
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Notes</IonLabel>
              <IonInput
                value={notes}
                onIonChange={(e) => setNotes(e.detail.value ?? "")}
              />
            </IonItem>

            <div style={{ marginTop: 16, padding: 12, background: "#f0f0f0", borderRadius: 8 }}>
              <div><strong>Petrol Fee:</strong> R{(Math.max(0, distanceKm - 5) * 6.5).toFixed(2)}</div>
              <div style={{ marginTop: 8 }}>
                <strong>Misc Cost:</strong> R{quoteMiscItems.reduce((s, m) => s + m.total, 0).toFixed(2)}
              </div>
            </div>
          </IonCardContent>
        </IonCard>

        {/* Save Button */}
        <IonButton
          expand="block"
          color="success"
          onClick={saveQuote}
          disabled={saving}
          style={{ marginTop: 16 }}
        >
          {saving ? "Saving..." : "Save Changes"}
        </IonButton>

        <IonToast
          isOpen={!!toastMsg}
          message={toastMsg}
          duration={3000}
          onDidDismiss={() => setToastMsg("")}
        />
      </IonContent>
    </IonPage>
  );
};

export default QuoteEdit;