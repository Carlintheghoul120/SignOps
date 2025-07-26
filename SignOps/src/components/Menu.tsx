import React, { useEffect, useState } from 'react';
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
import { supabase } from '../supbaseclient';

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
import LOGO from '../assets/img/logo.png';

const appPages = [
  {
    title: 'Dashboard',
    url: '/admin/Dashboard',
    iosIcon: constructOutline,
    mdIcon: constructSharp,
    adminOnly: true,
  },
  {
    title: 'New Quote',
    url: '/quote/new',
    iosIcon: documentTextOutline,
    mdIcon: documentTextSharp,
    adminOnly: false,
  },
  {
    title: 'Quote History',
    url: '/quote/history',
    iosIcon: timeOutline,
    mdIcon: timeSharp,
    adminOnly: false,
  },
];

const Menu: React.FC = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAdminStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user admin status:', error);
      } else {
        setIsAdmin(data?.is_admin ?? false);
      }
    };

    checkAdminStatus();
  }, []);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      localStorage.clear();
      window.location.href = '/login';
    } finally {
      setLoading(false);
    }
  };

  const filteredPages = appPages.filter(page => !page.adminOnly || isAdmin);

  return (
    <IonMenu side="start" contentId="main" type="overlay">
      <IonLoading isOpen={loading} message="Logging out..." spinner="crescent" />
      <IonContent className="menu-content">
        <IonList>
          <IonListHeader className="list-header">
            <img src={LOGO} alt="Logo" className="signup-logo" />
          </IonListHeader>
          {filteredPages.map((appPage, index) => (
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
