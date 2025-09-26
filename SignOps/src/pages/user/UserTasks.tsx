import { useEffect, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonMenuButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonCheckbox,
  IonSegment,
  IonSegmentButton,
} from "@ionic/react";
import { supabase } from "../../supbaseclient.tsx";

interface JobCard {
  id: string;
  name: string;
  description?: string;
  status: string;
  quote_id: string;
  user_id: string;
}

interface JobCardTask {
  id: string;
  job_card_id: string;
  title: string;
  description?: string;
  assignee_id?: string;
  is_completed: boolean;
}

interface JobCardSubtask {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
}

const UserTasks = () => {
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [tasks, setTasks] = useState<JobCardTask[]>([]);
  const [subtasks, setSubtasks] = useState<JobCardSubtask[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [segment, setSegment] = useState("jobcards");

  // Load current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    getUser();
  }, []);

  // Fetch tasks for current user
  useEffect(() => {
    const fetchAll = async () => {
      if (!currentUserId) return;

      // Job cards where user is owner
      const { data: cards } = await supabase
        .from<JobCard>("job_cards")
        .select("*")
        .eq("user_id", currentUserId);
      setJobCards(cards || []);

      // Tasks assigned to user
      const { data: userTasks } = await supabase
        .from<JobCardTask>("job_card_tasks")
        .select("*")
        .eq("assignee_id", currentUserId);
      setTasks(userTasks || []);

      // Subtasks for those tasks
      if (userTasks && userTasks.length > 0) {
        const taskIds = userTasks.map((t) => t.id);
        const { data: subs } = await supabase
          .from<JobCardSubtask>("job_card_subtasks")
          .select("*")
          .in("task_id", taskIds);
        setSubtasks(subs || []);
      }
    };

    fetchAll();
  }, [currentUserId]);

  // Real-time notifications for new assignments
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel("task-assignments")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "job_card_tasks",
          filter: `assignee_id=eq.${currentUserId}`,
        },
        (payload) => {
          const newTask = payload.new as JobCardTask;
          alert(`You have been assigned a new task: ${newTask.title}`);
          setTasks((prev) => [...prev, newTask]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const toggleTaskCompletion = async (taskId: string, currentValue: boolean) => {
    await supabase
      .from<JobCardTask>("job_card_tasks")
      .update({ is_completed: !currentValue })
      .eq("id", taskId);

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, is_completed: !currentValue } : t
      )
    );
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle>Jobs</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonSegment
          value={segment}
          onIonChange={(e) => setSegment(e.detail.value!)}
        >
          <IonSegmentButton value="jobcards">
            <IonLabel>Job Cards</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="tasks">
            <IonLabel>Tasks</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="subtasks">
            <IonLabel>Subtasks</IonLabel>
          </IonSegmentButton>
        </IonSegment>

        {/* Job Cards */}
        {segment === "jobcards" && (
          <>
            {jobCards.length === 0 ? (
              <IonCard>
                <IonCardContent>No job cards yet.</IonCardContent>
              </IonCard>
            ) : (
              jobCards.map((c) => (
                <IonCard key={c.id}>
                  <IonCardHeader>
                    <IonCardTitle>{c.name}</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    {c.description || "No description"}
                    <p>Status: {c.status}</p>
                  </IonCardContent>
                </IonCard>
              ))
            )}
          </>
        )}

        {/* Tasks */}
        {segment === "tasks" && (
          <>
            {tasks.length === 0 ? (
              <IonCard>
                <IonCardContent>No tasks assigned.</IonCardContent>
              </IonCard>
            ) : (
              <IonList>
                {tasks.map((task) => (
                  <IonItem key={task.id}>
                    <IonLabel>{task.title}</IonLabel>
					<IonCheckbox
					slot="end"
                      checked={task.is_completed}
                      onIonChange={() =>
                        toggleTaskCompletion(task.id, task.is_completed)
                      }
                    />
                  </IonItem>
                ))}
              </IonList>
            )}
          </>
        )}

        {/* Subtasks */}
        {segment === "subtasks" && (
          <>
            {subtasks.length === 0 ? (
              <IonCard>
                <IonCardContent>No subtasks available.</IonCardContent>
              </IonCard>
            ) : (
              <IonList>
                {subtasks.map((st) => (
                  <IonItem key={st.id}>
                    <IonLabel>{st.title}</IonLabel>
					<IonCheckbox slot="end" checked={st.is_completed} disabled />
                  </IonItem>
                ))}
              </IonList>
            )}
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default UserTasks;
