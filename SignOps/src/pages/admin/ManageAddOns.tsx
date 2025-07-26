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
      <IonHeader>
        <IonToolbar color="primary">
					 <IonButtons slot="start">
					<IonMenuButton />
				  </IonButtons>
          <IonTitle>Admin: Add-ons</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setShowModal(true)}>Add Addon</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {addons.length === 0 && (
          <IonText color="medium">
            <p className="ion-text-center">No add-ons found.</p>
          </IonText>
        )}
        <IonList>
          {addons.map((a) => (
            <IonCard key={a.addon_id}>
              <IonCardHeader>
                <IonCardTitle>{a.name}</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <IonText color="medium">
                  <p>{a.description}</p>
                  <p>
                    {a.is_flat
                      ? `Flat Rate: R${a.flat_rate?.toFixed(2)}`
                      : `Per sqm: R${a.per_sqm_rate?.toFixed(2)}`}
                  </p>
                </IonText>
                <div className="ion-margin-top ion-text-right">
                  <IonButton
                    size="small"
                    fill="outline"
                    color="medium"
                    onClick={() => {
                      setCurrentAddon(a);
                      setShowModal(true);
                    }}
                  >
                    <IonIcon icon={createOutline} slot="start" />
                    Edit
                  </IonButton>
                  <IonButton
                    size="small"
                    fill="outline"
                    color="danger"
                    onClick={() => handleDelete(a.addon_id)}
                    className="ion-margin-start"
                  >
                    <IonIcon icon={trashOutline} slot="start" />
                    Delete
                  </IonButton>
                </div>
              </IonCardContent>
            </IonCard>
          ))}
        </IonList>
      </IonContent>

      {/* Modal for Create/Edit */}
      <IonModal isOpen={showModal} onDidDismiss={() => setShowModal(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>{currentAddon.addon_id ? 'Edit' : 'Add'} Addon</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <IonItemDivider>Details</IonItemDivider>
          <IonInput
            label="Addon Name"
            placeholder="Enter name"
            value={currentAddon.name}
            onIonChange={e => setCurrentAddon({ ...currentAddon, name: e.detail.value! })}
          />
          <IonInput
            label="Description"
            placeholder="Enter description"
            value={currentAddon.description}
            onIonChange={e => setCurrentAddon({ ...currentAddon, description: e.detail.value! })}
          />

          <IonItem lines="none" className="ion-margin-top">
            <IonLabel>Flat Rate?</IonLabel>
            <IonToggle
              checked={currentAddon.is_flat ?? true}
              onIonChange={e => setCurrentAddon({ ...currentAddon, is_flat: e.detail.checked })}
            />
          </IonItem>

          {currentAddon.is_flat ? (
            <IonInput
              label="Flat Rate (R)"
              type="number"
              placeholder="e.g. 500"
              value={currentAddon.flat_rate}
              onIonChange={e =>
                setCurrentAddon({ ...currentAddon, flat_rate: parseFloat(e.detail.value!) })
              }
            />
          ) : (
            <IonInput
              label="Rate per sqm (R)"
              type="number"
              placeholder="e.g. 150"
              value={currentAddon.per_sqm_rate}
              onIonChange={e =>
                setCurrentAddon({ ...currentAddon, per_sqm_rate: parseFloat(e.detail.value!) })
              }
            />
          )}

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
        onDidDismiss={() => setToastMessage('')}
        message={toastMessage}
        duration={1500}
      />
    </IonPage>
  );
};

export default AdminAddons;
