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

  // Fetch tasks, subtasks, job cards
  useEffect(() => {
    const fetchAll = async () => {
      if (!currentUserId) return;

      const { data: cards } = await supabase
        .from<JobCard>("job_cards")
        .select("*")
        .eq("user_id", currentUserId);
      setJobCards(cards || []);

      const { data: userTasks } = await supabase
        .from<JobCardTask>("job_card_tasks")
        .select("*")
        .eq("assignee_id", currentUserId);
      setTasks(userTasks || []);

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

  // Real-time notifications for new tasks
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

  // Toggle task completion
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

  // Toggle subtask completion
  const toggleSubtaskCompletion = async (subtask: JobCardSubtask) => {
    await supabase
      .from<JobCardSubtask>("job_card_subtasks")
      .update({ is_completed: !subtask.is_completed })
      .eq("id", subtask.id);

    setSubtasks((prev) =>
      prev.map((st) =>
        st.id === subtask.id ? { ...st, is_completed: !subtask.is_completed } : st
      )
    );
  };

  // Recalculate job card status whenever tasks or subtasks change
  useEffect(() => {
    const recalcJobCardStatuses = async () => {
      const jobCardIds = Array.from(new Set(tasks.map(t => t.job_card_id)));
      for (const jcId of jobCardIds) {
        const jobTasks = tasks.filter(t => t.job_card_id === jcId);
        if (jobTasks.length === 0) continue;

        // Include subtasks in the calculation
        const allTasksDone = jobTasks.every(t => {
          const subs = subtasks.filter(st => st.task_id === t.id);
          return t.is_completed && subs.every(s => s.is_completed);
        });
        const someTasksDone = jobTasks.some(t => t.is_completed);

        let newStatus: string;
        if (allTasksDone) newStatus = "done";
        else if (someTasksDone) newStatus = "in_progress";
        else newStatus = "todo";

        // Update Supabase
        await supabase.from("job_cards").update({ status: newStatus }).eq("id", jcId);

        // Update local state
        setJobCards(prev =>
          prev.map(jc => (jc.id === jcId ? { ...jc, status: newStatus } : jc))
        );
      }
    };

    recalcJobCardStatuses();
  }, [tasks, subtasks]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle className="ion-text-center">Jobs</IonTitle>
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
                    <IonCheckbox
                      slot="end"
                      checked={st.is_completed}
                      onIonChange={() => toggleSubtaskCompletion(st)}
                    />
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
