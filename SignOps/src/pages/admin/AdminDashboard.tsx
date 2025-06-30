import React from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle,
  IonContent, IonSegment, IonSegmentButton, IonLabel
} from '@ionic/react';
import AdminSignage from './ManageSignage';
import AdminMaterials from './ManageMaterials';
import AdminAddons from './ManageAddOns';

const ManageSignage: React.FC = () => {
  const [tab, setTab] = React.useState('signage');

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Manage Signage</IonTitle>
        </IonToolbar>
        <IonToolbar>
			<IonSegment value={tab} onIonChange={e => setTab(e.detail.value as string)}>
            <IonSegmentButton value="signage"><IonLabel>Types</IonLabel></IonSegmentButton>
            <IonSegmentButton value="materials"><IonLabel>Materials</IonLabel></IonSegmentButton>
            <IonSegmentButton value="addons"><IonLabel>Add-ons</IonLabel></IonSegmentButton>
          </IonSegment>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {tab === 'signage' && <AdminSignage />}
        {tab === 'materials' && <AdminMaterials />}
        {tab === 'addons' && <AdminAddons />}
      </IonContent>
    </IonPage>
  );
};

export default ManageSignage;
