import React, { useState, useEffect } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonInput,
  IonLabel,
  IonItem,
  IonButton,
  IonSelect,
  IonSelectOption,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonText,
  IonList,
  IonCheckbox,
  IonGrid,
  IonRow,
  IonCol,
  IonButtons,
  IonMenuButton,
  IonToast,
  IonIcon,
} from "@ionic/react";
import { closeCircle } from "ionicons/icons";
import { supabase } from "../../supbaseclient";
import PreviewQuote from "./PreviewQuote";

const safeFloat = (v: string | null | undefined, fallback = 0) => {
  const n = parseFloat(String(v ?? "").trim());
  return Number.isFinite(n) ? n : fallback;
};
const safeInt = (v: string | null | undefined, fallback = 0) => {
  const n = parseInt(String(v ?? "").trim(), 10);
  return Number.isFinite(n) ? n : fallback;
};

const UserQuoteBuilder: React.FC = () => {
  const [section, setSection] = useState(0);
  const [toastMsg, setToastMsg] = useState("");
  const [quoteId, setQuoteId] = useState<string | null>(null);

  const [signages, setSignages] = useState<any[]>([]);
  const [addons, setAddons] = useState<any[]>([]);
  const [linkedMaterials, setLinkedMaterials] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // form state
  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    client_address: "",
    signage_id: undefined as number | undefined,
    width: 1,
    height: 1,
    addon_ids: [] as number[],
    misc_items: [] as { name: string; quantity: number; unit_price: number }[],
    distance_km: 0,
  });

  useEffect(() => {
    fetchData();
    getUser();
  }, []);

  useEffect(() => {
    if (form.signage_id) fetchMaterials(form.signage_id);
  }, [form.signage_id]);

  const fetchData = async () => {
    const [sigs, adds] = await Promise.all([
      supabase
        .from("signage_types")
        .select("*")
        .order("name", { ascending: true }),
      supabase.from("addons").select("*").order("name", { ascending: true }),
    ]);
    setSignages(sigs.data || []);
    setAddons(adds.data || []);
  };

  const fetchMaterials = async (signageId: number) => {
    const { data, error } = await supabase
      .from("materials")
      .select("*")
      .eq("signage_id", signageId);
    if (!error) setLinkedMaterials(data || []);
  };

  const getUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
  };

  const handleAddMiscItem = () => {
    setForm((f) => ({
      ...f,
      misc_items: [...f.misc_items, { name: "", quantity: 1, unit_price: 0 }],
    }));
  };

  const handleRemoveMiscItem = (idx: number) => {
    setForm((f) => {
      const copy = [...f.misc_items];
      copy.splice(idx, 1);
      return { ...f, misc_items: copy };
    });
  };

  // ─── Pricing logic ───────────────────────────────────────────────
  const area = form.width * form.height;

  const materialCost = linkedMaterials.reduce((sum, m) => {
    return sum + (m.price_per_unit || 0) * (m.quantity_required || 0);
  }, 0);

  const signageBase = signages.find((s) => s.signage_id === form.signage_id);
  const signageCost = signageBase?.base_price
    ? signageBase.base_price * area
    : 0;

  const addonCost = addons.reduce((sum, a) => {
    if (!form.addon_ids.includes(a.addon_id)) return sum;
    return sum + (a.is_flat ? a.flat_rate : a.per_sqm_rate * area);
  }, 0);

  const miscCost = form.misc_items.reduce(
    (sum, m) => sum + m.quantity * m.unit_price,
    0
  );

  const petrolRate = 6.5;
  const petrolFee = Math.max(0, form.distance_km - 5) * petrolRate;

  const totalCost =
    signageCost + materialCost + addonCost + miscCost + petrolFee;

  // ─── Navigation ───────────────────────────────────────────────
  const canGoNext0 = !!(
    form.company_name ||
    form.contact_name ||
    form.contact_email ||
    form.contact_phone ||
    form.client_address
  );
  const canGoNext1 = !!form.signage_id && form.width > 0 && form.height > 0;

  // ─── Submit handler ────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!userId || !form.signage_id) {
      setToastMsg("Missing required fields.");
      return;
    }
    setSubmitting(true);
    setToastMsg("");

    let finalAddonIds = [...form.addon_ids];
    if (form.distance_km > 10) {
      const callout = addons.find((a) => {
        const n = String(a.name || "").toLowerCase();
        return n.includes("call-out") || n.includes("call out");
      });
      if (callout && !finalAddonIds.includes(callout.addon_id)) {
        finalAddonIds.push(callout.addon_id);
      }
    }

    const { data, error } = await supabase
      .from("quotes")
      .insert({
        user_id: userId,
        signage_id: form.signage_id,
        width: form.width,
        height: form.height,
        company_name: form.company_name,
        contact_name: form.contact_name,
        contact_email: form.contact_email,
        contact_phone: form.contact_phone,
        client_address: form.client_address,
        google_distance_km: form.distance_km,
        petrol_fee: petrolFee,
        total_cost: totalCost, // ✅ save total cost
      })
      .select()
      .single();

    if (error || !data) {
      console.error(error);
      setToastMsg("Failed to save quote.");
      setSubmitting(false);
      return;
    }

    const newQuoteId = data.quote_id as string;

    try {
      if (finalAddonIds.length > 0) {
        const { error: qaErr } = await supabase
          .from("quote_addons")
          .insert(finalAddonIds.map((id) => ({ quote_id: newQuoteId, addon_id: id })));
        if (qaErr) throw qaErr;
      }

      if (form.misc_items.length > 0) {
        const miscRows = form.misc_items
          .filter((m) => (m.name || "").trim().length > 0)
          .map((m) => ({
            quote_id: newQuoteId,
            name: m.name,
            quantity: m.quantity,
            unit_price: m.unit_price,
          }));
        if (miscRows.length > 0) {
          const { error: qmErr } = await supabase
            .from("quote_misc_items")
            .insert(miscRows);
          if (qmErr) throw qmErr;
        }
      }

      setQuoteId(newQuoteId);
      setToastMsg("Quote submitted!");
      setSection(3);
    } catch (e) {
      console.error(e);
      setToastMsg("Saved quote but failed on add-ons or misc items.");
      setQuoteId(newQuoteId);
      setSection(3);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle className="ion-text-center">Quote Builder</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonGrid>
          <IonRow className="ion-justify-content-center">
            <IonCol sizeMd="8" sizeLg="6">
              <IonCard className="ion-padding">
                <IonCardHeader>
                  <IonCardTitle>Step {section + 1}</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  {/* SECTION 0: Client Info */}
                  {section === 0 && (
                    <>
                      <IonItem>
                        <IonLabel position="stacked">Company Name</IonLabel>
                        <IonInput
                          value={form.company_name}
                          onIonChange={(e) =>
                            setForm({ ...form, company_name: e.detail.value ?? "" })
                          }
                        />
                      </IonItem>
                      <IonItem>
                        <IonLabel position="stacked">Contact Name</IonLabel>
                        <IonInput
                          value={form.contact_name}
                          onIonChange={(e) =>
                            setForm({ ...form, contact_name: e.detail.value ?? "" })
                          }
                        />
                      </IonItem>
                      <IonItem>
                        <IonLabel position="stacked">Contact Email</IonLabel>
                        <IonInput
                          type="email"
                          value={form.contact_email}
                          onIonChange={(e) =>
                            setForm({ ...form, contact_email: e.detail.value ?? "" })
                          }
                        />
                      </IonItem>
                      <IonItem>
                        <IonLabel position="stacked">Contact Phone</IonLabel>
                        <IonInput
                          value={form.contact_phone}
                          onIonChange={(e) =>
                            setForm({ ...form, contact_phone: e.detail.value ?? "" })
                          }
                        />
                      </IonItem>
                      <IonItem>
                        <IonLabel position="stacked">Address</IonLabel>
                        <IonInput
                          value={form.client_address}
                          onIonChange={(e) =>
                            setForm({ ...form, client_address: e.detail.value ?? "" })
                          }
                        />
                      </IonItem>
                      <IonButton
                        expand="block"
                        onClick={() => setSection(1)}
                        disabled={!canGoNext0}
                      >
                        Next
                      </IonButton>
                    </>
                  )}

                  {/* SECTION 1: Signage */}
                  {section === 1 && (
                    <>
                      <IonItem>
                        <IonLabel position="stacked">Signage Type</IonLabel>
                        <IonSelect
                          value={form.signage_id}
                          onIonChange={(e) =>
                            setForm({ ...form, signage_id: e.detail.value })
                          }
                        >
                          {signages.map((s) => (
                            <IonSelectOption key={s.signage_id} value={s.signage_id}>
                              {s.name}
                            </IonSelectOption>
                          ))}
                        </IonSelect>
                      </IonItem>
                      <IonItem>
                        <IonLabel position="stacked">Width (m)</IonLabel>
                        <IonInput
                          type="number"
                          value={form.width}
                          onIonChange={(e) =>
                            setForm({ ...form, width: safeFloat(e.detail.value, 0) })
                          }
                        />
                      </IonItem>
                      <IonItem>
                        <IonLabel position="stacked">Height (m)</IonLabel>
                        <IonInput
                          type="number"
                          value={form.height}
                          onIonChange={(e) =>
                            setForm({ ...form, height: safeFloat(e.detail.value, 0) })
                          }
                        />
                      </IonItem>
                      <IonItem>
                        <IonLabel position="stacked">Distance (km)</IonLabel>
                        <IonInput
                          type="number"
                          value={form.distance_km}
                          onIonChange={(e) =>
                            setForm({
                              ...form,
                              distance_km: safeFloat(e.detail.value, 0),
                            })
                          }
                        />
                      </IonItem>

                      {/* Show base calculated cost only */}
                      <IonText color="success">
                        <strong>Base Cost: R{materialCost.toFixed(2)}</strong>
                      </IonText>

                      <IonButton
                        expand="block"
                        onClick={() => setSection(2)}
                        disabled={!canGoNext1}
                      >
                        Next
                      </IonButton>
                      <IonButton expand="block" fill="clear" onClick={() => setSection(0)}>
                        Back
                      </IonButton>
                    </>
                  )}

                  {/* SECTION 2: Add-ons & Misc Items */}
                  {section === 2 && (
                    <>
                      <IonList>
                        {addons.map((a) => (
                          <IonItem key={a.addon_id}>
                            <IonLabel>
                              {a.name}{" "}
                              <IonText color="medium">
                                ({a.is_flat
                                  ? `R${a.flat_rate}`
                                  : `R${a.per_sqm_rate} per sqm`}
                                )
                              </IonText>
                            </IonLabel>
                            <IonCheckbox
                              slot="end"
                              checked={form.addon_ids.includes(a.addon_id)}
                              onIonChange={(e) => {
                                const updated = e.detail.checked
                                  ? [...form.addon_ids, a.addon_id]
                                  : form.addon_ids.filter((id) => id !== a.addon_id);
                                setForm({ ...form, addon_ids: updated });
                              }}
                            />
                          </IonItem>
                        ))}
                      </IonList>

                      <IonCard>
                        <IonCardHeader>
                          <IonCardTitle>Miscellaneous Items</IonCardTitle>
                        </IonCardHeader>
                        <IonCardContent>
                          {form.misc_items.map((m, idx) => (
                            <div key={idx} style={{ position: "relative", paddingBottom: 8 }}>
                              <IonButton
                                size="small"
                                fill="clear"
                                color="medium"
                                style={{ position: "absolute", right: 0, top: -8 }}
                                onClick={() => handleRemoveMiscItem(idx)}
                              >
                                <IonIcon icon={closeCircle} />
                              </IonButton>
                              <IonItem>
                                <IonLabel position="stacked">Item Name</IonLabel>
                                <IonInput
                                  value={m.name}
                                  onIonChange={(e) => {
                                    const updated = [...form.misc_items];
                                    updated[idx].name = e.detail.value ?? "";
                                    setForm({ ...form, misc_items: updated });
                                  }}
                                />
                              </IonItem>
                              <IonItem>
                                <IonLabel position="stacked">Quantity</IonLabel>
                                <IonInput
                                  type="number"
                                  value={m.quantity}
                                  onIonChange={(e) => {
                                    const updated = [...form.misc_items];
                                    updated[idx].quantity = safeInt(e.detail.value, 1) || 1;
                                    setForm({ ...form, misc_items: updated });
                                  }}
                                />
                              </IonItem>
                              <IonItem>
                                <IonLabel position="stacked">Unit Price</IonLabel>
                                <IonInput
                                  type="number"
                                  value={m.unit_price}
                                  onIonChange={(e) => {
                                    const updated = [...form.misc_items];
                                    updated[idx].unit_price = safeFloat(e.detail.value, 0);
                                    setForm({ ...form, misc_items: updated });
                                  }}
                                />
                              </IonItem>
                            </div>
                          ))}
                          <IonButton expand="block" onClick={handleAddMiscItem}>
                            Add Misc Item
                          </IonButton>
                        </IonCardContent>
                      </IonCard>

                      <IonButton expand="block" onClick={handleSubmit} disabled={submitting}>
                        {submitting ? "Submitting…" : "Submit & Preview"}
                      </IonButton>
                      <IonButton expand="block" fill="clear" onClick={() => setSection(1)}>
                        Back
                      </IonButton>
                    </>
                  )}

                  {/* SECTION 3: Preview */}
                  {section === 3 && quoteId && <PreviewQuote quoteId={quoteId} />}
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>
        </IonGrid>
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

export default UserQuoteBuilder;
