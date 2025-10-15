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
        scale_with_area,
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
      scale_with_area: row.scale_with_area ?? true,
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

    // signageCost: per your frontend rules (materials that scale with area)
    const signageCost = linkedMaterials.reduce(
      (sum, m) =>
        sum + (m.price_per_unit ?? m.price ?? 0) * (m.quantity_required ?? 1) * area,
      0
    );

    // materialCost: base materials (not scaled by area)
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
      totalCost: signageCost + addonCost + miscCost + petrolFee,
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

    // compute area once
    const area = form.width * form.height;

    // Prepare costs same as live calc (defensive)
    const signageCost = linkedMaterials.reduce(
      (sum, m) =>
        sum + (safeFloat(m.price_per_unit ?? m.price ?? 0) * (m.quantity_required ?? 1) * area),
      0
    );

    const materialCost = linkedMaterials.reduce(
      (sum, m) => sum + (safeFloat(m.price_per_unit ?? m.price ?? 0) * (m.quantity_required ?? 1)),
      0
    );

    // compute addon cost by looking up addons (safer than trusting frontend a bit)
    const { data: addonRows } = await supabase
      .from("addons")
      .select("addon_id, flat_rate, per_sqm_rate, is_flat")
      .in("addon_id", form.addon_ids);

    const addonCost = (addonRows ?? []).reduce((sum: number, a: any) => {
      if (a.is_flat) return sum + (safeFloat(a.flat_rate, 0));
      return sum + (safeFloat(a.per_sqm_rate, 0) * area);
    }, 0);

    const miscCost = form.misc_items.reduce((sum, m) => sum + m.quantity * m.unit_price, 0);

    const petrolFee = Math.max(0, form.distance_km - 5) * 6.5;

    const totalCost = signageCost + materialCost + addonCost + miscCost + petrolFee;

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
      // Insert quote (minimal info first) but also save petrol_fee, area and total_cost placeholders
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
          petrol_fee: petrolFee,
          // we'll update detailed breakdown after creating child rows, but store total now
          total_cost: totalCost,
        })
        .select()
        .single();

      if (error || !quote) throw error;
      const newQuoteId = quote.quote_id as string;

      // ─── Quote Materials: persist the material rows (unit price / qty / total) ─────────
      // For each linked material, compute quantity and total consistent with frontend rules:
      // - If unit_type = 'sqm' and scale_with_area => quantity = quantity_required * area (but the quote_materials.quantity column probably represents units, keep original intention: store quantity_required as base qty, and store unit_price, total)
      // We'll store:
      //   quantity = (m.scale_with_area ? quantity_required * area : quantity_required)
      //   unit_price = price_per_unit ?? price
      //   total = quantity * unit_price
      if (linkedMaterials.length) {
        const qmInserts = linkedMaterials.map((m) => {
          const unitPrice = safeFloat(m.price_per_unit ?? m.price ?? 0);
          // if scale_with_area true we multiply by area (so unit quantity becomes quantity_required * area)
          const qty = (m.scale_with_area ? (m.quantity_required ?? 1) * area : (m.quantity_required ?? 1));
          const total = unitPrice * qty;
          return {
            quote_id: newQuoteId,
            material_id: m.material_id,
            quantity: qty,
            unit_price: unitPrice,
            //total,
          };
        });

        // insert in chunks
        const { error: qmError } = await supabase.from("quote_materials").insert(qmInserts);
        if (qmError) console.warn("Failed to insert quote_materials:", qmError);
      }

      // ─── Quote Addons (map only) ─────────
      if (form.addon_ids.length) {
        const qaInserts = form.addon_ids.map((id) => ({ quote_id: newQuoteId, addon_id: id }));
        const { error: qaError } = await supabase.from("quote_addons").insert(qaInserts);
        if (qaError) console.warn("Failed to insert quote_addons:", qaError);
      }

      // ─── Quote Misc Items ─────────
      if (form.misc_items.length) {
        const qmiInserts = form.misc_items
          .filter((m) => m.name.trim().length)
          .map((m) => {
            //const total = m.quantity * m.unit_price;
            return {
              quote_id: newQuoteId,
              name: m.name,
              quantity: m.quantity,
              unit_price: m.unit_price,
              //total,
            };
          });
        const { error: qmiError } = await supabase.from("quote_misc_items").insert(qmiInserts);
        if (qmiError) console.warn("Failed to insert quote_misc_items:", qmiError);
      }

      // ─── Recompute breakdown server-side (defensive) and update quotes row so DB has persisted costs ─────────
      // Fetch materials totals from quote_materials
      const { data: savedMats } = await supabase
        .from("quote_materials")
        .select("quantity, unit_price, total");

      // But we need only those for this quote:
      const { data: matsForQuote } = await supabase
        .from("quote_materials")
        .select("quantity, unit_price, total")
        .eq("quote_id", newQuoteId);

      const materialCostPersist = (matsForQuote ?? []).reduce((s: number, r: any) => s + safeFloat(r.total, 0), 0);

      // Sum addons using DB table
      const { data: selectedAddons } = await supabase
        .from("addons")
        .select("addon_id, flat_rate, per_sqm_rate, is_flat")
        .in("addon_id", form.addon_ids);

      const addonCostPersist = (selectedAddons ?? []).reduce((s: number, a: any) => {
        if (a.is_flat) return s + safeFloat(a.flat_rate, 0);
        return s + safeFloat(a.per_sqm_rate, 0) * area;
      }, 0);

      // Sum misc from quote_misc_items
      const { data: miscForQuote } = await supabase
        .from("quote_misc_items")
        .select("total")
        .eq("quote_id", newQuoteId);

      const miscCostPersist = (miscForQuote ?? []).reduce((s: number, r: any) => s + safeFloat(r.total, 0), 0);

      // signageCostPersist: keep the frontend definition (materials that scale by area)
      const signageCostPersist = linkedMaterials.reduce(
        (sum, m) =>
          sum + (safeFloat(m.price_per_unit ?? m.price ?? 0) * (m.quantity_required ?? 1) * area),
        0
      );

      const petrolFeePersist = petrolFee;

      const totalPersist = signageCostPersist + materialCostPersist + addonCostPersist + miscCostPersist + petrolFeePersist;

      // Update the quotes row with persisted breakdown values
      const { error: updateError } = await supabase
        .from("quotes")
        .update({
          signage_cost: signageCostPersist,
          material_cost: materialCostPersist,
          addon_cost: addonCostPersist,
          misc_cost: miscCostPersist,
          petrol_fee: petrolFeePersist,
          total_cost: totalPersist,
          //area: area,
        })
        .eq("quote_id", newQuoteId);

      if (updateError) console.warn("Failed to update quote breakdown:", updateError);

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

                  {section === 3 && quoteId && (
                    <PreviewQuote quoteId={quoteId } />
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
