import React, { useState, useEffect } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonInput, IonLabel, IonItem, IonButton, IonSelect, IonSelectOption,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonText,
  IonGrid, IonRow, IonCol, IonButtons, IonMenuButton, IonToast,
  IonCheckbox, IonIcon
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

interface MiscItem {
  name: string;
  quantity: number;
  unit_price: number;
}

const QuoteNew: React.FC = () => {
  const [section, setSection] = useState(0);
  const [toastMsg, setToastMsg] = useState("");
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [signages, setSignages] = useState<any[]>([]);
  const [addons, setAddons] = useState<any[]>([]);
  const [linkedMaterials, setLinkedMaterials] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    client_address: "",
    customer_id: null as string | null,
    signage_id: undefined as number | undefined,
    width: 1,
    height: 1,
    distance_km: 0,
    addon_ids: [] as number[],
    misc_items: [] as MiscItem[],
  });

  // ─── Load data & user ─────────────────────────────
  useEffect(() => {
    fetchData();
    getUser();
  }, []);

  useEffect(() => {
    if (form.signage_id) fetchMaterials(form.signage_id);
    else setLinkedMaterials([]);
  }, [form.signage_id]);

  const getUser = async () => {
    const { data } = await supabase.auth.getUser();
    setUserId(data.user?.id ?? null);
  };

  const fetchData = async () => {
    const [sigs, adds, custs] = await Promise.all([
      supabase.from("signage_types").select("*").order("name"),
      supabase.from("addons").select("*").order("name"),
      supabase.from("customers").select("*").order("company_name"),
    ]);
    setSignages(sigs.data || []);
    setAddons(adds.data || []);
    setCustomers(custs.data || []);
  };

  const fetchMaterials = async (signageId: number) => {
    const { data, error } = await supabase
      .from("signage_materials")
      .select(`
        quantity_required,
        materials(material_id, name, price, price_per_unit, unit_type)
      `)
      .eq("signage_id", signageId);

    if (error) {
      console.error("Error fetching materials:", error);
      setLinkedMaterials([]);
      return;
    }

    const flattened = (data || []).map((row: any) => ({
      ...row.materials,
      quantity_required: row.quantity_required ?? 1,
    }));
    setLinkedMaterials(flattened);
  };

  // ─── Misc Item Handlers ─────────────────────
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

  // ─── Autofill existing customer ─────────────
  useEffect(() => {
    if (!form.customer_id) return;
    const selected = customers.find(c => c.id === form.customer_id);
    if (selected) {
      setForm(f => ({
        ...f,
        company_name: selected.company_name ?? "",
        contact_name: selected.contact_name ?? "",
        contact_email: selected.contact_email ?? "",
        contact_phone: selected.contact_phone ?? "",
        client_address: selected.address ?? "",
      }));
    }
  }, [form.customer_id, customers]);

  // ─── Live Cost Calculation ───────────────────
  const costs = React.useMemo(() => {
    const area = form.width * form.height;

    const signageCost = linkedMaterials.reduce(
      (sum, m) =>
        sum + (m.price_per_unit ?? m.price ?? 0) * (m.quantity_required ?? 1) * area,
      0
    );

    const materialCost = linkedMaterials.reduce(
      (sum, m) => sum + (m.price_per_unit ?? m.price ?? 0) * (m.quantity_required ?? 1),
      0
    );

    const addonCost = addons.reduce((sum, a) => {
      if (!form.addon_ids.includes(a.addon_id)) return sum;
      return sum + (a.is_flat ? a.flat_rate : (a.per_sqm_rate ?? 0) * area);
    }, 0);

    const miscCost = form.misc_items.reduce((sum, m) => sum + m.quantity * m.unit_price, 0);

    const petrolFee = Math.max(0, form.distance_km - 5) * 6.5;

    return {
      signageCost,
      materialCost,
      addonCost,
      miscCost,
      petrolFee,
      totalCost: signageCost + materialCost + addonCost + miscCost + petrolFee,
    };
  }, [form, linkedMaterials, addons]);

  // ─── Navigation ─────────────────────────────
  const canGoNext0 = !!(
    form.company_name || form.contact_name || form.contact_email || form.contact_phone || form.client_address
  );
  const canGoNext1 = !!form.signage_id && form.width > 0 && form.height > 0;

  // ─── Submit ────────────────────────────────
  const handleSubmit = async () => {
    if (!userId || !form.signage_id) {
      setToastMsg("Missing required fields.");
      return;
    }
    setSubmitting(true);
    setToastMsg("");

    let customerId = form.customer_id;
    if (!customerId) {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          company_name: form.company_name,
          contact_name: form.contact_name,
          contact_email: form.contact_email,
          contact_phone: form.contact_phone,
          address: form.client_address,
        })
        .select()
        .single();

      if (error || !data) {
        setToastMsg("Failed to create customer.");
        setSubmitting(false);
        return;
      }
      customerId = data.id;
    }

    try {
      const { data: quote, error } = await supabase
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
          customer_id: customerId,
          google_distance_km: form.distance_km,
          petrol_fee: costs.petrolFee,
          total_cost: costs.totalCost,
        })
        .select()
        .single();

      if (error || !quote) throw error;
      const newQuoteId = quote.quote_id as string;

      // ─── Addons ─────────
      if (form.addon_ids.length) {
        await supabase.from("quote_addons").insert(
          form.addon_ids.map((id) => ({ quote_id: newQuoteId, addon_id: id }))
        );
      }

      // ─── Misc Items ─────────
      if (form.misc_items.length) {
        await supabase.from("quote_misc_items").insert(
          form.misc_items
            .filter((m) => m.name.trim().length)
            .map((m) => ({
              quote_id: newQuoteId,
              name: m.name,
              quantity: m.quantity,
              unit_price: m.unit_price,
            }))
        );
      }

      setQuoteId(newQuoteId);
      setToastMsg("Quote submitted successfully!");
      setSection(3);
    } catch (e) {
      console.error(e);
      setToastMsg("Failed to save quote completely.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ────────────────────────────────
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle className="ion-text-center">Quote Builder</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonGrid>
          <IonRow className="ion-justify-content-center">
            <IonCol sizeMd="8" sizeLg="6">
              <IonCard>
                <IonCardHeader>
                  <IonCardTitle>Step {section + 1}</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>

                  {/* SECTION 0: Customer Info */}
                  {section === 0 && (
                    <>
                      <IonItem>
                        <IonLabel>Existing Customer</IonLabel>
                        <IonSelect
                          value={form.customer_id}
                          placeholder="Select existing"
                          onIonChange={(e) =>
                            setForm({ ...form, customer_id: e.detail.value })
                          }
                        >
                          {customers.map((c) => (
                            <IonSelectOption key={c.id} value={c.id}>
                              {c.company_name} - {c.contact_name}
                            </IonSelectOption>
                          ))}
                        </IonSelect>
                      </IonItem>
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
                      <IonButton expand="block" onClick={() => setSection(1)} disabled={!canGoNext0}>
                        Next
                      </IonButton>
                    </>
                  )}

                  {/* SECTION 1: Signage */}
                  {section === 1 && (
                    <>
                      <IonItem>
                        <IonLabel>Signage Type</IonLabel>
                        <IonSelect
                          value={form.signage_id}
                          placeholder="Select signage"
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
                          onIonChange={(e) => setForm({ ...form, width: safeFloat(e.detail.value, 1) })}
                        />
                      </IonItem>
                      <IonItem>
                        <IonLabel position="stacked">Height (m)</IonLabel>
                        <IonInput
                          type="number"
                          value={form.height}
                          onIonChange={(e) => setForm({ ...form, height: safeFloat(e.detail.value, 1) })}
                        />
                      </IonItem>
                      <IonItem>
                        <IonLabel position="stacked">Distance (km)</IonLabel>
                        <IonInput
                          type="number"
                          value={form.distance_km}
                          onIonChange={(e) =>
                            setForm({ ...form, distance_km: safeFloat(e.detail.value, 0) })
                          }
                        />
                      </IonItem>
                      <IonButton expand="block" onClick={() => setSection(2)} disabled={!canGoNext1}>
                        Next
                      </IonButton>
                      <IonButton expand="block" fill="clear" onClick={() => setSection(0)}>Back</IonButton>
                    </>
                  )}

                  {/* SECTION 2: Addons & Misc */}
                  {section === 2 && (
                    <>
                      <IonText><strong>Add-ons:</strong></IonText>
                      <div style={{ display: "flex", overflowX: "auto", padding: "0.5rem 0" }}>
                        {addons.map((a) => (
                          <IonCard key={a.addon_id} style={{ minWidth: 160, marginRight: 8 }}>
                            <IonCardHeader>
                              <IonCardTitle>{a.name}</IonCardTitle>
                            </IonCardHeader>
                            <IonCardContent>
                              <IonText>
                                {a.is_flat ? `R${a.flat_rate}` : `R${a.per_sqm_rate ?? 0} per sqm`}
                              </IonText>
                              <IonCheckbox
                                checked={form.addon_ids.includes(a.addon_id)}
                                onIonChange={(e) => {
                                  const updated = e.detail.checked
                                    ? [...form.addon_ids, a.addon_id]
                                    : form.addon_ids.filter((id) => id !== a.addon_id);
                                  setForm({ ...form, addon_ids: updated });
                                }}
                              />
                            </IonCardContent>
                          </IonCard>
                        ))}
                      </div>

                      <IonButton expand="block" onClick={handleAddMiscItem}>Add Misc Item</IonButton>

                      {form.misc_items.map((m, idx) => (
                        <IonCard key={idx}>
                          <IonCardHeader>
                            <IonCardTitle>
                              {m.name || "New Misc Item"}
                              <IonIcon
                                icon={closeCircle}
                                slot="end"
                                onClick={() => handleRemoveMiscItem(idx)}
                              />
                            </IonCardTitle>
                          </IonCardHeader>
                          <IonCardContent>
                            <IonItem>
                              <IonLabel position="stacked">Name</IonLabel>
                              <IonInput
                                value={m.name}
                                onIonChange={(e) => {
                                  const copy = [...form.misc_items];
                                  copy[idx].name = e.detail.value ?? "";
                                  setForm({ ...form, misc_items: copy });
                                }}
                              />
                            </IonItem>
                            <IonItem>
                              <IonLabel position="stacked">Quantity</IonLabel>
                              <IonInput
                                type="number"
                                value={m.quantity}
                                onIonChange={(e) => {
                                  const copy = [...form.misc_items];
                                  copy[idx].quantity = safeInt(e.detail.value, 1);
                                  setForm({ ...form, misc_items: copy });
                                }}
                              />
                            </IonItem>
                            <IonItem>
                              <IonLabel position="stacked">Unit Price</IonLabel>
                              <IonInput
                                type="number"
                                value={m.unit_price}
                                onIonChange={(e) => {
                                  const copy = [...form.misc_items];
                                  copy[idx].unit_price = safeFloat(e.detail.value, 0);
                                  setForm({ ...form, misc_items: copy });
                                }}
                              />
                            </IonItem>
                          </IonCardContent>
                        </IonCard>
                      ))}

                      <IonText className="ion-padding-top">
                        <p><strong>Signage:</strong> R{costs.signageCost.toFixed(2)}</p>
                        <p><strong>Materials:</strong> R{costs.materialCost.toFixed(2)}</p>
                        <p><strong>Addons:</strong> R{costs.addonCost.toFixed(2)}</p>
                        <p><strong>Misc Items:</strong> R{costs.miscCost.toFixed(2)}</p>
                        <p><strong>Petrol Fee:</strong> R{costs.petrolFee.toFixed(2)}</p>
                        <p><strong>Total:</strong> R{costs.totalCost.toFixed(2)}</p>
                      </IonText>

                      <IonButton expand="block" onClick={handleSubmit} disabled={submitting}>
                        Submit Quote
                      </IonButton>
                      <IonButton expand="block" fill="clear" onClick={() => setSection(1)}>Back</IonButton>
                    </>
                  )}

                  {/* SECTION 3: Preview */}
                  {section === 3 && quoteId && (
                    <PreviewQuote quoteId={quoteId} />
                  )}

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

export default QuoteNew;
