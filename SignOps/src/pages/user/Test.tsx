import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenu, IonMenuButton } from '@ionic/react';

const UserPage: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
			<IonButtons slot="start">

			<IonMenuButton />
			</IonButtons>
          <IonTitle>Test Profile</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <h1>Hello from Profile</h1>
      </IonContent>
    </IonPage>
  );
};

export default UserPage;