import React,{useEffect,useState} from "react";
import {
	IonPage,
	IonHeader,
	IonToolbar,
	IonTitle,
	IonContent,
	IonButton,
	IonList,
	IonItem,
	IonLabel,
	IonInput,
	IonModal,
	IonToast,
	IonSelect,
	IonSelectOption,
	IonAlert,
	IonButtons,
	IonMenuButton,
} from "@ionic/react";
import {supabase} from "../../supbaseclient";

interface SignageType {
	signage_id: string;
	name: string;
	description: string;
	base_price_per_sqm: number;
}

interface Material {
	material_id: string;
	name: string;
	price_per_sqm: number;
}

interface LinkedMaterial extends Material {
	quantity_required: number;
}

export default function AdminSignage() {
	const [signages,setSignages]=useState<SignageType[]>([]);
	const [materials,setMaterials]=useState<Material[]>([]);
	const [linkedMaterials,setLinkedMaterials]=useState<LinkedMaterial[]>([]);
	const [selectedSignage,setSelectedSignage]=useState<Partial<SignageType>>({});
	const [selectedMaterial,setSelectedMaterial]=useState<string>("");
	const [materialQty,setMaterialQty]=useState<number>(1);

	const [showSignageModal,setShowSignageModal]=useState(false);
	const [showMaterialModal,setShowMaterialModal]=useState(false);
	const [newMaterial,setNewMaterial]=useState<Partial<Material>>({});
	const [toastMessage,setToastMessage]=useState("");

	// for editing material quantity
	const [editMaterialId,setEditMaterialId]=useState<string|null>(null);
	const [editQty,setEditQty]=useState<number>(1);
	const [showEditAlert,setShowEditAlert]=useState(false);

	useEffect(() => {
		fetchSignages();
		fetchMaterials();
	},[]);

	const fetchSignages=async () => {
		const {data,error}=await supabase.from("signage_types").select("*");
		if(!error&&data) setSignages(data);
	};

	const fetchMaterials=async () => {
		const {data,error}=await supabase.from("materials").select("*");
		if(!error&&data) setMaterials(data);
	};

	const fetchLinkedMaterials=async (signageId: string) => {
		const {data,error}=await supabase
			.from("signage_materials")
			.select(
				`
        quantity_required,
        materials (
          material_id,
          name,
          price_per_sqm
        )
      `
			)
			.eq("signage_id",signageId);

		if(!error&&data) {
			const formatted=data.map((d: any) => ({
				material_id: d.materials.material_id,
				name: d.materials.name,
				price_per_sqm: d.materials.price_per_sqm,
				quantity_required: d.quantity_required,
			}));
			setLinkedMaterials(formatted);
		}
	};

	const handleSaveSignage=async () => {
		if(!selectedSignage.name||!selectedSignage.base_price_per_sqm) {
			setToastMessage("Name and price are required.");
			return;
		}

		if(selectedSignage.signage_id) {
			const {error}=await supabase
				.from("signage_types")
				.update({
					name: selectedSignage.name,
					description: selectedSignage.description,
					base_price_per_sqm: selectedSignage.base_price_per_sqm,
				})
				.eq("signage_id",selectedSignage.signage_id);

			if(!error) setToastMessage("Signage updated.");
		} else {
			const {error}=await supabase.from("signage_types").insert({
				name: selectedSignage.name,
				description: selectedSignage.description,
				base_price_per_sqm: selectedSignage.base_price_per_sqm,
			});
			if(!error) setToastMessage("Signage added.");
		}

		setShowSignageModal(false);
		setSelectedSignage({});
		fetchSignages();
	};

	const handleDeleteSignage=async (id: string) => {
		const {error}=await supabase.from("signage_types").delete().eq("signage_id",id);
		if(!error) {
			setToastMessage("Signage deleted.");
			fetchSignages();
		}
	};

	const handleAddMaterialToSignage=async () => {
		if(!selectedSignage.signage_id||!selectedMaterial||!materialQty) {
			setToastMessage("Select signage, material, and quantity.");
			return;
		}

		const {error}=await supabase.from("signage_materials").insert({
			signage_id: selectedSignage.signage_id,
			material_id: selectedMaterial,
			quantity_required: materialQty,
		});

		if(!error) {
			setToastMessage("Material linked to signage.");
			setSelectedMaterial("");
			setMaterialQty(1);
			fetchLinkedMaterials(selectedSignage.signage_id);
		}
	};

	const handleRemoveMaterial=async (materialId: string) => {
		if(!selectedSignage.signage_id) return;

		const {error}=await supabase
			.from("signage_materials")
			.delete()
			.eq("signage_id",selectedSignage.signage_id)
			.eq("material_id",materialId);

		if(!error) {
			setToastMessage("Material removed.");
			fetchLinkedMaterials(selectedSignage.signage_id);
		}
	};

	const handleUpdateMaterialQty=async () => {
		if(!selectedSignage.signage_id||!editMaterialId) return;

		const {error}=await supabase
			.from("signage_materials")
			.update({quantity_required: editQty})
			.eq("signage_id",selectedSignage.signage_id)
			.eq("material_id",editMaterialId);

		if(!error) {
			setToastMessage("Material quantity updated.");
			fetchLinkedMaterials(selectedSignage.signage_id);
			setShowEditAlert(false);
			setEditMaterialId(null);
		}
	};

	const handleAddMaterial=async () => {
		if(!newMaterial.name||!newMaterial.price_per_sqm) {
			setToastMessage("Material name & price are required.");
			return;
		}

		const {error}=await supabase.from("materials").insert({
			name: newMaterial.name,
			price_per_sqm: newMaterial.price_per_sqm,
		});

		if(!error) {
			setToastMessage("Material added.");
			fetchMaterials();
			setShowMaterialModal(false);
			setNewMaterial({});
		}
	};

	return (
		<IonPage>
			<IonHeader>
				<IonToolbar color="primary">
					<IonButtons slot="start">
						<IonMenuButton />
					</IonButtons>
					<IonTitle className="ion-text-center">Signage Types</IonTitle>
				</IonToolbar>
			</IonHeader>

			<IonContent className="ion-padding">
				<IonButton expand="block" onClick={() => setShowSignageModal(true)}>
					+ Add Signage
				</IonButton>

				<IonList>
					{signages.map((s) => (
						<IonItem key={s.signage_id}>
							<IonLabel>
								<h2>{s.name}</h2>
								<p>{s.description}</p>
								<p>Base Price: R{s.base_price_per_sqm}</p>
							</IonLabel>
							<IonButton
								size="small"
								onClick={() => {
									setSelectedSignage(s);
									fetchLinkedMaterials(s.signage_id);
									setShowSignageModal(true);
								}}
							>
								Edit
							</IonButton>
							<IonButton color="danger" size="small" onClick={() => handleDeleteSignage(s.signage_id)}>
								Delete
							</IonButton>
						</IonItem>
					))}
				</IonList>

				{/* Signage Modal */}
				<IonModal isOpen={showSignageModal} onDidDismiss={() => setShowSignageModal(false)}>
					<IonHeader>
						<IonToolbar>
							<IonTitle>{selectedSignage.signage_id? "Edit Signage":"Add Signage"}</IonTitle>
						</IonToolbar>
					</IonHeader>
					<IonContent className="ion-padding">
						<IonInput
							placeholder="Name"
							value={selectedSignage.name||""}
							onIonChange={(e) => setSelectedSignage({...selectedSignage,name: e.detail.value!})}
						/>
						<IonInput
							placeholder="Description"
							value={selectedSignage.description||""}
							onIonChange={(e) => setSelectedSignage({...selectedSignage,description: e.detail.value!})}
						/>
						<IonInput
							type="number"
							placeholder="Base Price per sqm"
							value={selectedSignage.base_price_per_sqm||""}
							onIonChange={(e) =>
								setSelectedSignage({
									...selectedSignage,
									base_price_per_sqm: parseFloat(e.detail.value!)||0,
								})
							}
						/>

						{/* Linked Materials */}
						{selectedSignage.signage_id&&(
							<>
								<h3>Linked Materials</h3>
								<IonList>
									{linkedMaterials.length>0? (
										linkedMaterials.map((m) => (
											<IonItem key={m.material_id}>
												<IonLabel>
													{m.name} (R{m.price_per_sqm}) - Qty: {m.quantity_required}
												</IonLabel>
												<IonButton
													color="primary"
													size="small"
													onClick={() => {
														setEditMaterialId(m.material_id);
														setEditQty(m.quantity_required);
														setShowEditAlert(true);
													}}
												>
													Edit
												</IonButton>
												<IonButton
													color="danger"
													size="small"
													onClick={() => handleRemoveMaterial(m.material_id)}
												>
													Remove
												</IonButton>
											</IonItem>
										))
									):(
										<IonItem>
											<IonLabel>No materials linked yet.</IonLabel>
										</IonItem>
									)}
								</IonList>

								{/* Add Materials */}
								<IonSelect
									value={selectedMaterial}
									placeholder="Select Material"
									onIonChange={(e) => setSelectedMaterial(e.detail.value)}
								>
									{materials.map((m) => (
										<IonSelectOption key={m.material_id} value={m.material_id}>
											{m.name} (R{m.price_per_sqm})
										</IonSelectOption>
									))}
								</IonSelect>

								<IonInput
									type="number"
									placeholder="Quantity"
									value={materialQty}
									onIonChange={(e) => setMaterialQty(parseInt(e.detail.value!)||1)}
								/>

								<IonButton expand="block" onClick={handleAddMaterialToSignage}>
									Link Material
								</IonButton>

								<IonButton expand="block" color="secondary" onClick={() => setShowMaterialModal(true)}>
									+ Add New Material
								</IonButton>
							</>
						)}

						<IonButton expand="full" onClick={handleSaveSignage}>
							Save
						</IonButton>
						<IonButton expand="full" color="light" onClick={() => setShowSignageModal(false)}>
							Cancel
						</IonButton>
					</IonContent>
				</IonModal>

				{/* Edit Quantity Alert */}
				<IonAlert
					isOpen={showEditAlert}
					onDidDismiss={() => setShowEditAlert(false)}
					header="Edit Quantity"
					inputs={[
						{
							name: "quantity",
							type: "number",
							value: editQty,
							placeholder: "Enter new quantity",
						},
					]}
					buttons={[
						{
							text: "Cancel",
							role: "cancel",
							handler: () => {
								setShowEditAlert(false);
								setEditMaterialId(null);
							},
						},
						{
							text: "Save",
							handler: (data) => {
								const qty=parseInt(data.quantity)||1;
								setEditQty(qty);
								handleUpdateMaterialQty();
							},
						},
					]}
				/>

				{/* New Material Modal */}
				<IonModal isOpen={showMaterialModal} onDidDismiss={() => setShowMaterialModal(false)}>
					<IonHeader>
						<IonToolbar>
							<IonTitle>Add Material</IonTitle>
						</IonToolbar>
					</IonHeader>
					<IonContent className="ion-padding">
						<IonInput
							placeholder="Material Name"
							value={newMaterial.name||""}
							onIonChange={(e) => setNewMaterial({...newMaterial,name: e.detail.value!})}
						/>
						<IonInput
							placeholder="Price per sqm"
							type="number"
							value={newMaterial.price_per_sqm||""}
							onIonChange={(e) =>
								setNewMaterial({...newMaterial,price_per_sqm: parseFloat(e.detail.value!)||0})
							}
						/>
						<IonButton expand="full" onClick={handleAddMaterial}>
							Save
						</IonButton>
						<IonButton expand="full" color="light" onClick={() => setShowMaterialModal(false)}>
							Cancel
						</IonButton>
					</IonContent>
				</IonModal>

				<IonToast
					isOpen={!!toastMessage}
					message={toastMessage}
					duration={2000}
					onDidDismiss={() => setToastMessage("")}
				/>
			</IonContent>
		</IonPage>
	);
}
