import React from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonButton
} from '@ionic/react';
import { useHistory } from 'react-router-dom';

const AdminDashboard: React.FC = () => {
  const history = useHistory();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Admin Dashboard</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonGrid fixed className="ion-justify-content-center ion-align-items-center" style={{ height: '100%' }}>
          <IonRow className="ion-justify-content-center">
            <IonCol size="12" sizeMd="8" sizeLg="6">
              <IonCard className="ion-padding">
                <IonCardHeader>
                  <IonCardTitle className="ion-text-center">Admin Tools</IonCardTitle>
                </IonCardHeader>

                <IonCardContent className="ion-text-center">
                  <IonButton expand="block" color="primary" className="ion-margin-bottom" onClick={() => history.push('/admin/signage')}>
                    Manage Signage
                  </IonButton>

                  <IonButton expand="block" color="secondary" className="ion-margin-bottom" onClick={() => history.push('/admin/users')}>
                    Manage Users
                  </IonButton>
				  <IonButton expand="block" color="tertiary" className="ion-margin-bottom" onClick={() => history.push('/admin/addons')}>
					Manage Add-ons
				  </IonButton>
				  <IonButton expand="block" color="success" className="ion-margin-bottom" onClick={() => history.push('/admin/materials')}>
					Manage Materials
				  </IonButton>
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>
        </IonGrid>
      </IonContent>
    </IonPage>
  );
};

export default AdminDashboard;
