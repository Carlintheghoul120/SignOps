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
  IonGrid,
  IonRow,
  IonCol,
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
  job_card_id: string;
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

  const [showModal, setShowModal] = useState(false);
  const [jobName, setJobName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [jobQuoteId, setJobQuoteId] = useState<string | null>(null);
  const [jobUserId, setJobUserId] = useState<string | null>(null);

  const [templates, setTemplates] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<{ user_id: string; is_admin: boolean } | null>(null);

  // -------- Fetch current user --------
  const fetchCurrentUser = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const { data } = await supabase.from("users").select("user_id, is_admin").eq("user_id", userData.user.id).single();
    if (data) setCurrentUser({ user_id: data.user_id, is_admin: data.is_admin });
  };

  const fetchJobCards = async () => {
    if (!currentUser) return;

    let query = supabase
      .from("job_cards")
      .select(`
        id, name, status, user_id, quote_id,
        job_card_tasks(
          id, title, description, is_completed, assignee_id, job_card_id,
          job_card_subtasks(id, title, is_completed)
        )
      `)
      .order("created_at", { ascending: false });

    if (!currentUser.is_admin) {
      query = query.eq("user_id", currentUser.user_id);
    }

    const { data, error } = await query;
    if (error) return console.error(error);

    const grouped: Record<ColumnKey, JobCard[]> = { todo: [], in_progress: [], done: [] };

    data.forEach((jc: any) => {
      const tasks: JobTask[] = (jc.job_card_tasks || []).map((t: any) => ({
        ...t,
        job_card_subtasks: t.job_card_subtasks || [],
      }));

      const status: ColumnKey = ["todo", "in_progress", "done"].includes(jc.status) ? (jc.status as ColumnKey) : "todo";
      grouped[status].push({ ...jc, job_card_tasks: tasks });
    });

    setColumns(grouped);
  };

  const fetchTemplates = async () => {
    const { data } = await supabase.from("task_templates").select("id, name").order("created_at");
    if (data) setTemplates(data);
  };

  const fetchQuotes = async () => {
    if (!currentUser) return;

    let query = supabase.from("quotes").select("quote_id, contact_name, signage_id");
    if (!currentUser.is_admin) query = query.eq("user_id", currentUser.user_id);

    const { data: quoteData, error } = await query;
    if (error || !quoteData) return;

    const signageIds = quoteData.map((q: any) => q.signage_id).filter(Boolean);
    let signageMap: Record<number, string> = {};
    if (signageIds.length) {
      const { data: signageData } = await supabase.from("signage_types").select("signage_id, name").in("signage_id", signageIds);
      if (signageData) signageMap = Object.fromEntries(signageData.map((s: any) => [s.signage_id, s.name]));
    }

    const mapped = quoteData.map((q: any) => ({
      id: q.quote_id,
      label: `${signageMap[q.signage_id] || "Unknown"} (Contact: ${q.contact_name})`,
    }));

    setQuotes(mapped);
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from("users").select("user_id, name").order("name");
    if (data) setUsers(data);
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const fetchAll = async () => {
      await fetchJobCards();
      await fetchTemplates();
      await fetchQuotes();
      await fetchUsers();
    };

    fetchAll();

    const channel = supabase
      .channel("jobcards")
      .on("postgres_changes", { event: "*", schema: "public", table: "job_cards" }, () => void fetchJobCards())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  // -------- Toggle task completion --------
  const toggleTaskCompletion = async (task: JobTask, parentJobCard: JobCard) => {
    await supabase
      .from("job_card_tasks")
      .update({ is_completed: !task.is_completed })
      .eq("id", task.id);

    // Update local state
    const updatedColumns = { ...columns };
    const column = updatedColumns[parentJobCard.status];
    const jcIndex = column.findIndex((jc) => jc.id === parentJobCard.id);
    if (jcIndex >= 0) {
      const taskIndex = column[jcIndex].job_card_tasks.findIndex((t) => t.id === task.id);
      if (taskIndex >= 0) {
        column[jcIndex].job_card_tasks[taskIndex].is_completed = !task.is_completed;
      }
    }
    setColumns(updatedColumns);

    // Update job card status
    await updateJobCardStatus(parentJobCard);
  };

  const updateJobCardStatus = async (jobCard: JobCard) => {
    const allTasks = jobCard.job_card_tasks;
    let newStatus: ColumnKey = "todo";

    if (allTasks.every((t) => t.is_completed)) newStatus = "done";
    else if (allTasks.some((t) => t.is_completed)) newStatus = "in_progress";

    if (newStatus !== jobCard.status) {
      const { error } = await supabase
        .from("job_cards")
        .update({ status: newStatus })
        .eq("id", jobCard.id);
      if (error) console.error(error);
      fetchJobCards(); // refresh board
    }
  };

  // -------- Create Job Card --------
  const createJobCard = async () => {
    if (!selectedTemplate || !jobQuoteId || !jobUserId) return;

    const { error } = await supabase.rpc("generate_job_card_from_template", {
      p_template_id: selectedTemplate,
      p_quote_id: jobQuoteId,
      p_user_id: jobUserId,
      p_name: jobName || null,
    });

    if (!error) {
      setShowModal(false);
      setJobName("");
      setSelectedTemplate(null);
      setJobQuoteId(null);
      setJobUserId(null);
      fetchJobCards();
    } else console.error(error);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle className="ion-text-center">Task Board</IonTitle>
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
        {segment === "jobcards" && (
          <IonGrid>
            {(["todo", "in_progress", "done"] as ColumnKey[]).map((col) => (
              <IonRow key={col}>
                <IonCol>
                  <h3>{COLUMN_NAMES[col]}</h3>
                  {columns[col].map((card) => (
                    <IonCard key={card.id}>
                      <IonCardHeader>
                        <IonCardTitle>{card.name}</IonCardTitle>
                      </IonCardHeader>
                      <IonCardContent>
                        {card.job_card_tasks.map((task) => (
                          <IonItem key={task.id}>
                            <IonCheckbox
                              checked={task.is_completed}
                              slot="start"
                              onIonChange={() => toggleTaskCompletion(task, card)}
                            />
                            <IonLabel>
                              <h4>{task.title}</h4>
                              <p>{task.description || "No description"}</p>
                              {task.job_card_subtasks?.length > 0 && (
                                <ul style={{ paddingLeft: "1em" }}>
                                  {task.job_card_subtasks.map((st) => (
                                    <li key={st.id}>
                                      <input type="checkbox" checked={st.is_completed} readOnly /> {st.title}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </IonLabel>
                          </IonItem>
                        ))}
                      </IonCardContent>
                    </IonCard>
                  ))}
                </IonCol>
              </IonRow>
            ))}

            <IonButton expand="block" onClick={() => setShowModal(true)}>
              Add Job Card
            </IonButton>
          </IonGrid>
        )}

        {segment === "tasks" && (
          <IonGrid>
            {(["todo", "in_progress", "done"] as ColumnKey[]).map((col) => {
              const tasksForColumn: JobTask[] = [];
              Object.values(columns).forEach((cards) =>
                cards.forEach((card) =>
                  card.job_card_tasks.forEach((task) => {
                    const status: ColumnKey = task.is_completed ? "done" : "in_progress";
                    if (status === col && (currentUser?.is_admin || task.assignee_id === currentUser?.user_id)) {
                      tasksForColumn.push({ ...task, job_card_subtasks: task.job_card_subtasks || [] });
                    }
                  })
                )
              );

              return (
                <IonRow key={col}>
                  <IonCol>
                    <h3>{COLUMN_NAMES[col]}</h3>
                    {tasksForColumn.map((task) => (
                      <IonCard key={task.id}>
                        <IonCardHeader>
                          <IonCardTitle>{task.title}</IonCardTitle>
                          <p style={{ fontSize: "0.9em", color: "#555" }}>{task.description || "No description"}</p>
                        </IonCardHeader>
                        <IonCardContent>
                          <IonItem>
                            <IonCheckbox checked={task.is_completed} slot="start" />
                            <IonLabel>
                              Subtasks:
                              {task.job_card_subtasks?.length ? (
                                <ul style={{ paddingLeft: "1em" }}>
                                  {task.job_card_subtasks.map((st) => (
                                    <li key={st.id}>
                                      <input type="checkbox" checked={st.is_completed} readOnly /> {st.title}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span> None</span>
                              )}
                            </IonLabel>
                          </IonItem>
                        </IonCardContent>
                      </IonCard>
                    ))}
                  </IonCol>
                </IonRow>
              );
            })}
          </IonGrid>
        )}

        {/* Create Job Card Modal */}
        <IonModal isOpen={showModal} onDidDismiss={() => setShowModal(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Create Job Card</IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonItem>
              <IonLabel position="stacked">Job Name (optional)</IonLabel>
              <IonInput value={jobName} onIonChange={(e) => setJobName(e.detail.value!)} />
            </IonItem>
            <IonItem>
              <IonLabel>Template</IonLabel>
              <IonSelect value={selectedTemplate} onIonChange={(e) => setSelectedTemplate(e.detail.value)}>
                {templates.map((tpl) => (
                  <IonSelectOption key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonLabel>Quote</IonLabel>
              <IonSelect value={jobQuoteId} onIonChange={(e) => setJobQuoteId(e.detail.value)}>
                {quotes.map((q) => (
                  <IonSelectOption key={q.id} value={q.id}>
                    {q.label}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonLabel>Assign to User</IonLabel>
              <IonSelect value={jobUserId} onIonChange={(e) => setJobUserId(e.detail.value)}>
                {users.map((u) => (
                  <IonSelectOption key={u.user_id} value={u.user_id}>
                    {u.name}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonButton expand="block" className="ion-margin-top" onClick={createJobCard}>
              Create
            </IonButton>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default TaskBoard;
