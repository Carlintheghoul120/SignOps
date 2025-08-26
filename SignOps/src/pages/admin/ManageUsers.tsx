import React,{useEffect,useState} from 'react';
import {
	IonPage,IonHeader,IonToolbar,IonTitle,IonContent,IonList,IonItem,
	IonLabel,IonToggle,IonButtons,IonButton,IonToast,IonFooter,IonText,
	IonMenuButton
} from '@ionic/react';
import {supabase} from '../../supbaseclient';

interface User {
	id: string;
	email: string;
	full_name?: string;
	is_admin: boolean;
}

const AdminUsers: React.FC=() => {
	const [users,setUsers]=useState<User[]>([]);
	const [toastMessage,setToastMessage]=useState('');
	const [page,setPage]=useState(1);
	const pageSize=5;

	useEffect(() => {
		fetchUsers();
	},[page]);

	const fetchUsers=async () => {
		const from=(page-1)*pageSize;
		const to=from+pageSize-1;

		const {data,error}=await supabase
			.from('users')
			.select('*')
			.range(from,to)
			.order('email',{ascending: true});

		if(data) setUsers(data);
		if(error) console.error(error.message);
	};

	const handleToggleAdmin=async (user: User) => {
		const updated={is_admin: !user.is_admin};

		const {error}=await supabase
			.from('users')
			.update(updated)
			.eq('id',user.id);

		if(!error) {
			setToastMessage(`User ${user.email} is now ${updated.is_admin? 'an admin':'not an admin'}`);
			fetchUsers();
		}
	};

	const nextPage=() => setPage((prev) => prev+1);
	const prevPage=() => setPage((prev) => (prev>1? prev-1:1));

	return (
		<IonPage>
			<IonHeader>
				<IonToolbar color="primary">
					<IonButtons slot="start">
						<IonMenuButton />
					</IonButtons>
					<IonTitle className="ion-text-center">Users</IonTitle>
				</IonToolbar>
			</IonHeader>

			<IonContent className="ion-padding">
				<IonList>
					{users.map((user) => (
						<IonItem key={user.id}>
							<IonLabel className="ion-text-wrap">
								<h2>{user.full_name||'No Name'}</h2>
								<p>{user.email}</p>
							</IonLabel>
							<IonToggle
								checked={user.is_admin}
								onIonChange={() => handleToggleAdmin(user)}
							>
								Admin
							</IonToggle>
						</IonItem>
					))}
				</IonList>
			</IonContent>

			<IonFooter className="ion-padding">
				<IonText color="medium">Page {page}</IonText>
				<div style={{display: 'flex',justifyContent: 'space-between',marginTop: 8}}>
					<IonButton onClick={prevPage} disabled={page===1}>
						Previous
					</IonButton>
					<IonButton onClick={nextPage}>Next</IonButton>
				</div>
			</IonFooter>

			<IonToast
				isOpen={!!toastMessage}
				onDidDismiss={() => setToastMessage('')}
				message={toastMessage}
				duration={1500}
			/>
		</IonPage>
	);
};

export default AdminUsers;
