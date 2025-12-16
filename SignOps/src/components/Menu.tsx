// deno-lint-ignore-file no-window
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
import { useLocation, useHistory } from 'react-router-dom';
import { supabase } from '../supbaseclient.tsx';

import {
  constructOutline,
  constructSharp,
  documentTextOutline,
  documentTextSharp,
  timeOutline,
  timeSharp,
  logOutOutline,
  fileTrayFullOutline,
  fileTrayFullSharp,
  closeOutline,
} from 'ionicons/icons';

import './Menu.css';
import LOGO from '../../resources/icon.png';

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
  {
    title: 'Tasks',
    url: '/tasks/view',
    iosIcon: fileTrayFullOutline,
    mdIcon: fileTrayFullSharp,
    adminOnly: false,
  },
];

const Menu: React.FC = () => {
  const location = useLocation();
  const history = useHistory();

  const [loggingOut, setLoggingOut] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminCheckLoading, setAdminCheckLoading] = useState(true);

  // 🔹 Check admin status using stored identifier (email or phone)
  useEffect(() => {
    const checkAdminStatus = async () => {
      setAdminCheckLoading(true);
      try {
        let identifierType: string | null = null;
        let identifierValue: string | null = null;

        try {
          identifierType = localStorage.getItem('signops_identifier_type');
          identifierValue = localStorage.getItem('signops_identifier_value');
        } catch (err) {
          console.warn('[Menu] Unable to access localStorage:', err);
        }

        if (!identifierType || !identifierValue) {
          console.warn('[Menu] No stored identifier found, treating as non-admin');
          setIsAdmin(false);
          return;
        }

        let query = supabase.from('users').select('is_admin').single();

        if (identifierType === 'email') {
          query = supabase
            .from('users')
            .select('is_admin')
            .eq('email', identifierValue.toLowerCase())
            .single();
        } else if (identifierType === 'phone') {
          query = supabase
            .from('users')
            .select('is_admin')
            .eq('phone', identifierValue)
            .single();
        }

        const { data: userRow, error } = await query;

        if (error) {
          console.error('[Menu] Error fetching user admin status:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(userRow?.is_admin ?? false);
        }
      } catch (err) {
        console.error('[Menu] Unexpected error checking admin status:', err);
        setIsAdmin(false);
      } finally {
        setAdminCheckLoading(false);
      }
    };

    checkAdminStatus();
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      try {
        localStorage.clear();
      } catch (err) {
        console.warn('[Menu] Error clearing localStorage:', err);
      }

      try {
        history.replace('/login');
      } catch (err) {
        console.warn('[Menu] history.replace failed, falling back to window.location', err);
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    } catch (err) {
      console.error('[Menu] Error during logout:', err);
      setLoggingOut(false);
    }
  };

  const closeMenu = () => {
    // no DOM poking, just simple navigation or let IonMenuToggle handle it
    history.goBack();
  };

  const filteredPages = appPages.filter((page) => {
    if (!page.adminOnly) return true;
    if (adminCheckLoading || isAdmin === null) return false;
    return !!isAdmin;
  });

  return (
    <IonMenu side="start" contentId="main" type="overlay">
      <IonLoading
        isOpen={loggingOut}
        message="Logging out..."
        spinner="crescent"
      />

      <button className="menu-close-button" onClick={closeMenu}>
        <IonIcon icon={closeOutline} />
      </button>

      <IonContent className="menu-content">
        <IonList>
          <IonListHeader className="list-header">
            <img src={LOGO} alt="Logo" className="signup-logo" />
          </IonListHeader>

          {filteredPages.map((appPage, index) => (
            <IonMenuToggle key={index} autoHide={true}>
              <IonItem
                className={location.pathname === appPage.url ? 'selected' : ''}
                routerLink={appPage.url}
                routerDirection="none"
                lines="none"
                detail={false}
              >
                <IonIcon
                  aria-hidden="true"
                  slot="start"
                  ios={appPage.iosIcon}
                  md={appPage.mdIcon}
                />
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
