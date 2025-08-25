import React from 'react';
import {
	IonRouterOutlet,
	IonSplitPane
} from '@ionic/react';
import {IonReactRouter} from '@ionic/react-router';
import {Redirect,Route,Switch} from 'react-router-dom';

import {AuthProvider,useAuth} from './AuthContext';
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

const PrivateRoute=({component: Component,...rest}: any) => {
	const {user,loading}=useAuth();

	if(loading) {
		return <div className="ion-padding">Loading...</div>;
	}

	return (
		<Route
			{...rest}
			render={(props) =>
				user? <Component {...props} />:<Redirect to="/login" />
			}
		/>
	);
};

const AppRouter: React.FC=() => (
	<IonReactRouter>
		<AuthProvider>
			<IonSplitPane when={false} contentId="main">
				<Menu />
				<IonRouterOutlet id="main">
					<Switch>
						<Route path="/login" component={Login} exact />
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
						<Redirect exact from="/" to="/quote/new" />
					</Switch>
				</IonRouterOutlet>
			</IonSplitPane>
		</AuthProvider>
	</IonReactRouter>
);

export default AppRouter;
