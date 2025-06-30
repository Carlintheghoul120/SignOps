import {
  IonApp,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonMenu,
  IonList,
  IonItem,
  IonLabel,
  IonSplitPane,
  IonPage,
  IonRouterOutlet
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route } from 'react-router-dom';

import AdminSignage from '../pages/admin/ManageSignage';
import AdminMaterials from '../pages/admin/ManageMaterials';
import AdminAddons from '../pages/admin/ManageAddOns'; // Placeholder
import UserQuoteBuilder from '../pages/user/QuoteNew'; // Placeholder

const MainLayout: React.FC = () => {
  return (
    <IonApp>
      <IonReactRouter>
        <IonSplitPane contentId="main">
          {/* Side Menu */}
          <IonMenu contentId="main">
            <IonHeader>
              <IonToolbar color="primary">
                <IonTitle>Signage Admin</IonTitle>
              </IonToolbar>
            </IonHeader>
            <IonContent>
              <IonList>
                <IonItem routerLink="/admin/signage">
                  <IonLabel>Signage Types</IonLabel>
                </IonItem>
                <IonItem routerLink="/admin/materials">
                  <IonLabel>Materials</IonLabel>
                </IonItem>
                <IonItem routerLink="/admin/addons">
                  <IonLabel>Add-ons</IonLabel>
                </IonItem>
                <IonItem routerLink="/quote/new">
                  <IonLabel>Build a Quote</IonLabel>
                </IonItem>
              </IonList>
            </IonContent>
          </IonMenu>

          {/* Main Content */}
          <IonPage id="main">
            <IonRouterOutlet>
              <Route path="/admin/signage" component={AdminSignage} exact />
              <Route path="/admin/materials" component={AdminMaterials} exact />
              <Route path="/admin/addons" component={AdminAddons} exact />
              <Route path="/quote/new" component={UserQuoteBuilder} exact />
              <Route path="/" render={() => <Redirect to="/admin/signage" />} exact />
            </IonRouterOutlet>
          </IonPage>
        </IonSplitPane>
      </IonReactRouter>
    </IonApp>
  );
};

export default MainLayout;
