import React, { useEffect } from 'react';
import {
  IonRouterOutlet,
  IonSplitPane
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route, Switch, useHistory } from 'react-router-dom';
import { App } from '@capacitor/app';

import { AuthProvider, useAuth } from './AuthContext.tsx';
import { supabase } from './supbaseclient.tsx';
import Menu from './components/Menu.tsx';

import Login from './pages/Login.tsx';
import ManageSignage from './pages/admin/ManageSignage.tsx';
import UserQuoteBuilder from './pages/user/QuoteNew.tsx';
import QuoteHistory from './pages/user/QuoteHistory.tsx';
import AdminDashboard from './pages/admin/AdminDashboard.tsx';
import ManageMaterials from './pages/admin/ManageMaterials.tsx';
import AdminAddons from './pages/admin/ManageAddOns.tsx';
import AdminUsers from './pages/admin/ManageUsers.tsx';
import TaskBoard from './pages/admin/TaskBoard.tsx';
import AdminTaskTemplates from './pages/admin/AdminTaskTemplate.tsx';
import UserTasks from './pages/user/UserTasks.tsx';
import ResetPassword from './pages/ResetPassword.tsx'; // 👈 new page

// --------------------------------------
// ✅ PrivateRoute wrapper
// --------------------------------------
const PrivateRoute = ({ component: Component, ...rest }: any) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="ion-padding">Loading...</div>;
  }

  return (
    <Route
      {...rest}
      render={(props) =>
        user ? <Component {...props} /> : <Redirect to="/login" />
      }
    />
  );
};

// --------------------------------------
// ✅ Deep Link Handler (for Supabase reset links)
// --------------------------------------
const DeepLinkHandler: React.FC = () => {
  const history = useHistory();

  useEffect(() => {
    let listener: any;

    const setup = async () => {
      const handle = await App.addListener('appUrlOpen', async (data) => {
        const url = data?.url;

        // Example: com.signops.app://auth/callback#access_token=...
        if (url && url.includes('auth/callback')) {
          try {
            // Let Supabase handle the token in the URL
            const { data: { session }, error } =
              await supabase.auth.exchangeCodeForSession(url);

            if (error) {
              console.error('Session exchange failed:', error);
              return;
            }

            // Redirect user to reset-password if it's a reset flow
            if (session) {
              history.replace('/reset-password');
            }
          } catch (err) {
            console.error('Deep link error:', err);
          }
        }
      });

      listener = handle;
    };

    setup();

    return () => {
      if (listener && typeof listener.remove === 'function') {
        listener.remove();
      }
    };
  }, [history]);

  return null;
};

// --------------------------------------
// ✅ Main App Router
// --------------------------------------
const AppRouter: React.FC = () => (
  <IonReactRouter>
    <AuthProvider>
      <IonSplitPane when={false} contentId="main">
        <Menu />
        <IonRouterOutlet id="main">
          <DeepLinkHandler /> {/* 👈 handles Supabase auth redirects */}

          <Switch>
            {/* Public routes */}
            <Route path="/login" component={Login} exact />
            <Route path="/reset-password" component={ResetPassword} exact /> {/* 👈 new route */}

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
