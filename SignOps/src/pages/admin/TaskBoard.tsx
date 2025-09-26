import React, { useEffect, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonModal,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonSegment,
  IonSegmentButton,
  IonButtons,
  IonMenuButton,
  IonCheckbox,
} from "@ionic/react";
import { supabase } from "../../supbaseclient.tsx";

type ColumnKey = "todo" | "in_progress" | "done";

const COLUMN_NAMES: Record<ColumnKey, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

interface Subtask {
  id: string;
  title: string;
  is_completed: boolean;
}

interface JobTask {
  id: string;
  title: string;
  description: string;
  assignee_id: string | null;
  is_completed: boolean;
  job_card_subtasks: Subtask[];
}

interface JobCard {
  id: string;
  name: string;
  status: ColumnKey;
  user_id: string | null;
  quote_id: string | null;
  job_card_tasks: JobTask[];
}

const TaskBoard: React.FC = () => {
  const [segment, setSegment] = useState<"jobcards" | "tasks">("jobcards");
  const [columns, setColumns] = useState<Record<ColumnKey, JobCard[]>>({
    todo: [],
    in_progress: [],
    done: [],
  });

  const [statusFilter, setStatusFilter] = useState<ColumnKey>("todo");

  const [showModal, setShowModal] = useState(false);
  const [jobName, setJobName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [jobQuoteId, setJobQuoteId] = useState<string | null>(null);
  const [jobUserId, setJobUserId] = useState<string | null>(null);

  const [templates, setTemplates] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<{ user_id: string; is_admin: boolean } | null>(null);

  // ✅ Fetch Current User
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;
      const { data } = await supabase
        .from("users")
        .select("user_id, is_admin")
        .eq("user_id", userData.user.id)
        .single();
      if (data) setCurrentUser({ user_id: data.user_id, is_admin: data.is_admin });
    };
    fetchCurrentUser();
  }, []);

  // ✅ Fetch Job Cards
  const fetchJobCards = async () => {
    if (!currentUser) return;
    let query = supabase.from("job_cards").select(
      `
      id, name, status, user_id, quote_id,
      job_card_tasks(
        id, title, description, is_completed, assignee_id,
        job_card_subtasks(id, title, is_completed)
      )
    `
    );

    if (!currentUser.is_admin) query = query.eq("user_id", currentUser.user_id);
    const { data, error } = await query;
    if (error) return console.error(error);

    const grouped: Record<ColumnKey, JobCard[]> = { todo: [], in_progress: [], done: [] };
    data.forEach((jc: any) => {
      const tasks: JobTask[] = (jc.job_card_tasks || []).map((t: any) => ({
        ...t,
        job_card_subtasks: t.job_card_subtasks || [],
      }));
      const status = ["todo", "in_progress", "done"].includes(jc.status)
        ? (jc.status as ColumnKey)
        : "todo";
      grouped[status].push({ ...jc, job_card_tasks: tasks });
    });
    setColumns(grouped);
  };

  useEffect(() => {
    if (!currentUser) return;
    fetchJobCards();
    const channel = supabase
      .channel("jobcards")
      .on("postgres_changes", { event: "*", schema: "public", table: "job_cards" }, fetchJobCards)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [currentUser]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle>Task Board</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSegment value={segment} onIonChange={(e) => setSegment(e.detail.value as any)}>
            <IonSegmentButton value="jobcards">
              <IonLabel>Job Cards</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="tasks">
              <IonLabel>Tasks</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {/* Filter by Status */}
        <IonItem>
          <IonLabel>Status Filter</IonLabel>
          <IonSelect value={statusFilter} onIonChange={(e) => setStatusFilter(e.detail.value)}>
            {(["todo", "in_progress", "done"] as ColumnKey[]).map((col) => (
              <IonSelectOption key={col} value={col}>
                {COLUMN_NAMES[col]}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>

        {/* ✅ Job Cards List */}
        {segment === "jobcards" &&
          columns[statusFilter].map((card) => (
            <IonCard key={card.id}>
              <IonCardHeader>
                <IonCardTitle>{card.name}</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                {card.job_card_tasks.length ? (
                  card.job_card_tasks.map((t) => (
                    <IonItem key={t.id}>
                      <IonCheckbox checked={t.is_completed} slot="start" />
                      <IonLabel>{t.title}</IonLabel>
                    </IonItem>
                  ))
                ) : (
                  <p>No tasks yet.</p>
                )}
              </IonCardContent>
            </IonCard>
          ))}

        {/* ✅ Tasks List */}
        {segment === "tasks" &&
          Object.values(columns)
            .flat()
            .flatMap((c) => c.job_card_tasks)
            .filter((t) =>
              statusFilter === "done"
                ? t.is_completed
                : statusFilter === "todo"
                ? !t.is_completed
                : !t.is_completed // simple placeholder for in_progress logic
            )
            .map((task) => (
              <IonCard key={task.id}>
                <IonCardHeader>
                  <IonCardTitle>{task.title}</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <p>{task.description || "No description"}</p>
                  {task.job_card_subtasks?.length > 0 && (
                    <ul>
                      {task.job_card_subtasks.map((st) => (
                        <li key={st.id}>
                          <input type="checkbox" checked={st.is_completed} readOnly /> {st.title}
                        </li>
                      ))}
                    </ul>
                  )}
                </IonCardContent>
              </IonCard>
            ))}
      </IonContent>
    </IonPage>
  );
};

export default TaskBoard;
