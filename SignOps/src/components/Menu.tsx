import React from 'react';
import {
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonLoading,
  IonMenu,
  IonMenuToggle,
} from '@ionic/react';
import { useLocation } from 'react-router-dom';

import {
  constructOutline,
  constructSharp,
  documentTextOutline,
  documentTextSharp,
  timeOutline,
  timeSharp,
  logOutOutline,
} from 'ionicons/icons';

import './Menu.css';
import LOGO from '../assets/img/LOGO.png';

const appPages = [
  {
    title: 'Manage Signage',
    url: '/admin/signage',
    iosIcon: constructOutline,
    mdIcon: constructSharp,
  },
  {
    title: 'New Quote',
    url: '/quote/new',
    iosIcon: documentTextOutline,
    mdIcon: documentTextSharp,
  },
  {
    title: 'Quote History',
    url: '/quote/history',
    iosIcon: timeOutline,
    mdIcon: timeSharp,
  },
];

const Menu: React.FC = () => {
  const location = useLocation();
  const [loading, setLoading] = React.useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      // add your logout logic here
      localStorage.clear();
      window.location.href = '/login';
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonMenu side="start" contentId="main" type="overlay">
      <IonLoading isOpen={loading} message="Logging out..." spinner="crescent" />
      <IonContent className="menu-content">
        <IonList>
          <IonListHeader className="list-header">
            <img src={LOGO} alt="Logo" className="signup-logo" />
          </IonListHeader>
          {appPages.map((appPage, index) => (
            <IonMenuToggle key={index} autoHide={false}>
              <IonItem
                className={location.pathname === appPage.url ? 'selected' : ''}
                routerLink={appPage.url}
                routerDirection="none"
                lines="none"
                detail={false}
              >
                <IonIcon aria-hidden="true" slot="start" ios={appPage.iosIcon} md={appPage.mdIcon} />
                <IonLabel>{appPage.title}</IonLabel>
              </IonItem>
            </IonMenuToggle>
          ))}
        </IonList>
        <div className="logout-footer">
          <IonItem button onClick={handleLogout} lines="none">
            <IonIcon slot="start" icon={logOutOutline} />
            <IonLabel>Logout</IonLabel>
          </IonItem>
        </div>
      </IonContent>
    </IonMenu>
  );
};

export default Menu;
