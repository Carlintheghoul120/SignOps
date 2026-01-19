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
  {/* HEADER */}
  <IonHeader>
    <IonToolbar color="primary">
      <IonButtons slot="start">
        <IonMenuButton />
      </IonButtons>

      <IonTitle>Signage Types</IonTitle>

      <IonButtons slot="end">
        <IonButton onClick={() => setShowSignageModal(true)}>
          + Add
        </IonButton>
      </IonButtons>
    </IonToolbar>
  </IonHeader>

  <IonContent className="ion-padding">

    {/* LIST */}
    <IonList>
      {signages.map((s) => (
        <IonItem
          key={s.signage_id}
          style={{
            marginBottom: "10px",
            borderRadius: "10px",
            border: "1px solid #dcdcdc",
            padding: "10px",
          }}
        >
          <IonLabel className="ion-text-wrap">
            <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>
              {s.name}
            </h2>

            <p style={{ fontSize: "0.9rem", marginTop: "2px" }}>
              {(s.calculatedBasePrice ?? s.base_price_per_sqm).toFixed(2)} / sqm
            </p>

            <p style={{ fontSize: "0.85rem", opacity: 0.6 }}>
              {s.description || "No description"}
            </p>
          </IonLabel>

          <IonButton
            fill="clear"
            color="medium"
            onClick={() => {
              setSelectedSignage(s);
              fetchLinkedMaterials(s.signage_id);
              setShowSignageModal(true);
            }}
          >
            Edit
          </IonButton>

          <IonButton
            fill="clear"
            color="danger"
            onClick={() => handleDeleteSignage(s.signage_id)}
          >
            Delete
          </IonButton>
        </IonItem>
      ))}

      {signages.length === 0 && (
        <IonItem>
          <IonLabel>No signage types found.</IonLabel>
        </IonItem>
      )}
    </IonList>
  </IonContent>

  {/* SIGNAGE MODAL */}
  <IonModal isOpen={showSignageModal} onDidDismiss={() => setShowSignageModal(false)}>
    <IonHeader>
      <IonToolbar>
        <IonTitle>
          {selectedSignage.signage_id ? "Edit Signage" : "Add Signage"}
        </IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent className="ion-padding">
      <IonInput
        label="Name"
        fill="outline"
        labelPlacement="floating"
        style={{ marginBottom: "12px" }}
        value={selectedSignage.name || ""}
        onIonChange={(e) =>
          setSelectedSignage({ ...selectedSignage, name: e.detail.value! })
        }
      />

      <IonInput
        label="Description"
        fill="outline"
        labelPlacement="floating"
        style={{ marginBottom: "12px" }}
        value={selectedSignage.description || ""}
        onIonChange={(e) =>
          setSelectedSignage({ ...selectedSignage, description: e.detail.value! })
        }
      />

      {/* LINKED MATERIALS */}
      {selectedSignage.signage_id && (
        <>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 8 }}>
            Linked Materials
          </h3>

          <IonList>
            {linkedMaterials.map((m) => (
              <IonItem
                key={m.material_id}
                style={{
                  marginBottom: "10px",
                  borderRadius: "10px",
                  border: "1px solid #e0e0e0",
                  padding: "10px",
                }}
              >
                <IonLabel className="ion-text-wrap">
                  <h2 style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                    {m.name}
                  </h2>

                  <p style={{ fontSize: "0.85rem", opacity: 0.7 }}>
                    R{m.price} • Qty {m.quantity_required}
                  </p>

                  <p style={{ fontSize: "0.8rem", opacity: 0.6 }}>
                    Scale with area
                  </p>
                </IonLabel>

                <IonToggle
                  checked={m.scale_with_area}
                  onIonChange={(e) =>
                    handleToggleScaleWithArea(m.material_id, e.detail.checked)
                  }
                />

                <IonButton
                  fill="clear"
                  color="danger"
                  onClick={() => handleRemoveMaterial(m.material_id)}
                >
                  Remove
                </IonButton>
              </IonItem>
            ))}

            {linkedMaterials.length === 0 && (
              <IonItem>
                <IonLabel>No materials linked.</IonLabel>
              </IonItem>
            )}
          </IonList>

          {/* ADD MATERIAL */}
          <IonSelect
            fill="outline"
            placeholder="Select Material"
            style={{ marginBottom: "12px" }}
            value={selectedMaterial}
            onIonChange={(e) => setSelectedMaterial(e.detail.value)}
          >
            {materials.map((m) => (
              <IonSelectOption key={m.material_id} value={m.material_id}>
                {m.name} (R{m.price})
              </IonSelectOption>
            ))}
          </IonSelect>

          <IonInput
            label="Quantity"
            type="number"
            fill="outline"
            labelPlacement="floating"
            style={{ marginBottom: "12px" }}
            value={materialQty}
            onIonChange={(e) =>
              setMaterialQty(parseInt(e.detail.value!) || 1)
            }
          />

          <IonButton expand="block" onClick={handleAddMaterialToSignage}>
            Link Material
          </IonButton>

          <IonButton
            expand="block"
            color="light"
            onClick={() => setShowMaterialModal(true)}
            style={{ marginTop: "8px" }}
          >
            + Add New Material
          </IonButton>
        </>
      )}

      <IonButton expand="block" onClick={handleSaveSignage} style={{ marginTop: "12px" }}>
        Save
      </IonButton>

      <IonButton
        expand="block"
        color="light"
        onClick={() => setShowSignageModal(false)}
        style={{ marginTop: "8px" }}
      >
        Cancel
      </IonButton>
    </IonContent>
  </IonModal>

  <IonToast
    isOpen={!!toastMessage}
    message={toastMessage}
    duration={1500}
    onDidDismiss={() => setToastMessage("")}
  />
</IonPage>

  );
}
