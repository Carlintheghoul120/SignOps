import React from 'react';
import {
  IonApp,
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
/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Theme variables (optional custom CSS variables) */
import './theme/variables.css';
import UserPage from './pages/user/Test';

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
        <Route path="/admin/signage" component={ManageSignage} exact />
        <Route path="/quote/new" component={UserQuoteBuilder} exact />
        <Route path="/quote/history" component={QuoteHistory} exact />
        <Route exact path="/" render={() => <Redirect to="/quote/new" />} />
		<Route path="/Test" component={UserPage} />
      </IonRouterOutlet>
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
