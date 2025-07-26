import React, { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButton, IonModal, IonInput, IonItem, IonLabel, IonSelect,
  IonSelectOption, IonGrid, IonRow, IonCol, IonCard, IonCardHeader, IonCardTitle, IonCardContent
} from '@ionic/react';
import { supabase } from '../../supbaseclient';
import { v4 as uuidv4 } from 'uuid';


type Task = {
  id: string;
  title: string;
  description: string;
  status: ColumnKey;
  board_id: string;
};

type ColumnKey = 'todo' | 'in_progress' | 'done';

const COLUMN_NAMES: Record<ColumnKey, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

const TaskBoard: React.FC<{ boardId: string }> = ({ boardId }) => {
  const [groupedTasks, setGroupedTasks] = useState<Record<ColumnKey, Task[]>>({
    todo: [],
    in_progress: [],
    done: [],
  });

  const [showModal, setShowModal] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', status: 'todo' as ColumnKey });

  // Fetch tasks
  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('board_id', boardId);

    if (error) {
      console.error(error);
      return;
    }

    const grouped = {
      todo: [] as Task[],
      in_progress: [] as Task[],
      done: [] as Task[],
    };

    data.forEach((task: Task) => {
      grouped[task.status].push(task);
    });

    setGroupedTasks(grouped);
  };

  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel(`tasks:board_id=eq.${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `board_id=eq.${boardId}` },
        () => fetchTasks()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId]);

  const handleCreateTask = async () => {
    const id = uuidv4();
    const { error } = await supabase.from('tasks').insert({
      id,
      board_id: boardId,
      title: newTask.title,
      description: newTask.description,
      status: newTask.status,
    });

    if (!error) {
      setShowModal(false);
      setNewTask({ title: '', description: '', status: 'todo' });
    } else {
      console.error(error);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Task Board</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonGrid>
          <IonRow>
            {(['todo', 'in_progress', 'done'] as ColumnKey[]).map((col) => (
              <IonCol key={col}>
                <h3 style={{ textAlign: 'center' }}>{COLUMN_NAMES[col]}</h3>
                {groupedTasks[col].map((task) => (
                  <IonCard key={task.id} color="light">
                    <IonCardHeader>
                      <IonCardTitle>{task.title}</IonCardTitle>
                    </IonCardHeader>
                    <IonCardContent>{task.description}</IonCardContent>
                  </IonCard>
                ))}
              </IonCol>
            ))}
          </IonRow>
        </IonGrid>

        <IonButton expand="block" onClick={() => setShowModal(true)}>
          Add Task
        </IonButton>

        {/* Modal */}
        <IonModal isOpen={showModal} onDidDismiss={() => setShowModal(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Create Task</IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonItem>
              <IonLabel position="stacked">Title</IonLabel>
              <IonInput
                value={newTask.title}
                onIonChange={(e) => setNewTask({ ...newTask, title: e.detail.value! })}
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Description</IonLabel>
              <IonInput
                value={newTask.description}
                onIonChange={(e) => setNewTask({ ...newTask, description: e.detail.value! })}
              />
            </IonItem>
            <IonItem>
              <IonLabel>Status</IonLabel>
              <IonSelect
                value={newTask.status}
                onIonChange={(e) => setNewTask({ ...newTask, status: e.detail.value })}
              >
                <IonSelectOption value="todo">To Do</IonSelectOption>
                <IonSelectOption value="in_progress">In Progress</IonSelectOption>
                <IonSelectOption value="done">Done</IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonButton expand="block" className="ion-margin-top" onClick={handleCreateTask}>
              Create
            </IonButton>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default TaskBoard;
