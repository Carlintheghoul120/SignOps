import React, { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonSelect,
  IonSelectOption, IonInput, IonLabel, IonList, IonItem, IonCheckbox,
  IonButton, IonText
} from '@ionic/react';
import { supabase } from '../../supbaseclient';

interface SignageType {
  signage_id: number;
  name: string;
  base_price_per_sqm: number;
}

interface Material {
  material_id: number;
  name: string;
  price_per_sqm: number;
  signage_id: number;
}

interface Addon {
  addon_id: number;
  name: string;
  is_flat: boolean;
  flat_rate?: number;
  per_sqm_rate?: number;
}

const UserQuoteBuilder: React.FC = () => {
  const [signages, setSignages] = useState<SignageType[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);

  const [selectedSignage, setSelectedSignage] = useState<number>();
  const [selectedMaterial, setSelectedMaterial] = useState<number>();
  const [selectedAddons, setSelectedAddons] = useState<number[]>([]);

  const [width, setWidth] = useState<number>(1);
  const [height, setHeight] = useState<number>(1);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    const [sigs, mats, adds] = await Promise.all([
      supabase.from('signage_types').select('*'),
      supabase.from('materials').select('*'),
      supabase.from('addons').select('*')
    ]);
    if (sigs.data) setSignages(sigs.data);
    if (mats.data) setMaterials(mats.data);
    if (adds.data) setAddons(adds.data);
  };

  const calculateTotal = () => {
    if (!selectedSignage || !selectedMaterial) return 0;
    const signage = signages.find(s => s.signage_id === selectedSignage);
    const material = materials.find(m => m.material_id === selectedMaterial);
    const area = width * height;

    let base = (signage?.base_price_per_sqm ?? 0) * area;
    let materialCost = (material?.price_per_sqm ?? 0) * area;
    let addonTotal = 0;

    selectedAddons.forEach(id => {
      const addon = addons.find(a => a.addon_id === id);
      if (!addon) return;
      addonTotal += addon.is_flat
        ? addon.flat_rate ?? 0
        : (addon.per_sqm_rate ?? 0) * area;
    });

    return base + materialCost + addonTotal;
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Quote Builder</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonLabel>Signage Type</IonLabel>
        <IonSelect
          placeholder="Select Signage"
          value={selectedSignage}
          onIonChange={e => {
            setSelectedSignage(e.detail.value);
            setSelectedMaterial(undefined);
          }}
        >
          {signages.map(s => (
            <IonSelectOption key={s.signage_id} value={s.signage_id}>
              {s.name}
            </IonSelectOption>
          ))}
        </IonSelect>

        <IonLabel>Material</IonLabel>
        <IonSelect
          placeholder="Select Material"
          value={selectedMaterial}
          onIonChange={e => setSelectedMaterial(e.detail.value)}
        >
          {materials
            .filter(m => m.signage_id === selectedSignage)
            .map(m => (
              <IonSelectOption key={m.material_id} value={m.material_id}>
                {m.name}
              </IonSelectOption>
            ))}
        </IonSelect>

        <IonLabel>Width (m)</IonLabel>
        <IonInput
          type="number"
          value={width}
          onIonChange={e => setWidth(parseFloat(e.detail.value!) || 0)}
        />

        <IonLabel>Height (m)</IonLabel>
        <IonInput
          type="number"
          value={height}
          onIonChange={e => setHeight(parseFloat(e.detail.value!) || 0)}
        />

        <IonLabel>Optional Add-ons</IonLabel>
        <IonList>
          {addons.map(a => (
            <IonItem key={a.addon_id}>
              <IonLabel>
                {a.name}{' '}
                <IonText color="medium">
                  ({a.is_flat
                    ? `R${a.flat_rate?.toFixed(2)}`
                    : `R${a.per_sqm_rate?.toFixed(2)} per sqm`})
                </IonText>
              </IonLabel>
              <IonCheckbox
                slot="end"
                checked={selectedAddons.includes(a.addon_id)}
                onIonChange={e => {
                  if (e.detail.checked) {
                    setSelectedAddons([...selectedAddons, a.addon_id]);
                  } else {
                    setSelectedAddons(selectedAddons.filter(id => id !== a.addon_id));
                  }
                }}
              />
            </IonItem>
          ))}
        </IonList>

        <IonText color="primary">
          <h2>Total Cost: R{calculateTotal().toFixed(2)}</h2>
        </IonText>

        <IonButton expand="full" onClick={() => alert('Quote saved/submitted soon')}>
          Submit Quote
        </IonButton>
      </IonContent>
    </IonPage>
  );
};

export default UserQuoteBuilder;
