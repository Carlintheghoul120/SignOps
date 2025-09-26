import React,{useEffect,useState} from "react";
import {
	IonPage,
	IonHeader,
	IonToolbar,
	IonTitle,
	IonContent,
	IonButtons,
	IonMenuButton,
	IonSegment,
	IonSegmentButton,
	IonLabel,
	IonCard,
	IonCardHeader,
	IonCardTitle,
	IonCardContent,
	IonItem,
	IonInput,
	IonTextarea,
	IonButton,
	IonIcon,
	IonSelect,
	IonSelectOption,
	IonList,
	IonCheckbox,
	IonItemDivider,
} from "@ionic/react";
import {addCircle,trashBin} from "ionicons/icons";
import {supabase} from "../../supbaseclient";

type TaskItem={title: string; description: string};

const AdminTaskTemplates: React.FC=() => {
	// ------------------- Segment -------------------
	const [segment,setSegment]=useState<"templates"|"jobcards">("templates");

	// ------------------- Data -------------------
	const [templates,setTemplates]=useState<any[]>([]);
	const [jobCards,setJobCards]=useState<any[]>([]);
	const [quotes,setQuotes]=useState<{id: string; label: string}[]>([]);
	const [users,setUsers]=useState<{id: string; name: string}[]>([]);

	// ------------------- Template Form -------------------
	const [templateName,setTemplateName]=useState("");
	const [tasks,setTasks]=useState<TaskItem[]>([{title: "",description: ""}]);

	// ------------------- Job Card Form -------------------
	const [selectedTemplate,setSelectedTemplate]=useState<string|null>(null);
	const [jobName,setJobName]=useState("");
	const [jobQuoteId,setJobQuoteId]=useState<string|null>(null);
	const [jobUserId,setJobUserId]=useState<string|null>(null);

	// ------------------- Fetch Data -------------------
	useEffect(() => {
		fetchTemplates();
		fetchJobCards();
		fetchQuotes();
		fetchUsers();
	},[]);

	const fetchTemplates=async () => {
		const {data}=await supabase
			.from("task_templates")
			.select("id, name, task_template_items(id, title, description, position)")
			.order("created_at",{ascending: false});
		if(data) setTemplates(data);
	};

	const fetchJobCards=async () => {
		const {data}=await supabase
			.from("job_cards")
			.select(
				`id, name, status, created_at, updated_at,
         job_card_tasks(id, title, description, is_completed, position,
           job_card_subtasks(id, title, is_completed, position)
         )`
			)
			.order("created_at",{ascending: false});
		if(data) setJobCards(data);
	};
	const fetchQuotes=async () => {
		const {data,error}=await supabase
			.from("quotes")
			.select(`
      quote_id,
      contact_name,
      signage_types!quotes_signage_id_fkey(name)
    `)
			.order("created_at",{ascending: false});

		if(error) {
			console.error("Error fetching quotes:",error);
			return;
		}

		if(data) {
			const mapped=data.map((q: any) => ({
				id: q.quote_id,
				// signage_types will always be an array, so check [0]
				label: `${q.signage_types?.name??"Unknown"} (Contact: ${q.contact_name})`,
			}));
			setQuotes(mapped);
		}
	};

	const fetchUsers=async () => {
		const {data}=await supabase.from("users").select("user_id, name").order("name");
		if(data) {
			const mapped=data.map((u) => ({id: u.user_id,name: u.name}));
			setUsers(mapped);
		}
	};

	// ------------------- Template Handlers -------------------
	const handleTaskChange=(i: number,field: keyof TaskItem,value: string) => {
		const updated=[...tasks];
		updated[i][field]=value;
		setTasks(updated);
	};
	const addTask=() => setTasks([...tasks,{title: "",description: ""}]);
	const removeTask=(i: number) => setTasks(tasks.filter((_,idx) => idx!==i));

	const saveTemplate=async () => {
		if(!templateName.trim()) return;
		const {data: template}=await supabase
			.from("task_templates")
			.insert([{name: templateName}])
			.select()
			.single();
		if(!template) return;

		await supabase.from("task_template_items").insert(
			tasks.map((t,idx) => ({
				template_id: template.id,
				title: t.title,
				description: t.description,
				position: idx,
			}))
		);

		setTemplateName("");
		setTasks([{title: "",description: ""}]);
		fetchTemplates();
	};

	// ------------------- Job Card Handlers -------------------
	const createJobCard=async () => {
		if(!selectedTemplate||!jobQuoteId||!jobUserId) return;
		await supabase.rpc("generate_job_card_from_template",{
			p_template_id: selectedTemplate,
			p_quote_id: jobQuoteId,
			p_user_id: jobUserId,
			p_name: jobName||null,
		});
		setSelectedTemplate(null);
		setJobName("");
		setJobQuoteId(null);
		setJobUserId(null);
		fetchJobCards();
	};

	// ------------------- JSX -------------------
	return (
		<IonPage>
			<IonHeader>
				<IonToolbar color="primary">
					<IonButtons slot="start">
						<IonMenuButton />
					</IonButtons>
					<IonTitle className="ion-text-center">Templates & Job Cards</IonTitle>
				</IonToolbar>
				<IonToolbar>
					<IonSegment value={segment} onIonChange={(e) => setSegment(e.detail.value as any)}>
						<IonSegmentButton value="templates">
							<IonLabel>Templates</IonLabel>
						</IonSegmentButton>
						<IonSegmentButton value="jobcards">
							<IonLabel>Job Cards</IonLabel>
						</IonSegmentButton>
					</IonSegment>
				</IonToolbar>
			</IonHeader>

			<IonContent className="ion-padding">
				{/* ==================== Templates ==================== */}
				{segment==="templates"&&(
					<>
						<IonCard>
							<IonCardHeader>
								<IonCardTitle>Create New Template</IonCardTitle>
							</IonCardHeader>
							<IonCardContent>
								<IonInput
									placeholder="Template Name"
									value={templateName}
									onIonChange={(e) => setTemplateName(e.detail.value!)}
									className="ion-margin-bottom"
								/>
								{tasks.map((task,idx) => (
									<IonItem key={idx}>
										<IonInput
											placeholder="Task Title"
											value={task.title}
											onIonChange={(e) => handleTaskChange(idx,"title",e.detail.value!)}
										/>
										<IonTextarea
											placeholder="Description"
											value={task.description}
											onIonChange={(e) => handleTaskChange(idx,"description",e.detail.value!)}
										/>
										<IonButton fill="clear" color="danger" onClick={() => removeTask(idx)}>
											<IonIcon icon={trashBin} />
										</IonButton>
									</IonItem>
								))}
								<IonButton fill="outline" expand="block" onClick={addTask} className="ion-margin-top">
									<IonIcon icon={addCircle} slot="start" /> Add Task
								</IonButton>
								<IonButton expand="block" className="ion-margin-top" onClick={saveTemplate}>
									Save Template
								</IonButton>
							</IonCardContent>
						</IonCard>

						{templates.map((tpl) => (
							<IonCard key={tpl.id}>
								<IonCardHeader>
									<IonCardTitle>{tpl.name}</IonCardTitle>
								</IonCardHeader>
								<IonCardContent>
									<IonList>
										{tpl.task_template_items?.map((t: any) => (
											<IonItem key={t.id}>
												<IonLabel>
													<h3>{t.title}</h3>
													<p>{t.description}</p>
												</IonLabel>
											</IonItem>
										))}
									</IonList>
								</IonCardContent>
							</IonCard>
						))}
					</>
				)}

				{/* ==================== Job Cards ==================== */}
				{segment==="jobcards"&&(
					<>
						<IonCard>
							<IonCardHeader>
								<IonCardTitle>Create Job Card</IonCardTitle>
							</IonCardHeader>
							<IonCardContent>
								<IonSelect
									value={selectedTemplate}
									placeholder="Select Template"
									onIonChange={(e) => setSelectedTemplate(e.detail.value)}
									className="ion-margin-bottom"
								>
									{templates.map((tpl) => (
										<IonSelectOption key={tpl.id} value={tpl.id}>
											{tpl.name}
										</IonSelectOption>
									))}
								</IonSelect>

								<IonSelect
									value={jobQuoteId}
									placeholder="Select Quote"
									onIonChange={(e) => setJobQuoteId(e.detail.value)}
									className="ion-margin-bottom"
								>
									{quotes.map((q) => (
										<IonSelectOption key={q.id} value={q.id}>
											{q.label}
										</IonSelectOption>
									))}
								</IonSelect>

								<IonSelect
									value={jobUserId}
									placeholder="Assign to User"
									onIonChange={(e) => setJobUserId(e.detail.value)}
									className="ion-margin-bottom"
								>
									{users.map((u) => (
										<IonSelectOption key={u.id} value={u.id}>
											{u.name}
										</IonSelectOption>
									))}
								</IonSelect>

								<IonInput
									placeholder="Job Name (optional)"
									value={jobName}
									onIonChange={(e) => setJobName(e.detail.value!)}
									className="ion-margin-bottom"
								/>

								<IonButton expand="block" onClick={createJobCard}>
									Generate Job Card
								</IonButton>
							</IonCardContent>
						</IonCard>

						{jobCards.map((card) => (
							<IonCard key={card.id}>
								<IonCardHeader>
									<IonCardTitle>{card.name}</IonCardTitle>
								</IonCardHeader>
								<IonCardContent>
									<IonList>
										{card.job_card_tasks?.map((task: any) => (
											<React.Fragment key={task.id}>
												<IonItem>
													<IonCheckbox checked={task.is_completed} slot="start" />
													<IonLabel>
														<h3>{task.title}</h3>
														<p>{task.description}</p>
													</IonLabel>
												</IonItem>
												{task.job_card_subtasks?.map((sub: any) => (
													<IonItem key={sub.id} className="ion-padding-start">
														<IonCheckbox checked={sub.is_completed} slot="start" />
														<IonLabel>{sub.title}</IonLabel>
													</IonItem>
												))}
												<IonItemDivider />
											</React.Fragment>
										))}
									</IonList>
								</IonCardContent>
							</IonCard>
						))}
					</>
				)}
			</IonContent>
		</IonPage>
	);
};

export default AdminTaskTemplates;
