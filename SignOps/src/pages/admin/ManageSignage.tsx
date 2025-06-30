import React, { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList,
  IonItem, IonLabel, IonInput, IonButton, IonModal, IonToast, IonButtons
} from '@ionic/react';
import { supabase } from '../../supbaseclient';
interface Signage {
  signage_id: number;
  name: string;
  description: string;
  base_price_per_sqm: number;
}

const AdminSignage: React.FC = () => {
  const [signages, setSignages] = useState<Signage[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [currentSignage, setCurrentSignage] = useState<Partial<Signage>>({});
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
	fetchSignages();
  }, []);

  const fetchSignages = async () => {
	const { data, error } = await supabase.from('signage_types').select('*');
	if (data) setSignages(data);
	if (error) console.error(error.message);
  };

  const handleSave = async () => {
	const isEdit = !!currentSignage.signage_id;
	const { name, description, base_price_per_sqm } = currentSignage;

	if (!name || base_price_per_sqm === undefined) {
	  setToastMessage('Name and base price are required.');
	  return;
	}

	if (isEdit) {
	  const { error } = await supabase
		.from('signage_types')
		.update({ name, description, base_price_per_sqm })
		.eq('signage_id', currentSignage.signage_id);
	  if (!error) setToastMessage('Signage updated.');
	} else {
	  const { error } = await supabase
		.from('signage_types')
		.insert({ name, description, base_price_per_sqm });
	  if (!error) setToastMessage('Signage added.');
	}

	setShowModal(false);
	setCurrentSignage({});
	fetchSignages();
  };

  const handleDelete = async (id: number) => {
	const { error } = await supabase
	  .from('signage_types')
	  .delete()
	  .eq('signage_id', id);

	if (!error) {
	  setToastMessage('Signage deleted.');
	  fetchSignages();
	}
  };

  return (
	<IonPage>
	  <IonHeader>
		<IonToolbar>
		  <IonTitle>Admin: Signage Types</IonTitle>
		  <IonButtons slot="end">
			<IonButton onClick={() => setShowModal(true)}>Add Signage</IonButton>
		  </IonButtons>
		</IonToolbar>
	  </IonHeader>

	  <IonContent className="ion-padding">
		<IonList>
		  {signages.map(s => (
			<IonItem key={s.signage_id}>
			  <IonLabel className="ion-text-wrap">
				<h2>{s.name}</h2>
				<p>{s.description}</p>
				<p>R{Number(s.base_price_per_sqm).toFixed(2)} / sqm</p>
			  </IonLabel>
			  <IonButton
				color="medium"
				slot="end"
				onClick={() => {
				  setCurrentSignage(s);
				  setShowModal(true);
				}}
			  >
				Edit
			  </IonButton>
			  <IonButton
				color="danger"
				slot="end"
				onClick={() => handleDelete(s.signage_id)}
			  >
				Delete
			  </IonButton>
			</IonItem>
		  ))}
		</IonList>
	  </IonContent>

	  {/* Modal */}
	  <IonModal isOpen={showModal} onDidDismiss={() => setShowModal(false)}>
		<IonHeader>
		  <IonToolbar>
			<IonTitle>{currentSignage.signage_id ? 'Edit' : 'Add'} Signage</IonTitle>
		  </IonToolbar>
		</IonHeader>
		<IonContent className="ion-padding">
		  <IonInput
			placeholder="Signage Name"
			value={currentSignage.name}
			onIonChange={e =>
			  setCurrentSignage({ ...currentSignage, name: e.detail.value! })
			}
		  />
		  <IonInput
			placeholder="Description (optional)"
			value={currentSignage.description}
			onIonChange={e =>
			  setCurrentSignage({ ...currentSignage, description: e.detail.value! })
			}
		  />
		  <IonInput
			placeholder="Base Price per sqm (R)"
			type="number"
			value={currentSignage.base_price_per_sqm}
			onIonChange={e =>
			  setCurrentSignage({
				...currentSignage,
				base_price_per_sqm: parseFloat(e.detail.value!),
			  })
			}
		  />
		  <IonButton expand="full" onClick={handleSave}>
			Save
		  </IonButton>
		  <IonButton expand="full" color="light" onClick={() => setShowModal(false)}>
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

export default AdminSignage;
