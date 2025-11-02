import React from 'react';
import { IonRouterOutlet, IonSplitPane } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route, Switch } from 'react-router-dom';

import { AuthProvider, useAuth } from './AuthContext.tsx';
import Menu from './components/Menu.tsx';
import DeepLinkHandler from "./components/deeplinkhandler.tsx";

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

const AppRouter: React.FC = () => (
  <IonReactRouter>
    <AuthProvider>
      <IonSplitPane when={false} contentId="main">
        <Menu />
        <IonRouterOutlet id="main">
          <DeepLinkHandler /> {/* 👈 handles password reset links */}

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
