// deno-lint-ignore-file no-explicit-any
import React, { useEffect, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonModal,
  IonToast,
  IonSelect,
  IonSelectOption,
  IonAlert,
  IonButtons,
  IonMenuButton,
  IonToggle,
} from "@ionic/react";
import { supabase } from "../../supbaseclient.tsx";

interface SignageType {
  signage_id: number;
  name: string;
  description: string;
  base_price_per_sqm: number;
  calculatedBasePrice?: number;
}

interface Material {
  material_id: number;
  name: string;
  price: number;
  pricing_type: string; // e.g., "unit", "sqm"
}

interface LinkedMaterial extends Material {
  quantity_required: number;
  scale_with_area: boolean;
}

export default function AdminSignage() {
  const [signages, setSignages] = useState<SignageType[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [linkedMaterials, setLinkedMaterials] = useState<LinkedMaterial[]>([]);
  const [selectedSignage, setSelectedSignage] = useState<Partial<SignageType>>({});
  const [selectedMaterial, setSelectedMaterial] = useState<number | "">("");
  const [materialQty, setMaterialQty] = useState<number>(1);

  const [showSignageModal, setShowSignageModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [newMaterial, setNewMaterial] = useState<Partial<Material>>({});
  const [toastMessage, setToastMessage] = useState("");

  const [editMaterialId, setEditMaterialId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState<number>(1);
  const [showEditAlert, setShowEditAlert] = useState(false);

  useEffect(() => {
    fetchSignages();
    fetchMaterials();
  }, []);

  const fetchSignages = async () => {
    const { data: signagesData, error } = await supabase
      .from("signage_types")
      .select("*");

    if (error || !signagesData) return;

    const updatedSignages = await Promise.all(
      signagesData.map(async (s: SignageType) => {
        const { data: mats, error: matErr } = await supabase
          .from("signage_materials")
          .select(
            `
            quantity_required,
            scale_with_area,
            materials (
              material_id,
              name,
              price,
              pricing_type
            )
          `
          )
          .eq("signage_id", s.signage_id);

        if (matErr || !mats || mats.length === 0) {
          return { ...s, calculatedBasePrice: s.base_price_per_sqm };
        }

        const calcPrice = mats.reduce((sum: number, m: any) => {
          let unitCost = m.materials.price || 0;
          if (m.materials.pricing_type === "sqm") {
            // area scaling is handled elsewhere; here we just use base price
            unitCost = (m.materials.price || 0) * 1;
          }
          return sum + unitCost * m.quantity_required;
        }, 0);

        return { ...s, calculatedBasePrice: calcPrice };
      })
    );

    setSignages(updatedSignages);
  };

  const fetchMaterials = async () => {
    const { data, error } = await supabase.from("materials").select("*");
    if (!error && data) setMaterials(data);
  };

  const fetchLinkedMaterials = async (signageId: number) => {
    const { data, error } = await supabase
      .from("signage_materials")
      .select(
        `
        quantity_required,
        scale_with_area,
        materials (
          material_id,
          name,
          price,
          pricing_type
        )
      `
      )
      .eq("signage_id", signageId);

    if (!error && data) {
      const formatted: LinkedMaterial[] = data.map((d: any) => ({
        material_id: d.materials.material_id,
        name: d.materials.name,
        price: d.materials.price,
        pricing_type: d.materials.pricing_type,
        quantity_required: d.quantity_required,
        scale_with_area: d.scale_with_area ?? true,
      }));
      setLinkedMaterials(formatted);
    }
  };

  const handleSaveSignage = async () => {
    if (!selectedSignage.name) {
      setToastMessage("Name is required.");
      return;
    }

    if (selectedSignage.signage_id) {
      const { error } = await supabase
        .from("signage_types")
        .update({
          name: selectedSignage.name,
          description: selectedSignage.description,
        })
        .eq("signage_id", selectedSignage.signage_id);

      if (!error) setToastMessage("Signage updated.");
    } else {
      const { error } = await supabase.from("signage_types").insert({
        name: selectedSignage.name,
        description: selectedSignage.description,
        base_price_per_sqm: selectedSignage.base_price_per_sqm || 0,
      });
      if (!error) setToastMessage("Signage added.");
    }

    setShowSignageModal(false);
    setSelectedSignage({});
    setLinkedMaterials([]);
    fetchSignages();
  };

  const handleDeleteSignage = async (id: number) => {
    const { error } = await supabase
      .from("signage_types")
      .delete()
      .eq("signage_id", id);
    if (!error) {
      setToastMessage("Signage deleted.");
      fetchSignages();
    }
  };

  const handleAddMaterialToSignage = async () => {
    if (!selectedSignage.signage_id || !selectedMaterial || materialQty <= 0) {
      setToastMessage("Select signage, material, and a positive quantity.");
      return;
    }

    // default scale_with_area = true (DB default), but we can be explicit
    const { error } = await supabase.from("signage_materials").insert({
      signage_id: selectedSignage.signage_id,
      material_id: selectedMaterial,
      quantity_required: materialQty,
      scale_with_area: true,
    });

    if (!error) {
      setToastMessage("Material linked to signage.");
      setSelectedMaterial("");
      setMaterialQty(1);
      fetchLinkedMaterials(selectedSignage.signage_id);
      fetchSignages();
    }
  };

  const handleRemoveMaterial = async (materialId: number) => {
    if (!selectedSignage.signage_id) return;

    const { error } = await supabase
      .from("signage_materials")
      .delete()
      .eq("signage_id", selectedSignage.signage_id)
      .eq("material_id", materialId);

    if (!error) {
      setToastMessage("Material removed.");
      fetchLinkedMaterials(selectedSignage.signage_id);
      fetchSignages();
    }
  };

  const handleUpdateMaterialQty = async () => {
    if (!selectedSignage.signage_id || !editMaterialId) return;

    const { error } = await supabase
      .from("signage_materials")
      .update({ quantity_required: editQty })
      .eq("signage_id", selectedSignage.signage_id)
      .eq("material_id", editMaterialId);

    if (!error) {
      setToastMessage("Material quantity updated.");
      fetchLinkedMaterials(selectedSignage.signage_id);
      fetchSignages();
      setShowEditAlert(false);
      setEditMaterialId(null);
    }
  };

  const handleToggleScaleWithArea = async (
    materialId: number,
    newValue: boolean
  ) => {
    if (!selectedSignage.signage_id) return;

    const { error } = await supabase
      .from("signage_materials")
      .update({ scale_with_area: newValue })
      .eq("signage_id", selectedSignage.signage_id)
      .eq("material_id", materialId);

    if (error) {
      setToastMessage("Error updating scale option.");
      return;
    }

    setToastMessage(
      `Material will ${newValue ? "" : "not "}scale with area.`
    );

    // Update local state
    setLinkedMaterials((prev) =>
      prev.map((m) =>
        m.material_id === materialId
          ? { ...m, scale_with_area: newValue }
          : m
      )
    );
    fetchSignages();
  };

  const handleAddMaterial = async () => {
    if (!newMaterial.name || !newMaterial.price) {
      setToastMessage("Material name & price are required.");
      return;
    }

    const { error } = await supabase.from("materials").insert({
      name: newMaterial.name,
      price: newMaterial.price,
      pricing_type: newMaterial.pricing_type || "unit",
    });

    if (!error) {
      setToastMessage("Material added.");
      fetchMaterials();
      setShowMaterialModal(false);
      setNewMaterial({});
    }
  };

  useEffect(() => {
    if (!showSignageModal) {
      setSelectedSignage({});
      setLinkedMaterials([]);
    }
  }, [showSignageModal]);

  useEffect(() => {
    if (!showMaterialModal) setNewMaterial({});
  }, [showMaterialModal]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle className="ion-text-center">Signage Types</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonButton expand="block" onClick={() => setShowSignageModal(true)}>
          + Add Signage
        </IonButton>

        <IonList>
          {signages.map((s) => (
            <IonItem key={s.signage_id}>
              <IonLabel>
                <h2>{s.name}</h2>
                <p>{s.description}</p>
                <p>
                  Base Price: R
                  {(s.calculatedBasePrice ?? s.base_price_per_sqm).toFixed(2)}
                </p>
              </IonLabel>
              <IonButton
                size="small"
                onClick={() => {
                  setSelectedSignage(s);
                  fetchLinkedMaterials(s.signage_id);
                  setShowSignageModal(true);
                }}
              >
                Edit
              </IonButton>
              <IonButton
                color="danger"
                size="small"
                onClick={() => handleDeleteSignage(s.signage_id)}
              >
                Delete
              </IonButton>
            </IonItem>
          ))}
        </IonList>

        {/* Signage Modal */}
        <IonModal
          isOpen={showSignageModal}
          onDidDismiss={() => setShowSignageModal(false)}
        >
          <IonHeader>
            <IonToolbar>
              <IonTitle>
                {selectedSignage.signage_id ? "Edit Signage" : "Add Signage"}
              </IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonInput
              placeholder="Name"
              value={selectedSignage.name || ""}
              onIonChange={(e) =>
                setSelectedSignage({
                  ...selectedSignage,
                  name: e.detail.value!,
                })
              }
            />
            <IonInput
              placeholder="Description"
              value={selectedSignage.description || ""}
              onIonChange={(e) =>
                setSelectedSignage({
                  ...selectedSignage,
                  description: e.detail.value!,
                })
              }
            />

            {/* Linked Materials */}
            {selectedSignage.signage_id && (
              <>
                <h3
                  style={{
                    marginTop: 16,
                    marginBottom: 8,
                    fontSize: "1.05rem",
                    fontWeight: 600,
                  }}
                >
                  Linked Materials
                </h3>

                <IonList style={{ margin: 0 }}>
                  {linkedMaterials.length > 0 ? (
                    linkedMaterials.map((m) => (
                      <IonItem
                        key={m.material_id}
                        lines="none"
                        style={{
                          borderRadius: 8,
                          marginBottom: 12,
                          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                          padding: "8px 12px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            width: "100%",
                            gap: 6,
                          }}
                        >
                          {/* Top row: name + price */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <IonLabel>
                              <h2
                                style={{
                                  fontSize: "0.95rem",
                                  margin: 0,
                                  fontWeight: 600,
                                }}
                              >
                                {m.name}
                              </h2>
                              <p
                                style={{
                                  margin: "2px 0 0",
                                  fontSize: "0.8rem",
                                  opacity: 0.7,
                                }}
                              >
                                R{m.price} • Qty: {m.quantity_required}
                              </p>
                            </IonLabel>
                          </div>

                          {/* Middle row: toggle */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginTop: 4,
                            }}
                          >
                            <span
                              style={{
                                fontSize: "0.8rem",
                                opacity: 0.75,
                              }}
                            >
                              Scale with area
                            </span>
                            <IonToggle
                              checked={m.scale_with_area}
                              onIonChange={(e) =>
                                handleToggleScaleWithArea(
                                  m.material_id,
                                  e.detail.checked
                                )
                              }
                            />
                          </div>

                          {/* Bottom row: actions */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "flex-end",
                              gap: 8,
                              marginTop: 6,
                            }}
                          >
                            <IonButton
                              color="medium"
                              size="small"
                              fill="outline"
                              style={{ "--border-radius": "999px" } as any}
                              onClick={() => {
                                setEditMaterialId(m.material_id);
                                setEditQty(m.quantity_required);
                                setShowEditAlert(true);
                              }}
                            >
                              Edit
                            </IonButton>
                            <IonButton
                              color="danger"
                              size="small"
                              fill="solid"
                              style={{ "--border-radius": "999px" } as any}
                              onClick={() => handleRemoveMaterial(m.material_id)}
                            >
                              Remove
                            </IonButton>
                          </div>
                        </div>
                      </IonItem>
                    ))
                  ) : (
                    <IonItem lines="none">
                      <IonLabel>No materials linked yet.</IonLabel>
                    </IonItem>
                  )}
                </IonList>

                {/* Add Materials */}
                <IonSelect
                  value={selectedMaterial}
                  placeholder="Select Material"
                  onIonChange={(e) => setSelectedMaterial(e.detail.value)}
                >
                  {materials.map((m) => (
                    <IonSelectOption key={m.material_id} value={m.material_id}>
                      {m.name} (R{m.price})
                    </IonSelectOption>
                  ))}
                </IonSelect>

                <IonInput
                  type="number"
                  placeholder="Quantity"
                  value={materialQty}
                  onIonChange={(e) =>
                    setMaterialQty(parseInt(e.detail.value!) || 1)
                  }
                />

                <IonButton
                  expand="block"
                  onClick={handleAddMaterialToSignage}
                >
                  Link Material
                </IonButton>

                <IonButton
                  expand="block"
                  color="secondary"
                  onClick={() => setShowMaterialModal(true)}
                >
                  + Add New Material
                </IonButton>
              </>
            )}

            <IonButton expand="full" onClick={handleSaveSignage}>
              Save
            </IonButton>
            <IonButton
              expand="full"
              color="light"
              onClick={() => setShowSignageModal(false)}
            >
              Cancel
            </IonButton>
          </IonContent>
        </IonModal>

        {/* Edit Quantity Alert */}
        <IonAlert
          isOpen={showEditAlert}
          onDidDismiss={() => setShowEditAlert(false)}
          header="Edit Quantity"
          inputs={[
            {
              name: "quantity",
              type: "number",
              value: editQty,
              placeholder: "Enter new quantity",
            },
          ]}
          buttons={[
            {
              text: "Cancel",
              role: "cancel",
              handler: () => {
                setShowEditAlert(false);
                setEditMaterialId(null);
              },
            },
            {
              text: "Save",
              handler: (data) => {
                const qty = parseInt(data.quantity) || 1;
                setEditQty(qty);
                handleUpdateMaterialQty();
              },
            },
          ]}
        />

        {/* New Material Modal */}
        <IonModal
          isOpen={showMaterialModal}
          onDidDismiss={() => setShowMaterialModal(false)}
        >
          <IonHeader>
            <IonToolbar>
              <IonTitle>Add Material</IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonInput
              placeholder="Material Name"
              value={newMaterial.name || ""}
              onIonChange={(e) =>
                setNewMaterial({ ...newMaterial, name: e.detail.value! })
              }
            />
            <IonInput
              placeholder="Price"
              type="number"
              value={newMaterial.price || ""}
              onIonChange={(e) =>
                setNewMaterial({
                  ...newMaterial,
                  price: parseFloat(e.detail.value!) || 0,
                })
              }
            />
            <IonSelect
              value={newMaterial.pricing_type || "unit"}
              placeholder="Select Pricing Type"
              onIonChange={(e) =>
                setNewMaterial({
                  ...newMaterial,
                  pricing_type: e.detail.value!,
                })
              }
            >
              <IonSelectOption value="unit">Per Unit</IonSelectOption>
              <IonSelectOption value="sqm">Per SQM</IonSelectOption>
            </IonSelect>

            <IonButton expand="full" onClick={handleAddMaterial}>
              Save
            </IonButton>
            <IonButton
              expand="full"
              color="light"
              onClick={() => setShowMaterialModal(false)}
            >
              Cancel
            </IonButton>
          </IonContent>
        </IonModal>

        <IonToast
          isOpen={!!toastMessage}
          message={toastMessage}
          duration={2000}
          onDidDismiss={() => setToastMessage("")}
        />
      </IonContent>
    </IonPage>
  );
}
