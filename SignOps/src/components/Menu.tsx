import React from 'react';
import {
	IonMenu,IonHeader,IonToolbar,IonTitle,IonContent,
	IonList,IonItem,IonLabel,IonMenuToggle
} from '@ionic/react';

const Menu: React.FC=() => (
<IonMenu contentId="main" type="overlay">
  <IonHeader>
    <IonToolbar color="primary">
      <IonTitle className="ion-text-center">Signage App</IonTitle>
    </IonToolbar>
  </IonHeader>
  <IonContent className="ion-padding">
    <IonList lines="none">
      <IonMenuToggle autoHide={false}>
        <IonItem routerLink="/admin/signage" routerDirection="none">
          <IonLabel>Manage Signage</IonLabel>
        </IonItem>
      </IonMenuToggle>
      <IonMenuToggle autoHide={false}>
        <IonItem routerLink="/quote/new" routerDirection="none">
          <IonLabel>New Quote</IonLabel>
        </IonItem>
      </IonMenuToggle>
      <IonMenuToggle autoHide={false}>
        <IonItem routerLink="/quote/history" routerDirection="none">
          <IonLabel>Quote History</IonLabel>
        </IonItem>
      </IonMenuToggle>
    </IonList>
  </IonContent>
</IonMenu>

);

export default Menu;
