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

  // Close menu on navigation
  useEffect(() => {
    const unlisten = history.listen(() => {
      try {
        const menu = document.querySelector('ion-menu') as HTMLIonMenuElement | null;
        if (menu && (menu as any).isOpen) {
          (menu as any).close();
        }
      } catch (err) {
        console.warn('[Menu] Error closing menu on route change:', err);
      }
    });

    return () => {
      unlisten();
    };
  }, [history]);

  // Check admin status for current user
  useEffect(() => {
    const checkAdminStatus = async () => {
      setAdminCheckLoading(true);
      try {
        const { data, error: userError } = await supabase.auth.getUser();

        if (userError) {
          console.error('[Menu] Error getting user:', userError);
          setIsAdmin(false);
          return;
        }

        const user = data?.user;
        if (!user) {
          // Not logged in
          setIsAdmin(false);
          return;
        }

        const { data: userRow, error } = await supabase
          .from('users')
          .select('is_admin')
          .eq('user_id', user.id)
          .single();

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

      // Use full reload to reset app state (works in Capacitor + browser)
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    } catch (err) {
      console.error('[Menu] Error during logout:', err);
      setLoggingOut(false);
    }
  };

  const closeMenu = () => {
    try {
      const menu = document.querySelector('ion-menu') as HTMLIonMenuElement | null;
      if (menu) {
        (menu as any).close();
      }
    } catch (err) {
      console.warn('[Menu] Error closing menu:', err);
    }
  };

  // Only show admin-only pages once we *know* isAdmin.
  // While adminCheckLoading && isAdmin === null, hide admin pages to be safe.
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
            <IonMenuToggle key={index} autoHide={false}>
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
