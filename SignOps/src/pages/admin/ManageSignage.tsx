import React, { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList,
  IonItem, IonLabel, IonInput, IonButton, IonModal, IonToast,
  IonButtons, IonMenuButton, IonSelect, IonSelectOption
} from '@ionic/react';
import { supabase } from '../../supbaseclient';

interface Signage {
  signage_id: number;
  name: string;
  description: string;
  base_price_per_sqm: number;
}

interface Material {
  material_id: number;
  name: string;
  price_per_sqm: number;
}

interface SignageMaterial {
  material_id: number;
  quantity_required: number;
}

const AdminSignage: React.FC = () => {
  const [signages, setSignages] = useState<Signage[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [currentSignage, setCurrentSignage] = useState<Partial<Signage>>({});
  const [selectedMaterials, setSelectedMaterials] = useState<SignageMaterial[]>([]);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    fetchSignages();
    fetchMaterials();
  }, []);

  const fetchSignages = async () => {
    const { data, error } = await supabase.from('signage_types').select('*');
    if (data) setSignages(data);
    if (error) console.error(error.message);
  };

  const fetchMaterials = async () => {
    const { data, error } = await supabase.from('materials').select('*');
    if (data) setMaterials(data);
    if (error) console.error(error.message);
  };

  const fetchSignageMaterials = async (signage_id: number) => {
    const { data, error } = await supabase
      .from('signage_materials')
      .select('*')
      .eq('signage_id', signage_id);
    if (data) setSelectedMaterials(data);
    if (error) console.error(error.message);
  };

  const handleSave = async () => {
    const isEdit = !!currentSignage.signage_id;
    const { name, description, base_price_per_sqm } = currentSignage;

    if (!name || base_price_per_sqm === undefined || isNaN(base_price_per_sqm)) {
      setToastMessage('Name and base price are required.');
      return;
    }

    if (isEdit) {
      const { error } = await supabase
        .from('signage_types')
        .update({ name, description, base_price_per_sqm })
        .eq('signage_id', currentSignage.signage_id);

      if (!error && currentSignage.signage_id) {
        await supabase.from('signage_materials').delete().eq('signage_id', currentSignage.signage_id);
        for (const m of selectedMaterials) {
          await supabase.from('signage_materials').insert({
            signage_id: currentSignage.signage_id,
            material_id: m.material_id,
            quantity_required: m.quantity_required
          });
        }
        setToastMessage('Signage updated.');
      }
    } else {
      const { data, error } = await supabase
        .from('signage_types')
        .insert({ name, description, base_price_per_sqm })
        .select()
        .single();

      if (!error && data) {
        for (const m of selectedMaterials) {
          await supabase.from('signage_materials').insert({
            signage_id: data.signage_id,
            material_id: m.material_id,
            quantity_required: m.quantity_required
          });
        }
        setToastMessage('Signage added.');
      }
    }

    setShowModal(false);
    setCurrentSignage({});
    setSelectedMaterials([]);
    fetchSignages();
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase
      .from('signage_types')
      .delete()
      .eq('signage_id', id);

    if (!error) {
      setToastMessage('Signage deleted.');
      fetchSignages();
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle className="ion-text-center">Admin: Signage Types</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => {
              setCurrentSignage({});
              setSelectedMaterials([]);
              setShowModal(true);
            }}>Add Signage</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonList>
          {signages.map(s => (
            <IonItem key={s.signage_id}>
              <IonLabel className="ion-text-wrap">
                <h2>{s.name}</h2>
                <p>{s.description}</p>
                <p>R{Number(s.base_price_per_sqm).toFixed(2)} / sqm</p>
              </IonLabel>
              <IonButton
                color="medium"
                slot="end"
                onClick={() => {
                  setCurrentSignage(s);
                  fetchSignageMaterials(s.signage_id);
                  setShowModal(true);
                }}
              >
                Edit
              </IonButton>
              <IonButton
                color="danger"
                slot="end"
                onClick={() => handleDelete(s.signage_id)}
              >
                Delete
              </IonButton>
            </IonItem>
          ))}
        </IonList>
      </IonContent>

      {/* Modal */}
      <IonModal isOpen={showModal} onDidDismiss={() => setShowModal(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>{currentSignage.signage_id ? 'Edit' : 'Add'} Signage</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <IonInput
            placeholder="Signage Name"
            value={currentSignage.name}
            onIonChange={e =>
              setCurrentSignage({ ...currentSignage, name: e.detail.value! })
            }
          />
          <IonInput
            placeholder="Description (optional)"
            value={currentSignage.description}
            onIonChange={e =>
              setCurrentSignage({ ...currentSignage, description: e.detail.value! })
            }
          />
          <IonInput
            placeholder="Base Price per sqm (R)"
            type="number"
            value={
              currentSignage.base_price_per_sqm !== undefined
                ? currentSignage.base_price_per_sqm
                : ''
            }
            onIonChange={e =>
              setCurrentSignage({
                ...currentSignage,
                base_price_per_sqm: parseFloat(e.detail.value!) || 0,
              })
            }
          />
          <h3>Materials & Quantities</h3>
          {materials.map(m => {
            const existing = selectedMaterials.find(sm => sm.material_id === m.material_id);
            return (
              <IonItem key={m.material_id}>
                <IonLabel>{m.name} (R{m.price_per_sqm}/sqm)</IonLabel>
                <IonInput
                  type="number"
                  placeholder="Qty"
                  value={existing?.quantity_required || ''}
                  onIonChange={e => {
                    const qty = parseFloat(e.detail.value!);
                    setSelectedMaterials(prev => {
                      const filtered = prev.filter(p => p.material_id !== m.material_id);
                      if (!isNaN(qty) && qty > 0) {
                        return [...filtered, { material_id: m.material_id, quantity_required: qty }];
                      }
                      return filtered;
                    });
                  }}
                />
              </IonItem>
            );
          })}
          <IonButton expand="full" onClick={handleSave}>Save</IonButton>
          <IonButton expand="full" color="light" onClick={() => setShowModal(false)}>Cancel</IonButton>
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

export default AdminSignage;
