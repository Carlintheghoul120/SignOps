import React, { useEffect, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonModal,
  IonToast,
  IonSelect,
  IonSelectOption,
  IonButtons,
  IonMenuButton,
  IonIcon,
  IonFab,
  IonFabButton,
} from "@ionic/react";
import { addOutline, createOutline, trashBinOutline } from "ionicons/icons";
import { supabase } from "../../supbaseclient";

interface Material {
  material_id: number;
  name: string;
  price: number | null;
  pricing_type: string | null;
}

const pricingOptions = ["sqm", "unit", "kg", "m", "hour", "fixed"];

const AdminMaterials: React.FC = () => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [currentMaterial, setCurrentMaterial] = useState<Partial<Material>>({});
  const [showModal, setShowModal] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    const { data, error } = await supabase.from("materials").select("*");
    if (error) {
      console.error("Error fetching:", error);
      return;
    }
    if (data) setMaterials(data as Material[]);
  };

  const handleSave = async () => {
    const isEdit = !!currentMaterial.material_id;
    const { name, price, pricing_type } = currentMaterial;

    if (!name) {
      setToastMessage("Material name is required.");
      return;
    }

    const payload: Partial<Material> = {
      name,
      price: price ?? null,
      pricing_type: pricing_type ?? null,
    };

    const { error } = isEdit
      ? await supabase
          .from("materials")
          .update(payload)
          .eq("material_id", currentMaterial.material_id!)
      : await supabase.from("materials").insert(payload);

    if (error) {
      console.error("Save error:", error);
      setToastMessage("Error saving material.");
      return;
    }

    setToastMessage(isEdit ? "Material updated." : "Material added.");
    setShowModal(false);
    setCurrentMaterial({});
    fetchMaterials();
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from("materials").delete().eq("material_id", id);
    if (!error) {
      setToastMessage("Material deleted.");
      fetchMaterials();
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle>Materials</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonList>
          {materials.map((m) => (
            <IonItem key={m.material_id} button onClick={() => {
              setCurrentMaterial(m);
              setShowModal(true);
            }}>
              <IonLabel className="ion-text-wrap">
                <h2 className="font-medium">{m.name}</h2>
                <p>
                  {m.price !== null ? `R${m.price.toFixed(2)}` : "—"}{" "}
                  {m.pricing_type ? `/ ${m.pricing_type}` : ""}
                </p>
              </IonLabel>

              <IonButton
                fill="clear"
                color="medium"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentMaterial(m);
                  setShowModal(true);
                }}
              >
                <IonIcon slot="icon-only" icon={createOutline} />
              </IonButton>
              <IonButton
                fill="clear"
                color="danger"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(m.material_id);
                }}
              >
                <IonIcon slot="icon-only" icon={trashBinOutline} />
              </IonButton>
            </IonItem>
          ))}
        </IonList>

        {/* FAB Button */}
        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={() => setShowModal(true)}>
            <IonIcon icon={addOutline} />
          </IonFabButton>
        </IonFab>
      </IonContent>

      {/* Modal */}
      <IonModal isOpen={showModal} onDidDismiss={() => setShowModal(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>
              {currentMaterial.material_id ? "Edit" : "Add"} Material
            </IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <IonInput
            label="Material Name"
            labelPlacement="floating"
            fill="outline"
            value={currentMaterial.name || ""}
            onIonChange={(e) =>
              setCurrentMaterial({ ...currentMaterial, name: e.detail.value! })
            }
          />
          <IonInput
            label="Price"
            labelPlacement="floating"
            type="number"
            fill="outline"
            value={currentMaterial.price ?? ""}
            onIonChange={(e) =>
              setCurrentMaterial({
                ...currentMaterial,
                price: e.detail.value ? parseFloat(e.detail.value) : null,
              })
            }
          />
          <IonSelect
            label="Pricing Type"
            labelPlacement="floating"
            fill="outline"
            value={currentMaterial.pricing_type || ""}
            onIonChange={(e) =>
              setCurrentMaterial({ ...currentMaterial, pricing_type: e.detail.value })
            }
          >
            {pricingOptions.map((opt) => (
              <IonSelectOption key={opt} value={opt}>
                {opt}
              </IonSelectOption>
            ))}
          </IonSelect>

          <IonButton expand="block" className="ion-margin-top" onClick={handleSave}>
            Save
          </IonButton>
          <IonButton
            expand="block"
            color="light"
            className="ion-margin-top"
            onClick={() => setShowModal(false)}
          >
            Cancel
          </IonButton>
        </IonContent>
      </IonModal>

      <IonToast
        isOpen={!!toastMessage}
        onDidDismiss={() => setToastMessage("")}
        message={toastMessage}
        duration={1500}
      />
    </IonPage>
  );
};

export default AdminMaterials;
