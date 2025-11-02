import React, { useEffect } from 'react';
import { IonRouterOutlet, IonSplitPane } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route, Switch, useHistory } from 'react-router-dom';
import { App } from '@capacitor/app';

import { AuthProvider, useAuth } from './AuthContext.tsx';
import { supabase } from './supbaseclient.tsx';
import Menu from './components/Menu.tsx';

// ---- Pages ----
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

// ---------------------------
// ✅ PrivateRoute (React Router v5 style)
// ---------------------------
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

// ---------------------------
// ✅ Deep Link Handler (for Supabase mobile redirects)
// ---------------------------
const DeepLinkHandler: React.FC = () => {
  const history = useHistory();

  useEffect(() => {
    let listenerHandle: any;

    const setup = async () => {
      listenerHandle = await App.addListener('appUrlOpen', async (data) => {
        const url = data?.url;
        console.log('🔗 Deep link opened:', url);

        if (url && url.includes('auth/callback')) {
          try {
            // Exchange code for session (handles magic link sign-ins)
            const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(url);

            // Extract access_token manually (for password reset flow)
            const tokenMatch = url.match(/access_token=([^&]+)/);
            const accessToken = tokenMatch ? tokenMatch[1] : null;

            if (error) {
              console.error('Session exchange failed:', error);
              return;
            }

            if (accessToken) {
              // Redirect to reset-password if token found
              console.log('🪄 Redirecting to reset-password with token');
              history.replace(`/reset-password?access_token=${accessToken}`);
            } else if (session) {
              // Normal login success redirect
              console.log('✅ Session restored, redirecting to dashboard');
              history.replace('/');
            }
          } catch (err) {
            console.error('Deep link error:', err);
          }
        }
      });
    };

    setup();

    return () => {
      if (listenerHandle && typeof listenerHandle.remove === 'function') {
        listenerHandle.remove();
      }
    };
  }, [history]);

  return null;
};

// ---------------------------
// ✅ Main App Router
// ---------------------------
const AppRouter: React.FC = () => (
  <IonReactRouter>
    <AuthProvider>
      <IonSplitPane when={false} contentId="main">
        <Menu />
        <IonRouterOutlet id="main">
          <DeepLinkHandler />

          <Switch>
            {/* Public routes */}
            <Route path="/login" component={Login} exact />
            <Route path="/reset-password" component={ResetPassword} exact />

            {/* Protected routes */}
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

            {/* Default redirect */}
            <Redirect exact from="/" to="/quote/new" />
          </Switch>
        </IonRouterOutlet>
      </IonSplitPane>
    </AuthProvider>
  </IonReactRouter>
);

export default AppRouter;
