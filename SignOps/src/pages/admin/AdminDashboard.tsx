import React from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardContent,
  IonIcon,
  IonLabel,
  IonButtons,
  IonMenuButton,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';

import {
  constructOutline,
  peopleOutline,
  layersOutline,
  cubeOutline,
  fileTrayStackedOutline,
  clipboardOutline,
} from 'ionicons/icons';

import './AdminDashboard.css';

const AdminDashboard: React.FC = () => {
  const history = useHistory();

  const tiles = [
    {
      title: 'Signage',
      icon: constructOutline,
      route: '/admin/signage',
    },
    {
      title: 'Users',
      icon: peopleOutline,
      route: '/admin/users',
    },
    {
      title: 'Add-ons',
      icon: layersOutline,
      route: '/admin/addons',
    },
    {
      title: 'Materials',
      icon: cubeOutline,
      route: '/admin/materials',
    },{
      title: 'Task Board',
      icon: fileTrayStackedOutline,
      route: '/admin/taskboard',
    },
	{
      title: 'Task Templates',
      icon: clipboardOutline,
      route: '/admin/tasktemplates',
    },
  ];

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
					 <IonButtons slot="start">
					<IonMenuButton />
				  </IonButtons>
          <IonTitle>Admin Dashboard</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonGrid>
          <IonRow>
            {tiles.map((tile, index) => (
              <IonCol key={index} size="6" sizeMd="3">
                <IonCard
                  className="admin-tile"
                  onClick={() => history.push(tile.route)}
                >
                  <IonCardContent className="admin-tile-content">
                    <IonIcon icon={tile.icon} className="admin-tile-icon" />
                    <IonLabel className="admin-tile-label">{tile.title}</IonLabel>
                  </IonCardContent>
                </IonCard>
              </IonCol>
            ))}
          </IonRow>
        </IonGrid>
      </IonContent>
    </IonPage>
  );
};

export default AdminDashboard;
