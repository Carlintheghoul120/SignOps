// src/AppRouter.tsx
import React from 'react';
import {
  IonRouterOutlet,
  IonSplitPane,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route, Switch } from 'react-router-dom';

import { AuthProvider, useAuth } from './AuthContext';
import Menu from './components/Menu';

import Login from './pages/Login';
import ManageSignage from './pages/admin/ManageSignage';
import UserQuoteBuilder from './pages/user/QuoteNew';
import QuoteHistory from './pages/user/QuoteHistory';
import AdminDashboard from './pages/admin/AdminDashboard';
import ManageMaterials from './pages/admin/ManageMaterials';
import AdminAddons from './pages/admin/ManageAddOns';
import AdminUsers from './pages/admin/ManageUsers';
import TaskBoard from './pages/admin/TaskBoard';
import AdminTaskTemplates from './pages/admin/AdminTaskTemplate';
import UserTasks from './pages/user/UserTasks';

const ProtectedRoutes: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="ion-padding">Loading...</div>;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <IonSplitPane contentId="main">
      <Menu />
      <IonRouterOutlet id="main">
        <Route path="/admin/dashboard" component={AdminDashboard} exact />
        <Route path="/quote/new" component={UserQuoteBuilder} exact />
        <Route path="/quote/history" component={QuoteHistory} exact />
		<Route path="/tasks/view" component={UserTasks}/>
        <Route path="/admin/signage" component={ManageSignage} exact />
		<Route path="/admin/materials" component={ManageMaterials} exact />
		<Route path="/admin/addons" component={AdminAddons} exact />
		<Route path="/admin/users" component={AdminUsers} exact />
		<Route path="/admin/taskboard" component={TaskBoard} exact />
		<Route path="/admin/tasktemplates" component={AdminTaskTemplates}/>
        <Route exact path="/" render={() => <Redirect to="/quote/new" />} />
      </IonRouterOutlet>
    </IonSplitPane>
  );
};

const AppRouter: React.FC = () => (
  <IonReactRouter>
    <AuthProvider>
      <IonRouterOutlet>
        <Switch>
          <Route path="/login" component={Login} exact />
          <Route path="/" render={() => <ProtectedRoutes />} />
        </Switch>
      </IonRouterOutlet>
    </AuthProvider>
  </IonReactRouter>
);

export default AppRouter;
