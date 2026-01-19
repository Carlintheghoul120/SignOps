import React, { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem,
  IonLabel, IonInput, IonButton, IonModal, IonToast, IonToggle, IonButtons,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonIcon, IonText, IonItemDivider, IonMenuButton
} from '@ionic/react';
import { supabase } from '../../supbaseclient';
import { createOutline, trashOutline } from 'ionicons/icons';

interface Addon {
  addon_id: number;
  name: string;
  description?: string;
  flat_rate?: number;
  per_sqm_rate?: number;
  is_flat: boolean;
}

const AdminAddons: React.FC = () => {
  const [addons, setAddons] = useState<Addon[]>([]);
  const [currentAddon, setCurrentAddon] = useState<Partial<Addon>>({});
  const [showModal, setShowModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    fetchAddons();
  }, []);

  const fetchAddons = async () => {
    const { data, error } = await supabase.from('addons').select('*');
    if (data) setAddons(data);
    if (error) console.error(error.message);
  };

  const handleSave = async () => {
    const { name, description, flat_rate, per_sqm_rate, is_flat } = currentAddon;

    if (!name) {
      setToastMessage('Name is required.');
      return;
    }

    const payload = {
      name,
      description,
      flat_rate: is_flat ? flat_rate : null,
      per_sqm_rate: is_flat ? null : per_sqm_rate,
      is_flat: is_flat ?? true,
    };

    const isEdit = !!currentAddon.addon_id;

    const action = isEdit
      ? supabase.from('addons').update(payload).eq('addon_id', currentAddon.addon_id)
      : supabase.from('addons').insert(payload);

    const { error } = await action;
    if (!error) {
      setToastMessage(isEdit ? 'Addon updated.' : 'Addon added.');
      setShowModal(false);
      setCurrentAddon({});
      fetchAddons();
    }
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from('addons').delete().eq('addon_id', id);
    if (!error) {
      setToastMessage('Addon deleted.');
      fetchAddons();
    }
  };

  return (
    <IonPage>
  {/* HEADER */}
  <IonHeader>
    <IonToolbar color="primary">
      <IonButtons slot="start">
        <IonMenuButton />
      </IonButtons>

      <IonTitle>Add-ons</IonTitle>

      <IonButtons slot="end">
        <IonButton onClick={() => setShowModal(true)}>
          Add
        </IonButton>
      </IonButtons>
    </IonToolbar>
  </IonHeader>

  <IonContent className="ion-padding">
    <IonList>
      {addons.map((a) => (
        <IonItem
          key={a.addon_id}
          style={{
            marginBottom: "10px",
            borderRadius: "10px",
            border: "1px solid #dcdcdc",
            padding: "10px",
          }}
        >
          <IonLabel className="ion-text-wrap">
            <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>
              {a.name}
            </h2>

            {a.description && (
              <p style={{ fontSize: "0.85rem", opacity: 0.7, marginTop: 2 }}>
                {a.description}
              </p>
            )}

            <p style={{ fontSize: "0.9rem", marginTop: 4 }}>
              {a.is_flat
                ? `Flat Rate • R${a.flat_rate?.toFixed(2)}`
                : `Per sqm • R${a.per_sqm_rate?.toFixed(2)}`}
            </p>
          </IonLabel>

          <IonButton
            fill="clear"
            color="medium"
            onClick={() => {
              setCurrentAddon(a);
              setShowModal(true);
            }}
          >
            <IonIcon icon={createOutline} />
          </IonButton>

          <IonButton
            fill="clear"
            color="danger"
            onClick={() => handleDelete(a.addon_id)}
          >
            <IonIcon icon={trashOutline} />
          </IonButton>
        </IonItem>
      ))}

      {addons.length === 0 && (
        <IonItem>
          <IonLabel>No add-ons found.</IonLabel>
        </IonItem>
      )}
    </IonList>
  </IonContent>

  {/* MODAL */}
  <IonModal isOpen={showModal} onDidDismiss={() => setShowModal(false)}>
    <IonHeader>
      <IonToolbar>
        <IonTitle>
          {currentAddon.addon_id ? "Edit Add-on" : "Add Add-on"}
        </IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent className="ion-padding">
      <IonInput
        label="Add-on Name"
        fill="outline"
        labelPlacement="floating"
        style={{ marginBottom: "12px" }}
        value={currentAddon.name || ""}
        onIonChange={(e) =>
          setCurrentAddon({ ...currentAddon, name: e.detail.value! })
        }
      />

      <IonInput
        label="Description"
        fill="outline"
        labelPlacement="floating"
        style={{ marginBottom: "12px" }}
        value={currentAddon.description || ""}
        onIonChange={(e) =>
          setCurrentAddon({ ...currentAddon, description: e.detail.value! })
        }
      />

      <IonItem style={{ marginBottom: "12px" }}>
        <IonLabel>Flat Rate?</IonLabel>
        <IonToggle
          checked={currentAddon.is_flat ?? true}
          onIonChange={(e) =>
            setCurrentAddon({ ...currentAddon, is_flat: e.detail.checked })
          }
        />
      </IonItem>

      {currentAddon.is_flat ? (
        <IonInput
          label="Flat Rate (R)"
          type="number"
          fill="outline"
          labelPlacement="floating"
          style={{ marginBottom: "12px" }}
          value={currentAddon.flat_rate ?? ""}
          onIonChange={(e) =>
            setCurrentAddon({
              ...currentAddon,
              flat_rate: parseFloat(e.detail.value!) || 0,
            })
          }
        />
      ) : (
        <IonInput
          label="Rate per sqm (R)"
          type="number"
          fill="outline"
          labelPlacement="floating"
          style={{ marginBottom: "12px" }}
          value={currentAddon.per_sqm_rate ?? ""}
          onIonChange={(e) =>
            setCurrentAddon({
              ...currentAddon,
              per_sqm_rate: parseFloat(e.detail.value!) || 0,
            })
          }
        />
      )}

      <IonButton expand="block" onClick={handleSave} style={{ marginTop: "12px" }}>
        Save
      </IonButton>

      <IonButton
        expand="block"
        color="light"
        onClick={() => {
          setShowModal(false);
          setCurrentAddon({});
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

export default AdminAddons;
