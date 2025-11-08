import React, { useEffect } from 'react';
import { IonRouterOutlet, IonSplitPane } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route, Switch, useHistory } from 'react-router-dom';
import { App } from '@capacitor/app';

import { AuthProvider, useAuth } from './AuthContext.tsx';
import { supabase } from './supbaseclient.tsx';
import Menu from './components/Menu.tsx';

import Login from './pages/Login.tsx';
import ResetPassword from './pages/ResetPassword.tsx';
import AdminDashboard from './pages/admin/AdminDashboard.tsx';
import UserQuoteBuilder from './pages/user/QuoteNew.tsx';
import QuoteHistory from './pages/user/QuoteHistory.tsx';
import UserTasks from './pages/user/UserTasks.tsx';
import ManageSignage from './pages/admin/ManageSignage.tsx';
import ManageMaterials from './pages/admin/ManageMaterials.tsx';
import AdminAddons from './pages/admin/ManageAddOns.tsx';
import AdminUsers from './pages/admin/ManageUsers.tsx';
import TaskBoard from './pages/admin/TaskBoard.tsx';
import AdminTaskTemplates from './pages/admin/AdminTaskTemplate.tsx';

/* ---------------------------
   Private Route (Ionic + React Router v5)
--------------------------- */
const PrivateRoute = ({ component: Component, ...rest }: any) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="ion-padding">Loading...</div>;

  return (
    <Route
      {...rest}
      render={(props) =>
        user ? <Component {...props} /> : <Redirect to="/login" />
      }
    />
  );
};

/* ---------------------------
   Deep Link Handler
--------------------------- */
const DeepLinkHandler: React.FC = () => {
  const history = useHistory();

  useEffect(() => {
    const setupListener = async () => {
      const listener = await App.addListener('appUrlOpen', async (data) => {
        const url = data?.url;
        if (!url) return;
        console.log('[DeepLinkHandler] URL opened:', url);

        try {
          const parsed = new URL(url);
          const token = parsed.searchParams.get('access_token') || parsed.searchParams.get('token');
          const type = parsed.searchParams.get('type');

          // Supabase password recovery link
          if (type === 'recovery' && token) {
            console.log('[DeepLinkHandler] Password recovery link detected');
            // Store token temporarily for ResetPassword page
            sessionStorage.setItem('recovery_token', token);
            history.replace('/reset-password');
            return;
          }

          // OAuth login callback
          if (url.includes('auth/callback')) {
            const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(url);
            if (session) {
              console.log('[DeepLinkHandler] Session created, redirecting...');
              history.replace('/quote/new');
            } else {
              console.error('[DeepLinkHandler] Session exchange failed', error);
              history.replace('/login');
            }
            return;
          }

          // Default fallback
          if (url.includes('reset-password')) {
            console.log('[DeepLinkHandler] Custom deep link → reset-password');
            history.replace('/reset-password');
          }
        } catch (err) {
          console.error('[DeepLinkHandler] Error:', err);
          history.replace('/login');
        }
      });
    };

    setupListener();
  }, [history]);

  return null;
};

/* ---------------------------
   Main App Router
--------------------------- */
const AppRouter: React.FC = () => (
  <IonReactRouter>
    <AuthProvider>
      <IonSplitPane when={false} contentId="main">
        <Menu />
        <IonRouterOutlet id="main">
          <DeepLinkHandler />

          <Switch>
            {/* 🔓 Public routes */}
            <Route path="/login" component={Login} exact />
            <Route path="/reset-password" component={ResetPassword} exact />

            {/* 🔐 Protected routes */}
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

            {/* 🔁 Default redirect */}
            <Redirect exact from="/" to="/login" />
          </Switch>
        </IonRouterOutlet>
      </IonSplitPane>
    </AuthProvider>
  </IonReactRouter>
);

export default AppRouter;
