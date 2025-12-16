import React, { useEffect, useState, useMemo } from "react";
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
  IonToggle,
} from "@ionic/react";
import {
  addOutline,
  refreshOutline,
  createOutline,
  trashBinOutline,
  chevronBack,
  chevronForward,
} from "ionicons/icons";

import { supabase } from "../../supbaseclient.tsx";

interface Material {
  material_id: number;
  name: string;
  price: number | null;
  pricing_type: string | null;
  is_outdoor: boolean;
}

const pricingOptions = ["sqm", "unit", "kg", "m", "hour", "fixed"];

const AdminMaterials: React.FC = () => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [currentMaterial, setCurrentMaterial] = useState<Partial<Material>>({});
  const [showModal, setShowModal] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string | "">("");

  const [page, setPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    const { data, error } = await supabase
      .from("materials")
      .select("*")
      .order("name");
    if (error) {
      console.error("Error fetching:", error);
      return;
    }
    setMaterials(data as Material[]);
  };

  const openNewMaterial = () => {
    setCurrentMaterial({});
    setShowModal(true);
  };

  const handleSave = async () => {
    const isEdit = !!currentMaterial.material_id;
    const { name, price, pricing_type, is_outdoor } = currentMaterial;

    if (!name) {
      setToastMessage("Material name is required.");
      return;
    }

    const payload: Partial<Material> = {
      name,
      price: price ?? null,
      pricing_type: pricing_type ?? null,
      is_outdoor: is_outdoor ?? false,
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

  // ---------------------------------------------------
  // FILTER + SEARCH + PAGINATION
  // ---------------------------------------------------
  const filtered = useMemo(() => {
    return materials
      .filter((m) =>
        search.trim().length === 0
          ? true
          : m.name.toLowerCase().includes(search.toLowerCase())
      )
      .filter((m) => (filterType ? m.pricing_type === filterType : true));
  }, [materials, search, filterType]);

  const totalPages = Math.ceil(filtered.length / pageSize);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  const resetPagination = () => setPage(1);

  return (
    <IonPage>
      {/* HEADER */}
      <IonHeader>
        <IonToolbar color="primary">
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>

          <IonTitle>Materials</IonTitle>

          <IonButtons slot="end">
            <IonButton onClick={fetchMaterials}>
              <IonIcon icon={refreshOutline} />
            </IonButton>

            <IonButton onClick={openNewMaterial}>
              <IonIcon icon={addOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">

        {/* SEARCH */}
        <IonInput
          placeholder="Search materials..."
          value={search}
          onIonChange={(e) => {
            setSearch(e.detail.value || "");
            resetPagination();
          }}
          style={{
            marginBottom: "12px",
            border: "1px solid #dcdcdc",
            borderRadius: "8px",
            padding: "8px",
          }}
        />

        {/* FILTER */}
        <IonSelect
          placeholder="Filter by pricing type"
          value={filterType}
          onIonChange={(e) => {
            setFilterType(e.detail.value);
            resetPagination();
          }}
          style={{
            marginBottom: "12px",
            border: "1px solid #dcdcdc",
            borderRadius: "8px",
          }}
        >
          <IonSelectOption value="">All Types</IonSelectOption>
          {pricingOptions.map((opt) => (
            <IonSelectOption key={opt} value={opt}>
              {opt}
            </IonSelectOption>
          ))}
        </IonSelect>

        {/* LIST */}
        <IonList>
          {paginated.map((m) => (
            <IonItem
              key={m.material_id}
              style={{
                marginBottom: "10px",
                borderRadius: "10px",
                border: "1px solid #dcdcdc",
                padding: "10px",
              }}
            >
              <IonLabel className="ion-text-wrap">
                <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>{m.name}</h2>

                <p style={{ fontSize: "0.9rem", marginTop: "2px" }}>
                  {m.price !== null ? `R${m.price.toFixed(2)}` : "—"}{" "}
                  {m.pricing_type ? `/ ${m.pricing_type}` : ""}
                </p>

                <p style={{ fontSize: "0.85rem", opacity: 0.6 }}>
                  {m.is_outdoor ? "Outdoor" : "Indoor"}
                </p>
              </IonLabel>

              <IonButton
                fill="clear"
                color="medium"
                onClick={() => {
                  setCurrentMaterial(m);
                  setShowModal(true);
                }}
              >
                <IonIcon icon={createOutline} />
              </IonButton>

              <IonButton
                fill="clear"
                color="danger"
                onClick={() => handleDelete(m.material_id)}
              >
                <IonIcon icon={trashBinOutline} />
              </IonButton>
            </IonItem>
          ))}

          {filtered.length === 0 && (
            <IonItem>
              <IonLabel>No materials found.</IonLabel>
            </IonItem>
          )}
        </IonList>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div
            style={{
              marginTop: "20px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <IonButton
              fill="outline"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <IonIcon icon={chevronBack} />
            </IonButton>

            <span>
              Page {page} of {totalPages}
            </span>

            <IonButton
              fill="outline"
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              <IonIcon icon={chevronForward} />
            </IonButton>
          </div>
        )}
      </IonContent>

      {/* MODAL */}
      <IonModal isOpen={showModal} onDidDismiss={() => setShowModal(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>
              {currentMaterial.material_id ? "Edit Material" : "Add Material"}
            </IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonContent className="ion-padding">

          <IonInput
            label="Material Name"
            fill="outline"
            labelPlacement="floating"
            style={{ marginBottom: "12px" }}
            value={currentMaterial.name || ""}
            onIonChange={(e) =>
              setCurrentMaterial({ ...currentMaterial, name: e.detail.value! })
            }
          />

          <IonInput
            label="Price"
            type="number"
            fill="outline"
            labelPlacement="floating"
            style={{ marginBottom: "12px" }}
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
            style={{ marginBottom: "12px" }}
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

          <IonItem style={{ marginBottom: "12px" }}>
            <IonLabel>Outdoor?</IonLabel>
            <IonToggle
              checked={currentMaterial.is_outdoor ?? false}
              onIonChange={(e) =>
                setCurrentMaterial({ ...currentMaterial, is_outdoor: e.detail.checked })
              }
            />
          </IonItem>

          <IonButton expand="block" onClick={handleSave} style={{ marginTop: "12px" }}>
            Save
          </IonButton>

          <IonButton
            expand="block"
            color="light"
            onClick={() => {
              setShowModal(false);
              setCurrentMaterial({});
            }}
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
};

export default AdminMaterials;
