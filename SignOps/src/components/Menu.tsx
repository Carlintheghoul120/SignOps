// src/components/Menu.tsx
import React from 'react';
import {
  IonMenu, IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonMenuToggle
} from '@ionic/react';

const Menu: React.FC = () => (
  <IonMenu contentId="main">
    <IonHeader>
      <IonToolbar color="primary">
        <IonTitle>Signage App</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <IonList>
        <IonMenuToggle autoHide={false}>
          <IonItem routerLink="/admin/signage" routerDirection="none">
            <IonLabel>Manage Signage</IonLabel>
          </IonItem>
          <IonItem routerLink="/quote/new" routerDirection="none">
            <IonLabel>New Quote</IonLabel>
          </IonItem>
          <IonItem routerLink="/quote/history" routerDirection="none">
            <IonLabel>Quote History</IonLabel>
          </IonItem>
        </IonMenuToggle>
      </IonList>
    </IonContent>
  </IonMenu>
);

export default Menu;
