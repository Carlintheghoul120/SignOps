import React, { useState, useEffect } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonInput, IonLabel, IonItem, IonButton, IonSelect, IonSelectOption,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonText, IonList,
  IonCheckbox, IonGrid, IonRow, IonCol, IonButtons, IonMenuButton, IonToast
} from '@ionic/react';
import { supabase } from '../../supbaseclient';

const UserQuoteBuilder: React.FC = () => {
  const [section, setSection] = useState(0);
  const [toastMsg, setToastMsg] = useState('');

  const [signages, setSignages] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [addons, setAddons] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // Form data
  const [form, setForm] = useState({
    company_name: '',
    contact_person: '',
    contact_address: '',
    signage_id: undefined as number | undefined,
    material_id: undefined as number | undefined,
    width: 1,
    height: 1,
    addon_ids: [] as number[],
  });

  useEffect(() => {
    fetchData();
    getUser();
  }, []);

  const fetchData = async () => {
    const [sigs, mats, adds] = await Promise.all([
      supabase.from('signage_types').select('*'),
      supabase.from('materials').select('*'),
      supabase.from('addons').select('*')
    ]);
    setSignages(sigs.data || []);
    setMaterials(mats.data || []);
    setAddons(adds.data || []);
  };

  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
  };

  const area = form.width * form.height;

  const calculateTotal = () => {
    const signage = signages.find(s => s.signage_id === form.signage_id);
    const material = materials.find(m => m.material_id === form.material_id);
    let base = (signage?.base_price_per_sqm ?? 0) * area;
    let materialCost = (material?.price_per_sqm ?? 0) * area;
    let addonTotal = 0;

    form.addon_ids.forEach(id => {
      const addon = addons.find(a => a.addon_id === id);
      if (!addon) return;
      addonTotal += addon.is_flat
        ? addon.flat_rate ?? 0
        : (addon.per_sqm_rate ?? 0) * area;
    });

    return base + materialCost + addonTotal;
  };

  const handleSubmit = async () => {
    if (!userId || !form.signage_id || !form.material_id) {
      setToastMsg('Missing required fields.');
      return;
    }

    const total_cost = calculateTotal();
    const { data, error } = await supabase.from('quotes').insert({
      user_id: userId,
      signage_id: form.signage_id,
      material_id: form.material_id,
      width: form.width,
      height: form.height,
      total_cost
    }).select().single();

    if (error) {
      setToastMsg('Failed to save quote.');
      return;
    }

    const quote_id = data.quote_id;
    if (form.addon_ids.length > 0) {
      await supabase.from('quote_addons').insert(
        form.addon_ids.map(id => ({ quote_id, addon_id: id }))
      );
    }

    setToastMsg('Quote submitted!');
    setSection(0);
    setForm({
      company_name: '',
      contact_person: '',
      contact_address: '',
      signage_id: undefined,
      material_id: undefined,
      width: 1,
      height: 1,
      addon_ids: []
    });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle className="ion-text-center">Quote Builder</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonGrid>
          <IonRow className="ion-justify-content-center">
            <IonCol sizeMd="8" sizeLg="6">
              <IonCard className="ion-padding">
                <IonCardHeader>
                  <IonCardTitle>Step {section + 1}</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>

                  {/* SECTION 0: Client Info */}
                  {section === 0 && (
                    <>
                      <IonItem>
                        <IonLabel position="stacked">Company Name</IonLabel>
                        <IonInput value={form.company_name} onIonChange={e => setForm({ ...form, company_name: e.detail.value! })} />
                      </IonItem>
                      <IonItem>
                        <IonLabel position="stacked">Contact Person</IonLabel>
                        <IonInput value={form.contact_person} onIonChange={e => setForm({ ...form, contact_person: e.detail.value! })} />
                      </IonItem>
                      <IonItem>
                        <IonLabel position="stacked">Contact Address</IonLabel>
                        <IonInput value={form.contact_address} onIonChange={e => setForm({ ...form, contact_address: e.detail.value! })} />
                      </IonItem>
                      <IonButton expand="block" onClick={() => {
                        if (!form.company_name || !form.contact_person || !form.contact_address) {
                          setToastMsg('Please fill in all client fields.');
                          return;
                        }
                        setSection(1);
                      }}>Next</IonButton>
                    </>
                  )}

                  {/* SECTION 1: Signage Type & Material */}
                  {section === 1 && (
                    <>
                      <IonItem>
                        <IonLabel position="stacked">Signage Type</IonLabel>
                        <IonSelect value={form.signage_id} onIonChange={e => setForm({ ...form, signage_id: e.detail.value, material_id: undefined })}>
                          {signages.map(s => <IonSelectOption key={s.signage_id} value={s.signage_id}>{s.name}</IonSelectOption>)}
                        </IonSelect>
                      </IonItem>
                      <IonItem>
                        <IonLabel position="stacked">Material</IonLabel>
                        <IonSelect value={form.material_id} onIonChange={e => setForm({ ...form, material_id: e.detail.value })}>
                          {materials.filter(m => m.signage_id === form.signage_id).map(m => (
                            <IonSelectOption key={m.material_id} value={m.material_id}>{m.name}</IonSelectOption>
                          ))}
                        </IonSelect>
                      </IonItem>
                      <IonItem>
                        <IonLabel position="stacked">Width (m)</IonLabel>
                        <IonInput type="number" value={form.width} onIonChange={e => setForm({ ...form, width: parseFloat(e.detail.value!) || 0 })} />
                      </IonItem>
                      <IonItem>
                        <IonLabel position="stacked">Height (m)</IonLabel>
                        <IonInput type="number" value={form.height} onIonChange={e => setForm({ ...form, height: parseFloat(e.detail.value!) || 0 })} />
                      </IonItem>
                      <IonButton expand="block" onClick={() => setSection(2)}>Next</IonButton>
                      <IonButton expand="block" fill="clear" onClick={() => setSection(0)}>Back</IonButton>
                    </>
                  )}

                  {/* SECTION 2: Add-ons */}
                  {section === 2 && (
                    <>
                      <IonList>
                        {addons.map(a => (
                          <IonItem key={a.addon_id}>
                            <IonLabel>{a.name} <IonText color="medium">
                              ({a.is_flat ? `R${a.flat_rate}` : `R${a.per_sqm_rate} per sqm`})
                            </IonText></IonLabel>
                            <IonCheckbox
                              slot="end"
                              checked={form.addon_ids.includes(a.addon_id)}
                              onIonChange={e => {
                                const updated = e.detail.checked
                                  ? [...form.addon_ids, a.addon_id]
                                  : form.addon_ids.filter(id => id !== a.addon_id);
                                setForm({ ...form, addon_ids: updated });
                              }}
                            />
                          </IonItem>
                        ))}
                      </IonList>
                      <IonButton expand="block" onClick={() => setSection(3)}>Next</IonButton>
                      <IonButton expand="block" fill="clear" onClick={() => setSection(1)}>Back</IonButton>
                    </>
                  )}

                  {/* SECTION 3: Review & Submit */}
                  {section === 3 && (
                    <>
                      <IonCard>
                        <IonCardContent>
                          <IonText>
                            <p><strong>Client:</strong> {form.company_name}</p>
                            <p><strong>Contact:</strong> {form.contact_person}</p>
                            <p><strong>Signage:</strong> {signages.find(s => s.signage_id === form.signage_id)?.name}</p>
                            <p><strong>Material:</strong> {materials.find(m => m.material_id === form.material_id)?.name}</p>
                            <p><strong>Area:</strong> {area.toFixed(2)} m²</p>
                            <p><strong>Addons:</strong> {form.addon_ids.map(id => addons.find(a => a.addon_id === id)?.name).join(', ')}</p>
                            <p><strong>Total:</strong> R{calculateTotal().toFixed(2)}</p>
                          </IonText>
                        </IonCardContent>
                      </IonCard>
                      <IonButton expand="block" onClick={handleSubmit}>Submit Quote</IonButton>
                      <IonButton expand="block" fill="clear" onClick={() => setSection(2)}>Back</IonButton>
                    </>
                  )}

                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>
        </IonGrid>
        <IonToast isOpen={!!toastMsg} message={toastMsg} duration={3000} onDidDismiss={() => setToastMsg('')} />
      </IonContent>
    </IonPage>
  );
};

export default UserQuoteBuilder;
