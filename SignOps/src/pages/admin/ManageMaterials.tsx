import React,{useEffect,useState} from 'react';
import {
	IonPage,IonHeader,IonToolbar,IonTitle,IonContent,IonList,
	IonItem,IonLabel,IonInput,IonButton,IonModal,IonToast,IonSelect,
	IonSelectOption,IonButtons,IonMenuButton,IonIcon,IonFab,IonFabButton
} from '@ionic/react';
import {addOutline,createOutline,trashBinOutline} from 'ionicons/icons';
import {supabase} from '../../supbaseclient';

interface Material {
	material_id: number;
	name: string;
	signage_id: number;
	price_per_sqm: number;
}

interface Signage {
	signage_id: number;
	name: string;
}

const AdminMaterials: React.FC=() => {
	const [materials,setMaterials]=useState<Material[]>([]);
	const [signages,setSignages]=useState<Signage[]>([]);
	const [currentMaterial,setCurrentMaterial]=useState<Partial<Material>>({});
	const [showModal,setShowModal]=useState(false);
	const [toastMessage,setToastMessage]=useState('');

	useEffect(() => {
		fetchData();
	},[]);

	const fetchData=async () => {
		const [matRes,sigRes]=await Promise.all([
			supabase.from('materials').select('*'),
			supabase.from('signage_types').select('signage_id, name')
		]);
		if(matRes.data) setMaterials(matRes.data);
		if(sigRes.data) setSignages(sigRes.data);
	};

	const handleSave=async () => {
		const isEdit=!!currentMaterial.material_id;
		const {name,signage_id,price_per_sqm}=currentMaterial;

		if(!name||!signage_id||price_per_sqm===undefined) {
			setToastMessage('All fields are required.');
			return;
		}

		const action=isEdit
			? supabase
				.from('materials')
				.update({name,signage_id,price_per_sqm})
				.eq('material_id',currentMaterial.material_id)
			:supabase
				.from('materials')
				.insert({name,signage_id,price_per_sqm});

		const {error}=await action;
		if(!error) setToastMessage(isEdit? 'Material updated.':'Material added.');

		setShowModal(false);
		setCurrentMaterial({});
		fetchData();
	};

	const handleDelete=async (id: number) => {
		const {error}=await supabase.from('materials').delete().eq('material_id',id);
		if(!error) {
			setToastMessage('Material deleted.');
			fetchData();
		}
	};

	return (
		<IonPage>
			<IonHeader>
				<IonToolbar color="primary">
					<IonButtons slot="start">
						<IonMenuButton />
					</IonButtons>
					<IonTitle className="ion-text-center">Admin: Materials</IonTitle>
				</IonToolbar>
			</IonHeader>

			<IonContent className="ion-padding">
				<IonList>
					{materials.map(m => (
						<IonItem key={m.material_id}>
							<IonLabel className="ion-text-wrap">
								<h2 className="text-lg font-bold">{m.name}</h2>
								<p className="text-sm text-medium">
									Signage: {signages.find(s => s.signage_id===m.signage_id)?.name||'—'}
								</p>
								<p className="text-sm text-muted">R{m.price_per_sqm.toFixed(2)} / sqm</p>
							</IonLabel>
							<IonButton
								color="medium"
								slot="end"
								onClick={() => {
									setCurrentMaterial(m);
									setShowModal(true);
								}}
							>
								<IonIcon slot="icon-only" icon={createOutline} />
							</IonButton>
							<IonButton
								color="danger"
								slot="end"
								onClick={() => handleDelete(m.material_id)}
							>
								<IonIcon slot="icon-only" icon={trashBinOutline} />
							</IonButton>
						</IonItem>
					))}
				</IonList>

				{/* FAB Button */}
				<IonFab vertical="bottom" horizontal="end" slot="fixed">
					<IonFabButton onClick={() => setShowModal(true)}>
						<IonIcon icon={addOutline} />
					</IonFabButton>
				</IonFab>
			</IonContent>

			{/* Modal */}
			<IonModal isOpen={showModal} onDidDismiss={() => setShowModal(false)}>
				<IonHeader>
					<IonToolbar>
						<IonTitle>{currentMaterial.material_id? 'Edit':'Add'} Material</IonTitle>
					</IonToolbar>
				</IonHeader>
				<IonContent className="ion-padding">
					<IonInput
						label="Material Name"
						labelPlacement="floating"
						fill="outline"
						value={currentMaterial.name}
						onIonChange={e => setCurrentMaterial({...currentMaterial,name: e.detail.value!})}
					/>
					<IonSelect
						label="Select Signage Type"
						labelPlacement="floating"
						fill="outline"
						value={currentMaterial.signage_id}
						onIonChange={e =>
							setCurrentMaterial({...currentMaterial,signage_id: e.detail.value})
						}
					>
						{signages.map(s => (
							<IonSelectOption key={s.signage_id} value={s.signage_id}>
								{s.name}
							</IonSelectOption>
						))}
					</IonSelect>
					<IonInput
						label="Price per sqm (R)"
						labelPlacement="floating"
						type="number"
						fill="outline"
						value={currentMaterial.price_per_sqm}
						onIonChange={e =>
							setCurrentMaterial({
								...currentMaterial,
								price_per_sqm: parseFloat(e.detail.value!),
							})
						}
					/>
					<IonButton expand="block" className="ion-margin-top" onClick={handleSave}>
						Save
					</IonButton>
					<IonButton
						expand="block"
						color="light"
						className="ion-margin-top"
						onClick={() => setShowModal(false)}
					>
						Cancel
					</IonButton>
				</IonContent>
			</IonModal>

			<IonToast
				isOpen={!!toastMessage}
				onDidDismiss={() => setToastMessage('')}
				message={toastMessage}
				duration={1500}
			/>
		</IonPage>
	);
};

export default AdminMaterials;
