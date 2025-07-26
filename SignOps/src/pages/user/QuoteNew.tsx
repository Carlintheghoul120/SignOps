import React, { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonSelect,
  IonSelectOption, IonInput, IonLabel, IonList, IonItem, IonCheckbox,
  IonButton, IonText, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonGrid, IonRow, IonCol
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
  const [submitting, setSubmitting] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
    getUser();
  }, []);

  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
  };

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

  const handleSubmitQuote = async () => {
    if (!userId || !selectedSignage || !selectedMaterial) {
      alert("Missing required fields.");
      return;
    }

    setSubmitting(true);
    const totalCost = calculateTotal();
    const { data, error } = await supabase
      .from('quotes')
      .insert({
        user_id: userId,
        signage_id: selectedSignage,
        material_id: selectedMaterial,
        width,
        height,
        total_cost: totalCost
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      alert("Error submitting quote.");
      setSubmitting(false);
      return;
    }

    const quoteId = data.quote_id;
    if (selectedAddons.length > 0) {
      const addonInserts = selectedAddons.map(addon_id => ({ quote_id: quoteId, addon_id }));
      await supabase.from('quote_addons').insert(addonInserts);
    }

    alert("Quote submitted!");
    setSubmitting(false);
  };

  const area = width * height;
  const total = calculateTotal();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle className="ion-text-center">Quote Builder</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonGrid fixed>
          <IonRow className="ion-justify-content-center">
            <IonCol sizeMd="8" sizeLg="6">
              <IonCard className="ion-padding">
                <IonCardHeader>
                  <IonCardTitle className="ion-text-center">Configuration</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <IonItem>
                    <IonLabel position="stacked">Signage Type</IonLabel>
                    <IonSelect
                      value={selectedSignage}
                      placeholder="Select Signage"
                      onIonChange={e => {
                        setSelectedSignage(e.detail.value);
                        setSelectedMaterial(undefined);
                      }}>
                      {signages.map(s => (
                        <IonSelectOption key={s.signage_id} value={s.signage_id}>{s.name}</IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>

                  <IonItem>
                    <IonLabel position="stacked">Material</IonLabel>
                    <IonSelect
                      value={selectedMaterial}
                      placeholder="Select Material"
                      onIonChange={e => setSelectedMaterial(e.detail.value)}>
                      {materials.filter(m => m.signage_id === selectedSignage).map(m => (
                        <IonSelectOption key={m.material_id} value={m.material_id}>{m.name}</IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>

                  <IonItem>
                    <IonLabel position="stacked">Width (m)</IonLabel>
                    <IonInput type="number" value={width} onIonChange={e => setWidth(parseFloat(e.detail.value!) || 0)} />
                  </IonItem>

                  <IonItem>
                    <IonLabel position="stacked">Height (m)</IonLabel>
                    <IonInput type="number" value={height} onIonChange={e => setHeight(parseFloat(e.detail.value!) || 0)} />
                  </IonItem>
                </IonCardContent>
              </IonCard>

              <IonCard className="ion-padding">
                <IonCardHeader>
                  <IonCardTitle className="ion-text-center">Optional Add-ons</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <IonList>
                    {addons.map(a => (
                      <IonItem key={a.addon_id}>
                        <IonLabel>{a.name} <IonText color="medium">
                          ({a.is_flat ? `R${a.flat_rate?.toFixed(2)}` : `R${a.per_sqm_rate?.toFixed(2)} per sqm`})
                        </IonText></IonLabel>
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
                </IonCardContent>
              </IonCard>

              <IonCard className="ion-padding">
                <IonCardHeader>
                  <IonCardTitle className="ion-text-center">Quote Summary</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <IonItem>
                    <IonLabel>Area</IonLabel>
                    <IonLabel slot="end">{area.toFixed(2)} m²</IonLabel>
                  </IonItem>
                  <IonItem>
                    <IonLabel>Total Cost</IonLabel>
                    <IonLabel slot="end">R{total.toFixed(2)}</IonLabel>
                  </IonItem>
                </IonCardContent>
              </IonCard>

              <IonButton expand="block" disabled={submitting} onClick={handleSubmitQuote}>
                {submitting ? "Submitting..." : "Submit Quote"}
              </IonButton>
            </IonCol>
          </IonRow>
        </IonGrid>
      </IonContent>
    </IonPage>
  );
};

export default UserQuoteBuilder;
