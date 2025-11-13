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

const PrivateRoute = ({ component: Component, ...rest }: any) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="ion-padding">Loading...</div>;
  return (
    <Route {...rest} render={(props) => (user ? <Component {...props} /> : <Redirect to="/login" />)} />
  );
};

/* -----------------------------------------------
   ✅ Deep Link Handler
------------------------------------------------ */
const DeepLinkHandler: React.FC = () => {
  const history = useHistory();

  const handleUrl = async (url: string) => {
    console.log('[DeepLinkHandler] Handling URL:', url);
    try {
      const parsed = new URL(url);
      const host = parsed.host; // e.g. "auth" or "reset"
      const type = parsed.searchParams.get('type');
      const token = parsed.searchParams.get('token');

      // 🔹 CASE 1: Supabase Password Recovery
      // Matches: com.signops.app://reset?type=recovery&token=...
      if (host === 'reset' || type === 'recovery' || url.includes('type=recovery')) {
        console.log('[DeepLinkHandler] Detected password recovery link');
        sessionStorage.setItem('recovery_url', url);
        history.replace('/reset-password');
        return;
      }

      // 🔹 CASE 2: OAuth / Magic Link Login
      // Matches: com.signops.app://auth/callback?code=...
      if (host === 'auth' && url.includes('callback')) {
        console.log('[DeepLinkHandler] Detected Supabase OAuth callback');
        const { error } = await supabase.auth.exchangeCodeForSession(url);
        if (error) {
          console.error('[DeepLinkHandler] exchangeCodeForSession failed:', error.message);
          history.replace('/login');
        } else {
          console.log('[DeepLinkHandler] Session established → /quote/new');
          history.replace('/quote/new');
        }
        return;
      }

      // 🔹 CASE 3: Fallback reset path (just in case)
      if (url.includes('reset-password')) {
        history.replace('/reset-password');
        return;
      }

      console.warn('[DeepLinkHandler] No matching handler for:', url);
      history.replace('/login');
    } catch (err) {
      console.error('[DeepLinkHandler] Error:', err);
      history.replace('/login');
    }
  };

  useEffect(() => {
    const setup = async () => {
      // 1️⃣ Handle app cold start
      const launchUrl = await CapacitorApp.getLaunchUrl();
      if (launchUrl?.url) {
        console.log('[DeepLinkHandler] Cold start URL:', launchUrl.url);
        await handleUrl(launchUrl.url);
      }

      // 2️⃣ Handle when app is already open
      const listener = await CapacitorApp.addListener('appUrlOpen', async (event) => {
        if (event?.url) {
          console.log('[DeepLinkHandler] Warm open URL:', event.url);
          await handleUrl(event.url);
        }
      });

      return () => {
        listener.remove();
      };
    };

    setup();
  }, [history]);

  return null;
};

/* -----------------------------------------------
   ✅ App Router
------------------------------------------------ */
const AppRouter: React.FC = () => (
  <IonReactRouter>
    <AuthProvider>
      <IonSplitPane when={false} contentId="main">
        <Menu />
        <IonRouterOutlet id="main">
          <DeepLinkHandler />
          <Switch>
            <Route path="/login" component={Login} exact />
            <Route path="/reset-password" component={ResetPassword} exact />
            <PrivateRoute path="/admin/dashboard" component={AdminDashboard} exact />
            <PrivateRoute path="/quote/new" component={UserQuoteBuilder} exact />
            <PrivateRoute path="/quote/history" component={QuoteHistory} exact />
            <PrivateRoute path="/tasks/view" component={UserTasks} exact />
            <PrivateRoute path="/admin/signage" component={ManageSignage} exact />
            <PrivateRoute path="/admin/materials" component={ManageMaterials} exact />
            <PrivateRoute path="/admin/addons" component={AdminAddons} exact />
            <PrivateRoute path="/admin/users" component={AdminUsers} exact />
            <PrivateRoute path="/admin/taskboard" component={TaskBoard} exact />
            <PrivateRoute path="/admin/tasktemplates" component={AdminTaskTemplates} exact />
            <Redirect exact from="/" to="/login" />
          </Switch>
        </IonRouterOutlet>
      </IonSplitPane>
    </AuthProvider>
  </IonReactRouter>
);

export default AppRouter;
