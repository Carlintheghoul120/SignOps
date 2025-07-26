import React,{useEffect,useState} from 'react';
import {
	IonPage,
	IonHeader,
	IonToolbar,
	IonTitle,
	IonContent,
	IonItem,
	IonLabel,
	IonCheckbox,
	IonList,
	IonAccordionGroup,
	IonAccordion,
	IonText,
	IonCard,
	IonCardHeader,
	IonCardTitle,
	IonCardContent,
	IonButtons,
	IonMenuButton,
} from '@ionic/react';
import {supabase} from '../../supbaseclient';

const UserTasks: React.FC=() => {
	const [taskTemplates,setTaskTemplates]=useState<any[]>([]);
	const [userBoards,setUserBoards]=useState<any[]>([]);
	const [userTasks,setUserTasks]=useState<any[]>([]);

	const userId=supabase.auth.getUser()?.then(res => res.data?.user?.id);

	useEffect(() => {
		fetchAll();
	},[]);

	const fetchAll=async () => {
		const {data: templates}=await supabase.from('task_templates').select('*');
		setTaskTemplates(templates||[]);

		const user=(await supabase.auth.getUser()).data?.user;
		if(!user) return;

		const {data: boards}=await supabase
			.from('boards')
			.select('*')
			.eq('created_by',user.id);
		setUserBoards(boards||[]);

		const {data: tasks}=await supabase
			.from('tasks')
			.select('*')
			.eq('assigned_to',user.id);
		setUserTasks(tasks||[]);
	};

	const toggleTaskCompletion=async (taskId: string,currentValue: boolean) => {
		await supabase
			.from('tasks')
			.update({completed: !currentValue,status: !currentValue? 'done':'todo'})
			.eq('id',taskId);
		fetchAll();
	};

	return (
		<IonPage>
			<IonHeader>
				<IonToolbar color="primary">
					<IonButtons slot="start">
						<IonMenuButton />
					</IonButtons>
					<IonTitle className="ion-text-center">My Tasks</IonTitle>
				</IonToolbar>
			</IonHeader>

			<IonContent className="ion-padding">

				<IonCard>
					<IonCardHeader>
						<IonCardTitle>📋 Task Templates (Read Only)</IonCardTitle>
					</IonCardHeader>
					<IonCardContent>
						<IonList>
							{taskTemplates.map(template => (
								<IonItem key={template.id}>
									<IonLabel>{template.name}</IonLabel>
								</IonItem>
							))}
						</IonList>
					</IonCardContent>
				</IonCard>

				<IonCard>
					<IonCardHeader>
						<IonCardTitle>🧾 Your Task Boards</IonCardTitle>
					</IonCardHeader>
					<IonCardContent>
						{userBoards.map(board => (
							<IonAccordionGroup key={board.id}>
								<IonAccordion value={`board-${board.id}`}>
									<IonItem slot="header">
										<IonLabel>Board for Quote #{board.quote_id}</IonLabel>
									</IonItem>
									<div className="ion-padding" slot="content">
										<IonList>
											{userTasks
												.filter(task => task.board_id===board.id)
												.map(task => (
													<IonItem key={task.id}>
														<IonCheckbox
															checked={task.completed}
															onIonChange={() =>
																toggleTaskCompletion(task.id,task.completed)
															}
														/>
														<IonLabel className="ion-margin-start">
															<IonText color={task.completed? 'medium':'dark'}>
																<h2>{task.title}</h2>
																<p>{task.description}</p>
															</IonText>
														</IonLabel>
													</IonItem>
												))}
										</IonList>
									</div>
								</IonAccordion>
							</IonAccordionGroup>
						))}
					</IonCardContent>
				</IonCard>

			</IonContent>
		</IonPage>
	);
};

export default UserTasks;
