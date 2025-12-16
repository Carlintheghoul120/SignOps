// QuoteNew.tsx - Multi-signage with 3 key fixes
// FIX 1: Customer autofill working
// FIX 2: Materials editable via modal, mobile-friendly scrollable list
// FIX 3: Mandatory addon review via modal

import React,{useEffect,useState} from "react";
import {
	IonPage,IonHeader,IonToolbar,IonTitle,IonContent,IonInput,IonLabel,IonItem,
	IonButton,IonSelect,IonSelectOption,IonCard,IonCardHeader,IonCardTitle,IonCardContent,
	IonText,IonGrid,IonRow,IonCol,IonButtons,IonMenuButton,IonToast,IonModal,
	IonItemDivider,IonIcon,IonToggle,IonBadge
} from "@ionic/react";
import {closeCircle,checkmarkCircle,alertCircle} from "ionicons/icons";
import {supabase} from "../../supbaseclient";
import PreviewQuote from "./PreviewQuote";

const safeFloat=(v: any,fallback=0) => {const n=parseFloat(String(v??"").trim()); return Number.isFinite(n)? n:fallback;};
const safeInt=(v: any,fallback=0) => {const n=parseInt(String(v??"").trim(),10); return Number.isFinite(n)? n:fallback;};
const mmToMeters=(mm: number) => Number(mm)/1000;

interface MiscItem {name: string; quantity: number; unit_price: number;}
interface Signage {signage_id: number; name: string;}
interface Addon {addon_id: number; name: string; description?: string; flat_rate?: number|null; per_sqm_rate?: number|null; is_flat?: boolean|null;}
interface LinkedMaterialRow {material_id: number; name: string; price?: number|null; price_per_unit?: number|null; unit_type?: string|null; quantity_required: number; scale_with_area: boolean; calculation_method?: string|null;}

const QuoteNew: React.FC=() => {
	const [section,setSection]=useState(0);
	const [toastMsg,setToastMsg]=useState("");
	const [quoteId,setQuoteId]=useState<string|null>(null);
	const [userId,setUserId]=useState<string|null>(null);
	const [submitting,setSubmitting]=useState(false);
	const [customers,setCustomers]=useState<any[]>([]);
	const [signages,setSignages]=useState<Signage[]>([]);
	const [addons,setAddons]=useState<Addon[]>([]);
	const [linkedMaterialsBySignage,setLinkedMaterialsBySignage]=useState<Record<number,LinkedMaterialRow[]>>({});
	const [reviewedAddons,setReviewedAddons]=useState<Set<number>>(new Set());

	// Material editing modal state
	const [materialModalOpen,setMaterialModalOpen]=useState(false);
	const [editingMaterialIdx,setEditingMaterialIdx]=useState<number|null>(null);
	const [tempMaterialQty,setTempMaterialQty]=useState<number>(1);

	// Addon modal state
	const [addonModalOpen,setAddonModalOpen]=useState(false);
	const [activeAddon,setActiveAddon]=useState<Addon|null>(null);
	const [activeAddonSelection,setActiveAddonSelection]=useState<{selected: boolean; override_flat_rate?: number|null; override_per_sqm_rate?: number|null}|null>(null);

	const [form,setForm]=useState({
		company_name: "",contact_name: "",contact_email: "",contact_phone: "",client_address: "",
		customer_id: null as string|null,
		selectedSignages: [] as {signage_id: number; width_mm: number; height_mm: number}[],
		distance_km: 0,
		addon_selections: {} as Record<number,{selected: boolean; override_flat_rate?: number|null; override_per_sqm_rate?: number|null}>,
		misc_items: [] as MiscItem[],
		material_overrides: {} as Record<number,{quantity_required?: number}>
	});

	useEffect(() => {fetchData(); getUser();},[]);
	useEffect(() => {form.selectedSignages.forEach(s => {if(!linkedMaterialsBySignage[s.signage_id]) fetchMaterials(s.signage_id);});},[form.selectedSignages]);

	const linkedMaterials=React.useMemo(() => {
		const allMaterials=Object.values(linkedMaterialsBySignage).flat();
		return allMaterials.map(m => ({
			...m,
			quantity_required: form.material_overrides[m.material_id]?.quantity_required??m.quantity_required
		}));
	},[linkedMaterialsBySignage,form.material_overrides]);

	const getUser=async () => {const {data}=await supabase.auth.getUser(); setUserId(data.user?.id??null);};

	const fetchData=async () => {
		const [sigs,adds,custs]=await Promise.all([
			supabase.from("signage_types").select("*").order("name"),
			supabase.from("addons").select("*").order("name"),
			supabase.from("customers").select("*").order("company_name"),
		]);
		setSignages(sigs.data||[]); setAddons(adds.data||[]); setCustomers(custs.data||[]);
	};

	const fetchMaterials=async (signageId: number) => {
		const {data}=await supabase.from("signage_materials")
			.select(`quantity_required, scale_with_area, calculation_method, materials(material_id, name, price, price_per_unit, unit_type)`)
			.eq("signage_id",signageId);
		const flattened=(data||[]).map((row: any) => ({
			material_id: row.materials.material_id,name: row.materials.name,price: row.materials.price,
			price_per_unit: row.materials.price_per_unit??row.materials.price,unit_type: row.materials.unit_type??"sqm",
			quantity_required: row.quantity_required??1,scale_with_area: row.scale_with_area??true,
			calculation_method: row.calculation_method??"area"
		}));
		setLinkedMaterialsBySignage(prev => ({...prev,[signageId]: flattened}));
	};

	// FIX 1: Autofill customer details when selecting from dropdown
	const handleCustomerSelect=(customerId: string|null) => {
		if(!customerId) {
			setForm(f => ({...f,customer_id: null,company_name: "",contact_name: "",contact_email: "",contact_phone: "",client_address: ""}));
			return;
		}
		const customer=customers.find(c => c.id===customerId);
		if(customer) {
			setForm(f => ({
				...f,customer_id: customerId,company_name: customer.company_name||"",
				contact_name: customer.contact_name||"",contact_email: customer.contact_email||"",
				contact_phone: customer.contact_phone||"",client_address: customer.address||""
			}));
		}
	};

	// FIX 2: Material editing via modal (quantity only, not price)
	const openMaterialModal=(idx: number) => {
		const material=linkedMaterials[idx];
		setEditingMaterialIdx(idx);
		setTempMaterialQty(material.quantity_required);
		setMaterialModalOpen(true);
	};

	const saveMaterialModal=() => {
		if(editingMaterialIdx===null) return;
		const material=linkedMaterials[editingMaterialIdx];
		setForm(f => ({
			...f,
			material_overrides: {
				...f.material_overrides,
				[material.material_id]: {quantity_required: tempMaterialQty}
			}
		}));
		setMaterialModalOpen(false); setEditingMaterialIdx(null);
	};

	// FIX 3: Mandatory addon review via modal
	const openAddonModal=(a: Addon) => {
		const sel=form.addon_selections[a.addon_id]??{
			selected: false,override_flat_rate: a.flat_rate??null,override_per_sqm_rate: a.per_sqm_rate??null
		};
		setActiveAddon(a); setActiveAddonSelection({...sel}); setAddonModalOpen(true);
	};

	const saveAddonModal=() => {
		if(!activeAddon||!activeAddonSelection) {setAddonModalOpen(false); return;}
		setForm((f) => ({...f,addon_selections: {...f.addon_selections,[activeAddon.addon_id]: activeAddonSelection}}));
		setReviewedAddons(prev => new Set(prev).add(activeAddon.addon_id));
		setAddonModalOpen(false);
	};

	const handleAddMiscItem=() => {setForm((f) => ({...f,misc_items: [...f.misc_items,{name: "",quantity: 1,unit_price: 0}]}));};
	const handleRemoveMiscItem=(idx: number) => {setForm((f) => {const copy=[...f.misc_items]; copy.splice(idx,1); return {...f,misc_items: copy};});};

	// Cost calculations (simplified for demo - use first signage dimensions)
	const firstSignage=form.selectedSignages[0];
	const widthMeters=firstSignage? mmToMeters(firstSignage.width_mm):1;
	const heightMeters=firstSignage? mmToMeters(firstSignage.height_mm):1;
	const areaMeters=widthMeters*heightMeters;
	const perimeterMeters=2*(widthMeters+heightMeters);

	const costs=React.useMemo(() => {
		let signageCost=0,materialCost=0;
		linkedMaterials.forEach((m) => {
			const unitPrice=safeFloat(m.price_per_unit??m.price??0);
			const baseQty=safeFloat(m.quantity_required??1);
			const calcMethod=(m.calculation_method||"").toLowerCase();
			const utype=(m.unit_type||"").toLowerCase();
			let qtyMultiplier=1;
			if(calcMethod==="perimeter"||utype==="meter") qtyMultiplier=perimeterMeters;
			else if(calcMethod==="area"||utype==="sqm") qtyMultiplier=areaMeters;
			else qtyMultiplier=m.scale_with_area? areaMeters:1;
			const quantityUsed=baseQty*qtyMultiplier;
			if(m.scale_with_area) signageCost+=unitPrice*quantityUsed;
			else materialCost+=unitPrice*quantityUsed;
		});

		let addonCost=0;

		Object.entries(form.addon_selections).forEach(([addonIdStr,sel]) => {
			if(!sel.selected) return;

			const addon=addons.find(a => a.addon_id===Number(addonIdStr));
			if(!addon) return;

			const flat=
				safeFloat(sel.override_flat_rate)??
				safeFloat(addon.flat_rate);

			const perSqm=
				safeFloat(sel.override_per_sqm_rate)??
				safeFloat(addon.per_sqm_rate);

			// RULE:
			// If per_sqm_rate exists → per sqm
			// Else → flat
			if(Number.isFinite(perSqm)&&perSqm>0) {
				addonCost+=perSqm*areaMeters;
			} else if(Number.isFinite(flat)) {
				addonCost+=flat;
			}
		});
		const miscCost=form.misc_items.reduce((s,mi) => s+safeFloat(mi.quantity)*safeFloat(mi.unit_price),0);
		const petrolFee=Math.max(0,form.distance_km-5)*6.5;
		return {signageCost,materialCost,addonCost,miscCost,petrolFee,total: signageCost+materialCost+addonCost+miscCost+petrolFee};
	},[linkedMaterials,form,addons,areaMeters]);

	const canGoNext0=!!(form.company_name||form.contact_name);
	const canGoNext1=form.selectedSignages.length>0&&form.selectedSignages.every(s => s.signage_id>0&&s.width_mm>0&&s.height_mm>0);
	const allAddonsReviewed=addons.every(a => reviewedAddons.has(a.addon_id));

	const handleSubmit=async () => {
		if(!allAddonsReviewed) {
			setToastMsg("Please review all add-ons.");
			return;
		}
		if(!userId||!canGoNext1) {
			setToastMsg("Missing required fields.");
			return;
		}
		setSubmitting(true);

		try {
			let customerId=form.customer_id;
			if(!customerId) {
				const {data,error}=await supabase.from("customers").insert({
					company_name: form.company_name,
					contact_name: form.contact_name,
					contact_email: form.contact_email,
					contact_phone: form.contact_phone,
					address: form.client_address
				}).select().single();
				if(error||!data) {setToastMsg("Failed to create customer."); setSubmitting(false); return;}
				customerId=data.id;
			}

			// 1️⃣ Insert quote header (no costs, no dimensions)
			const {data: quoteData,error: quoteError}=await supabase.from("quotes").insert({
				user_id: userId,
				company_name: form.company_name,
				contact_name: form.contact_name,
				contact_email: form.contact_email,
				contact_phone: form.contact_phone,
				client_address: form.client_address,
				customer_id: customerId,
				google_distance_km: form.distance_km,
				petrol_fee: costs.petrolFee
			}).select().single();
			if(quoteError||!quoteData) throw quoteError;
			const newQuoteId=quoteData.quote_id;

			// 2️⃣ Insert quote_signages
			await supabase.from("quote_signages").insert(
				form.selectedSignages.map(s => ({
					quote_id: newQuoteId,
					signage_id: s.signage_id,
					width_m: mmToMeters(s.width_mm),
					height_m: mmToMeters(s.height_mm)
					// Optionally add computed signage_cost per signage if you want
				}))
			);

			// 3️⃣ Insert materials (flat list, quantities adjusted by overrides)
			if(linkedMaterials.length) {
				await supabase.from("quote_materials").insert(linkedMaterials.map(m => ({
					quote_id: newQuoteId,
					material_id: m.material_id,
					quantity: m.quantity_required,
					unit_price: safeFloat(m.price_per_unit??m.price)
				})));
			}

			// 4️⃣ Insert addons
			const selectedAddons=Object.entries(form.addon_selections)
				.filter(([_,v]) => v.selected)
				.map(([k,v]) => ({
					quote_id: newQuoteId,
					addon_id: Number(k),
					override_flat_rate: v.override_flat_rate??null,
					override_per_sqm_rate: v.override_per_sqm_rate??null
				}));
			if(selectedAddons.length) await supabase.from("quote_addons").insert(selectedAddons);

			// 5️⃣ Insert misc items
			const miscToInsert=form.misc_items.filter(m => m.name.trim()).map(m => ({
				quote_id: newQuoteId,
				name: m.name,
				quantity: m.quantity,
				unit_price: m.unit_price
			}));
			if(miscToInsert.length) await supabase.from("quote_misc_items").insert(miscToInsert);

			setQuoteId(newQuoteId);
			setToastMsg("Quote submitted!");
			setSection(3);

		} catch(e) {
			console.error(e);
			setToastMsg("Failed to save quote.");
		} finally {
			setSubmitting(false);
		}
	};


	return (
		<IonPage>
			<IonHeader><IonToolbar color="primary"><IonButtons slot="start"><IonMenuButton /></IonButtons><IonTitle>Quote Builder</IonTitle></IonToolbar></IonHeader>
			<IonContent className="ion-padding">
				<IonGrid><IonRow className="ion-justify-content-center"><IonCol sizeMd="8" sizeLg="6">
					<IonCard>
						<IonCardHeader><IonCardTitle>Step {section+1} of 4</IonCardTitle></IonCardHeader>
						<IonCardContent>
							{section===0&&(<>
								<IonItem><IonLabel>Existing Customer</IonLabel>
									<IonSelect value={form.customer_id} placeholder="Select or create new" onIonChange={(e) => handleCustomerSelect(e.detail.value)}>
										<IonSelectOption value={null}>Create New</IonSelectOption>
										{customers.map(c => <IonSelectOption key={c.id} value={c.id}>{c.company_name}</IonSelectOption>)}
									</IonSelect>
								</IonItem>
								<IonItem><IonLabel position="stacked">Company Name *</IonLabel><IonInput value={form.company_name} onIonChange={e => setForm({...form,company_name: e.detail.value??""})} /></IonItem>
								<IonItem><IonLabel position="stacked">Contact Name *</IonLabel><IonInput value={form.contact_name} onIonChange={e => setForm({...form,contact_name: e.detail.value??""})} /></IonItem>
								<IonItem><IonLabel position="stacked">Email</IonLabel><IonInput type="email" value={form.contact_email} onIonChange={e => setForm({...form,contact_email: e.detail.value??""})} /></IonItem>
								<IonItem><IonLabel position="stacked">Phone</IonLabel><IonInput value={form.contact_phone} onIonChange={e => setForm({...form,contact_phone: e.detail.value??""})} /></IonItem>
								<IonItem><IonLabel position="stacked">Address</IonLabel><IonInput value={form.client_address} onIonChange={e => setForm({...form,client_address: e.detail.value??""})} /></IonItem>
								<IonButton expand="block" style={{marginTop: 16}} onClick={() => setSection(1)} disabled={!canGoNext0}>Next</IonButton>
							</>)}
							{section===1&&(<>
								<IonButton expand="block" onClick={() => setForm(f => ({...f,selectedSignages: [...f.selectedSignages,{signage_id: 0,width_mm: 1000,height_mm: 1000}]}))}>Add Signage</IonButton>
								{form.selectedSignages.map((s,idx) => (
									<IonCard key={idx} style={{marginTop: 12}}>
										<IonCardContent>
											<div style={{display: "flex",justifyContent: "space-between",marginBottom: 8}}>
												<strong>Signage {idx+1}</strong>
												<IonButton size="small" fill="clear" color="danger" onClick={() => {const copy=[...form.selectedSignages]; copy.splice(idx,1); setForm({...form,selectedSignages: copy});}}>
													<IonIcon icon={closeCircle} />
												</IonButton>
											</div>
											<IonItem><IonLabel>Type</IonLabel>
												<IonSelect value={s.signage_id} onIonChange={e => {const copy=[...form.selectedSignages]; copy[idx].signage_id=e.detail.value; setForm({...form,selectedSignages: copy});}}>
													{signages.map(sig => <IonSelectOption key={sig.signage_id} value={sig.signage_id}>{sig.name}</IonSelectOption>)}
												</IonSelect>
											</IonItem>
											<IonItem><IonLabel position="stacked">Width (mm)</IonLabel><IonInput type="number" value={s.width_mm} onIonChange={e => {const copy=[...form.selectedSignages]; copy[idx].width_mm=safeInt(e.detail.value,1000); setForm({...form,selectedSignages: copy});}} /></IonItem>
											<IonItem><IonLabel position="stacked">Height (mm)</IonLabel><IonInput type="number" value={s.height_mm} onIonChange={e => {const copy=[...form.selectedSignages]; copy[idx].height_mm=safeInt(e.detail.value,1000); setForm({...form,selectedSignages: copy});}} /></IonItem>
										</IonCardContent>
									</IonCard>
								))}
								<IonItem style={{marginTop: 16}}><IonLabel position="stacked">Distance (km)</IonLabel><IonInput type="number" value={form.distance_km} onIonChange={e => setForm({...form,distance_km: safeFloat(e.detail.value)})} /></IonItem>
								<div style={{display: "flex",gap: 8,marginTop: 16}}>
									<IonButton expand="block" onClick={() => setSection(2)} disabled={!canGoNext1}>Next</IonButton>
									<IonButton expand="block" fill="outline" onClick={() => setSection(0)}>Back</IonButton>
								</div>
							</>)}
							{section===2&&(<>
								<IonText><h3>Materials</h3></IonText>
								<IonText color="medium" style={{fontSize: 13}}><p>Tap to edit quantity</p></IonText>
								<div style={{maxHeight: "30vh",overflowY: "auto",marginBottom: 16}}>
									{linkedMaterials.length===0? <IonCard><IonCardContent>No materials</IonCardContent></IonCard>:
										linkedMaterials.map((m,idx) => (
											<IonCard key={m.material_id} button onClick={() => openMaterialModal(idx)} style={{marginBottom: 8}}>
												<IonCardContent style={{padding: 10}}>
													<div style={{display: "flex",justifyContent: "space-between"}}>
														<div>
															<div style={{fontWeight: 600}}>{m.name}</div>
															<div style={{fontSize: 12,color: "#666"}}>Qty: {m.quantity_required}</div>
														</div>
														{form.material_overrides[m.material_id]&&<IonIcon icon={checkmarkCircle} color="success" />}
													</div>
												</IonCardContent>
											</IonCard>
										))
									}
								</div>
								<IonModal isOpen={materialModalOpen} onDidDismiss={() => setMaterialModalOpen(false)}>
									<IonHeader><IonToolbar><IonTitle>Edit Material</IonTitle><IonButtons slot="end"><IonButton onClick={() => setMaterialModalOpen(false)}>Close</IonButton></IonButtons></IonToolbar></IonHeader>
									<IonContent className="ion-padding">
										{editingMaterialIdx!==null&&linkedMaterials[editingMaterialIdx]&&(<>
											<h3>{linkedMaterials[editingMaterialIdx].name}</h3>
											<p style={{color: "#666",fontSize: 14,marginBottom: 16}}>
												{linkedMaterials[editingMaterialIdx].calculation_method==='perimeter'||linkedMaterials[editingMaterialIdx].unit_type==='meter'
													? 'Charged per meter of perimeter'
													:linkedMaterials[editingMaterialIdx].calculation_method==='area'||linkedMaterials[editingMaterialIdx].unit_type==='sqm'
														? 'Charged per square meter of area'
														:'Charged per unit'}
											</p>
											<IonItem style={{marginTop: 16}}>
												<IonLabel position="stacked">
													{linkedMaterials[editingMaterialIdx].calculation_method==='perimeter'||linkedMaterials[editingMaterialIdx].unit_type==='meter'
														? 'Perimeter multiplier'
														:linkedMaterials[editingMaterialIdx].calculation_method==='area'||linkedMaterials[editingMaterialIdx].unit_type==='sqm'
															? 'Area multiplier'
															:'Number of units'}
												</IonLabel>
												<IonInput type="number" value={tempMaterialQty} onIonChange={e => setTempMaterialQty(safeFloat(e.detail.value,1))} />
											</IonItem>
											<IonButton expand="block" style={{marginTop: 24}} onClick={saveMaterialModal}>Save</IonButton>
										</>)}
									</IonContent>
								</IonModal>

								<IonItemDivider style={{marginTop: 16}}><IonLabel>Add-ons {!allAddonsReviewed&&<IonIcon icon={alertCircle} color="danger" />}</IonLabel></IonItemDivider>
								<IonText color="medium" style={{fontSize: 13}}><p>Review each add-on before submitting</p></IonText>
								<div style={{maxHeight: "30vh",overflowY: "auto",marginBottom: 16}}>
									{addons.map(a => {
										const sel=form.addon_selections[a.addon_id]; const reviewed=reviewedAddons.has(a.addon_id);
										return (
											<IonCard key={a.addon_id} button onClick={() => openAddonModal(a)} style={{marginBottom: 8}}>
												<IonCardContent style={{padding: 10}}>
													<div style={{display: "flex",justifyContent: "space-between",alignItems: "center"}}>
														<div>
															<div style={{fontWeight: 600}}>{a.name}</div>
															<div style={{fontSize: 12,color: "#666"}}>{a.is_flat? `R${a.flat_rate}`:`R${a.per_sqm_rate}/m²`}</div>
														</div>
														<div>
															{sel?.selected&&<IonBadge color="success">Selected</IonBadge>}
															{!reviewed&&<IonIcon icon={alertCircle} color="warning" />}
															{reviewed&&!sel?.selected&&<IonIcon icon={checkmarkCircle} color="medium" />}
														</div>
													</div>
												</IonCardContent>
											</IonCard>
										);
									})}
								</div>
								<IonModal isOpen={addonModalOpen} onDidDismiss={() => setAddonModalOpen(false)}>
									<IonHeader><IonToolbar><IonTitle>Review Add-on</IonTitle><IonButtons slot="end"><IonButton onClick={() => setAddonModalOpen(false)}>Close</IonButton></IonButtons></IonToolbar></IonHeader>
									<IonContent className="ion-padding">
										{activeAddon&&activeAddonSelection&&(<>
											<h3>{activeAddon.name}</h3>
											<p style={{color: "#666"}}>{activeAddon.description}</p>
											<IonItem style={{marginTop: 16}}><IonLabel>Include this add-on?</IonLabel><IonToggle checked={activeAddonSelection.selected} onIonChange={e => setActiveAddonSelection({...activeAddonSelection,selected: e.detail.checked})} /></IonItem>
											{activeAddon.is_flat? (
												<IonItem><IonLabel position="stacked">Flat Rate (R)</IonLabel><IonInput type="number" value={activeAddonSelection.override_flat_rate??activeAddon.flat_rate??""} onIonChange={e => setActiveAddonSelection({...activeAddonSelection,override_flat_rate: e.detail.value? safeFloat(e.detail.value):null})} /></IonItem>
											):(
												<IonItem><IonLabel position="stacked">Rate per m² (R)</IonLabel><IonInput type="number" value={activeAddonSelection.override_per_sqm_rate??activeAddon.per_sqm_rate??""} onIonChange={e => setActiveAddonSelection({...activeAddonSelection,override_per_sqm_rate: e.detail.value? safeFloat(e.detail.value):null})} /></IonItem>
											)}
											<IonButton expand="block" style={{marginTop: 24}} onClick={saveAddonModal}>Confirm</IonButton>
										</>)}
									</IonContent>
								</IonModal>

								<IonItemDivider style={{marginTop: 16}}>Misc Items</IonItemDivider>
								<IonButton size="small" onClick={handleAddMiscItem}>Add Misc Item</IonButton>
								{form.misc_items.map((m,idx) => (
									<IonCard key={idx} style={{marginTop: 8}}>
										<IonCardContent style={{padding: 10}}>
											<div style={{display: "flex",justifyContent: "space-between",marginBottom: 8}}>
												<strong>{m.name||`Item ${idx+1}`}</strong>
												<IonIcon icon={closeCircle} onClick={() => handleRemoveMiscItem(idx)} />
											</div>
											<IonItem><IonLabel position="stacked">Name</IonLabel><IonInput value={m.name} onIonChange={e => {const copy=[...form.misc_items]; copy[idx].name=e.detail.value??""; setForm({...form,misc_items: copy});}} /></IonItem>
											<IonItem><IonLabel position="stacked">Quantity</IonLabel><IonInput type="number" value={m.quantity} onIonChange={e => {const copy=[...form.misc_items]; copy[idx].quantity=safeInt(e.detail.value,1); setForm({...form,misc_items: copy});}} /></IonItem>
											<IonItem><IonLabel position="stacked">Unit Price (R)</IonLabel><IonInput type="number" value={m.unit_price} onIonChange={e => {const copy=[...form.misc_items]; copy[idx].unit_price=safeFloat(e.detail.value); setForm({...form,misc_items: copy});}} /></IonItem>
										</IonCardContent>
									</IonCard>
								))}

								<IonText style={{marginTop: 16}}>
									<p><strong>Signage:</strong> R{costs.signageCost.toFixed(2)}</p>
									<p><strong>Add-ons:</strong> R{costs.addonCost.toFixed(2)}</p>
									<p><strong>Misc:</strong> R{costs.miscCost.toFixed(2)}</p>
									<p><strong>Petrol:</strong> R{costs.petrolFee.toFixed(2)}</p>
									<p><strong>Total:</strong> R{costs.total.toFixed(2)}</p>
								</IonText>
								<div style={{display: "flex",gap: 8,marginTop: 16}}>
									<IonButton expand="block" onClick={handleSubmit} disabled={submitting||!allAddonsReviewed}>
										{submitting? "Submitting...":"Submit Quote"}
									</IonButton>
									<IonButton expand="block" fill="outline" onClick={() => setSection(1)}>Back</IonButton>
								</div>
							</>)}
							{section===3&&quoteId&&<PreviewQuote quoteId={quoteId} />}
						</IonCardContent>
					</IonCard>
				</IonCol></IonRow></IonGrid>
				<IonToast isOpen={!!toastMsg} message={toastMsg} duration={3000} onDidDismiss={() => setToastMsg("")} />
			</IonContent>
		</IonPage>
	);
};

export default QuoteNew;