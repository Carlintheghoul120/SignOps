import React from 'react';
import {
  IonApp,
  IonRouterOutlet,
  IonSplitPane,
  IonPage,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route, Switch } from 'react-router-dom';

import { AuthProvider, useAuth } from './AuthContext';
import Menu from './components/Menu';
import Login from './pages/Login';
import ManageSignage from './pages/admin/ManageSignage';
import UserQuoteBuilder from './pages/user/QuoteNew';
import QuoteHistory from './pages/user/QuoteHistory';

const ProtectedRoutes: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <IonPage><p>Loading...</p></IonPage>;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <IonSplitPane contentId="main">
      <Menu />
      <IonPage id="main">
        <IonRouterOutlet>
          <Route path="/admin/signage" component={ManageSignage} exact />
          <Route path="/quote/new" component={UserQuoteBuilder} exact />
          <Route path="/quote/history" component={QuoteHistory} exact />
          <Route path="/" render={() => <Redirect to="/quote/new" />} exact />
        </IonRouterOutlet>
      </IonPage>
    </IonSplitPane>
  );
};

const App: React.FC = () => (
  <IonApp>
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
  </IonApp>
);

export default App;
