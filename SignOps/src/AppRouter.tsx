import React, { useEffect } from 'react';
import { IonRouterOutlet, IonSplitPane } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route, Switch, useHistory } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { supabase } from './supbaseclient';
import { AuthProvider, useAuth } from './AuthContext';

import Menu from './components/Menu';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserQuoteBuilder from './pages/user/QuoteNew';
import QuoteHistory from './pages/user/QuoteHistory';
import UserTasks from './pages/user/UserTasks';
import ManageSignage from './pages/admin/ManageSignage';
import ManageMaterials from './pages/admin/ManageMaterials';
import AdminAddons from './pages/admin/ManageAddOns';
import AdminUsers from './pages/admin/ManageUsers';
import TaskBoard from './pages/admin/TaskBoard';
import AdminTaskTemplates from './pages/admin/AdminTaskTemplate';

/* -----------------------------------------------
   🔐 Private Route
------------------------------------------------ */
const PrivateRoute = ({ component: Component, ...rest }: any) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="ion-padding">Loading...</div>;
  return (
    <Route
      {...rest}
      render={(props) => (user ? <Component {...props} /> : <Redirect to="/login" />)}
    />
  );
};

/* -----------------------------------------------
   🌐 Deep Link Handler
------------------------------------------------ */
const DeepLinkHandler: React.FC = () => {
  const history = useHistory();

  const handleUrl = async (url: string) => {
    if (!url) return;

    try {
      const cleanUrl = decodeURIComponent(url);
      const parsed = new URL(cleanUrl);

      // Merge search params and hash params
      const params = new URLSearchParams(parsed.search);
      if (parsed.hash) {
        const hashParams = new URLSearchParams(parsed.hash.slice(1));
        hashParams.forEach((value, key) => params.set(key, value));
      }

      const type = params.get('type');
      const token = params.get('access_token') || params.get('token');

      // Password recovery deep link
      if (type === 'recovery' && token) {
        console.log('[DeepLinkHandler] Password recovery detected', token);
        sessionStorage.setItem('recovery_token', token);
        history.replace('/reset-password');
        return;
      }

      // OAuth / Magic Link login
      if (cleanUrl.includes('auth/callback')) {
        const { error } = await supabase.auth.exchangeCodeForSession(cleanUrl);
        if (error) {
          console.error('[DeepLinkHandler] exchangeCodeForSession failed:', error.message);
          history.replace('/login');
        } else {
          history.replace('/quote/new');
        }
        return;
      }

      // Fallback
      console.warn('[DeepLinkHandler] No handler for URL:', cleanUrl);
      history.replace('/login');
    } catch (err) {
      console.error('[DeepLinkHandler] Error parsing deep link:', err);
      history.replace('/login');
    }
  };

  useEffect(() => {
    const setup = async () => {
      // Cold start
      const launchUrl = await CapacitorApp.getLaunchUrl();
      if (launchUrl?.url) await handleUrl(launchUrl.url);

      // Warm start
      const listener = CapacitorApp.addListener('appUrlOpen', (event) => {
        if (event?.url) handleUrl(event.url);
      });

      return () => listener.remove();
    };

    setup();
  }, [history]);

  return null;
};

/* -----------------------------------------------
   ⚙️ App Router
------------------------------------------------ */
const AppRouter: React.FC = () => (
  <IonReactRouter>
    <AuthProvider>
      <DeepLinkHandler />
      <IonSplitPane when={false} contentId="main">
        <Menu />
        <IonRouterOutlet id="main">
          <Switch>
            {/* Public */}
            <Route path="/login" component={Login} exact />
            <Route path="/reset-password" component={ResetPassword} exact />

            {/* Admin */}
            <PrivateRoute path="/admin/dashboard" component={AdminDashboard} exact />
            <PrivateRoute path="/admin/signage" component={ManageSignage} exact />
            <PrivateRoute path="/admin/materials" component={ManageMaterials} exact />
            <PrivateRoute path="/admin/addons" component={AdminAddons} exact />
            <PrivateRoute path="/admin/users" component={AdminUsers} exact />
            <PrivateRoute path="/admin/taskboard" component={TaskBoard} exact />
            <PrivateRoute path="/admin/tasktemplates" component={AdminTaskTemplates} exact />

            {/* User */}
            <PrivateRoute path="/quote/new" component={UserQuoteBuilder} exact />
            <PrivateRoute path="/quote/history" component={QuoteHistory} exact />
            <PrivateRoute path="/tasks/view" component={UserTasks} exact />

            {/* Default */}
            <Redirect exact from="/" to="/login" />
          </Switch>
        </IonRouterOutlet>
      </IonSplitPane>
    </AuthProvider>
  </IonReactRouter>
);

export default AppRouter;
