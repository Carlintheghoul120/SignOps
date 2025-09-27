import React, { useEffect, useMemo, useState } from "react";
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
  useIonToast,
} from "@ionic/react";
import { addCircle, trashBin } from "ionicons/icons";
import { supabase } from "../../supbaseclient";

type TemplateSubtask = { title: string };
type TemplateTask = { title: string; description: string; subtasks: TemplateSubtask[] };

const AdminTaskTemplates: React.FC = () => {
  // ------------------- Segment -------------------
  const [segment, setSegment] = useState<"templates" | "jobcards">("templates");
  const [presentToast] = useIonToast();

  // ------------------- Data -------------------
  const [templates, setTemplates] = useState<any[]>([]);
  const [jobCards, setJobCards] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<{ id: string; label: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  // ------------------- Template Form -------------------
  const [templateName, setTemplateName] = useState("");
  const [tasks, setTasks] = useState<TemplateTask[]>([
    { title: "", description: "", subtasks: [] },
  ]);

  // ------------------- Job Card Form -------------------
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [jobName, setJobName] = useState("");
  const [jobQuoteId, setJobQuoteId] = useState<string | null>(null);
  const [jobUserId, setJobUserId] = useState<string | null>(null);
  const validToCreate = useMemo(
    () => Boolean(selectedTemplate && jobQuoteId && jobUserId),
    [selectedTemplate, jobQuoteId, jobUserId]
  );

  // ------------------- Fetch Data -------------------
  useEffect(() => {
    fetchTemplates();
    fetchJobCards();
    fetchQuotes();
    fetchUsers();
  }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("task_templates")
      .select(`
        id, name, created_at,
        task_template_items (
          id, title, description, position,
          task_template_subitems ( id, title, position )
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("fetchTemplates error:", error);
      return;
    }
    setTemplates(
      (data || []).map((tpl: any) => ({
        ...tpl,
        task_template_items: (tpl.task_template_items || []).sort(
          (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)
        ),
      }))
    );
  };

  const fetchJobCards = async () => {
    const { data, error } = await supabase
      .from("job_cards")
      .select(
        `
          id, name, status, created_at, updated_at, user_id, quote_id,
          job_card_tasks(
            id, title, description, is_completed, position, assignee_id,
            job_card_subtasks(id, title, is_completed, position)
          )
        `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("fetchJobCards error:", error);
      return;
    }

    setJobCards(
      (data || []).map((jc: any) => ({
        ...jc,
        job_card_tasks: (jc.job_card_tasks || [])
          .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
          .map((t: any) => ({
            ...t,
            job_card_subtasks: (t.job_card_subtasks || []).sort(
              (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)
            ),
          })),
      }))
    );
  };

  const fetchQuotes = async () => {
    // Safer: plain fetch + signage name map
    const { data, error } = await supabase
      .from("quotes")
      .select("quote_id, contact_name, signage_id")
      .order("created_at", { ascending: false });

    if (error || !data) {
      console.error("Error fetching quotes:", error);
      return;
    }

    const signageIds = data.map((q) => q.signage_id).filter(Boolean);
    let signageMap: Record<number, string> = {};
    if (signageIds.length > 0) {
      const { data: sData } = await supabase
        .from("signage_types")
        .select("signage_id, name")
        .in("signage_id", signageIds);
      if (sData) {
        signageMap = Object.fromEntries(
          sData.map((s: any) => [s.signage_id, s.name])
        );
      }
    }

    const mapped = data.map((q: any) => ({
      id: q.quote_id,
      label: `${signageMap[q.signage_id] || "Unknown"} (Contact: ${q.contact_name})`,
    }));
    setQuotes(mapped);
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("user_id, name")
      .order("name");

    if (error) {
      console.error("fetchUsers error:", error);
      return;
    }
    if (data) {
      const mapped = data.map((u) => ({ id: u.user_id, name: u.name }));
      setUsers(mapped);
    }
  };

  // ------------------- Template Handlers -------------------
  const handleTaskField = (index: number, field: keyof TemplateTask, value: string) => {
    setTasks((prev) => {
      const draft = [...prev];
      draft[index] = { ...draft[index], [field]: value };
      return draft;
    });
  };

  const addTask = () =>
    setTasks((prev) => [...prev, { title: "", description: "", subtasks: [] }]);

  const removeTask = (i: number) => {
    if (confirm("Are you sure you want to remove this task and its subtasks?")) {
      setTasks((prev) => prev.filter((_, idx) => idx !== i));
    }
  };

  // Subtasks (inline under each template task)
  const addSubtask = (taskIndex: number) =>
    setTasks((prev) => {
      const draft = [...prev];
      const t = { ...draft[taskIndex] };
      t.subtasks = [...(t.subtasks || []), { title: "" }];
      draft[taskIndex] = t;
      return draft;
    });

  const updateSubtaskTitle = (taskIndex: number, subIndex: number, value: string) =>
    setTasks((prev) => {
      const draft = [...prev];
      const t = { ...draft[taskIndex] };
      const sts = [...(t.subtasks || [])];
      sts[subIndex] = { ...sts[subIndex], title: value };
      t.subtasks = sts;
      draft[taskIndex] = t;
      return draft;
    });

  const removeSubtask = (taskIndex: number, subIndex: number) => {
    if (confirm("Are you sure you want to remove this subtask?")) {
      setTasks((prev) => {
        const draft = [...prev];
        const t = { ...draft[taskIndex] };
        t.subtasks = (t.subtasks || []).filter((_, i) => i !== subIndex);
        draft[taskIndex] = t;
        return draft;
      });
    }
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) {
      presentToast({ message: "Please enter a template name.", duration: 1500, color: "warning" });
      return;
    }
    if (!tasks.length || tasks.every((t) => !t.title.trim())) {
      presentToast({ message: "Add at least one task with a title.", duration: 1500, color: "warning" });
      return;
    }

    // 1) Create template
    const { data: template, error: tplErr } = await supabase
      .from("task_templates")
      .insert([{ name: templateName }])
      .select()
      .single();

    if (tplErr || !template) {
      console.error("saveTemplate template error:", tplErr);
      presentToast({ message: "Failed to save template.", duration: 1800, color: "danger" });
      return;
    }

    // 2) Insert items and their subtasks sequentially to keep position mapping
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (!t.title.trim()) continue;

      const { data: item, error: itemErr } = await supabase
        .from("task_template_items")
        .insert({
          template_id: template.id,
          title: t.title.trim(),
          description: (t.description || "").trim(),
          position: i,
        })
        .select()
        .single();

      if (itemErr || !item) {
        console.error("saveTemplate item error:", itemErr, t);
        continue;
      }

      const subs = (t.subtasks || []).filter((s) => s.title.trim().length > 0);
      if (subs.length) {
        const rows = subs.map((s, sidx) => ({
          item_id: item.id,
          title: s.title.trim(),
          position: sidx,
        }));
        const { error: subErr } = await supabase
          .from("task_template_subitems")
          .insert(rows);
        if (subErr) {
          console.error("saveTemplate subitems error:", subErr);
        }
      }
    }

    presentToast({ message: "Template saved.", duration: 1200, color: "success" });
    setTemplateName("");
    setTasks([{ title: "", description: "", subtasks: [] }]);
    fetchTemplates();
  };

  // ------------------- Job Card Handlers -------------------
  const createJobCard = async () => {
    if (!validToCreate) return;

    // 1) Generate job card + tasks from template
    const { error: rpcErr } = await supabase.rpc("generate_job_card_from_template", {
      p_template_id: selectedTemplate,
      p_quote_id: jobQuoteId,
      p_user_id: jobUserId,
      p_name: jobName || null,
    });

    if (rpcErr) {
      console.error("generate_job_card_from_template error:", rpcErr);
      presentToast({ message: "Failed to generate job card.", duration: 1800, color: "danger" });
      return;
    }

    // 2) Find the newly created job card (most recent for this user+quote)
    const { data: newCard, error: cardErr } = await supabase
      .from("job_cards")
      .select("id")
      .eq("user_id", jobUserId)
      .eq("quote_id", jobQuoteId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (cardErr || !newCard) {
      console.warn("Could not find newly created job card; tasks may not be assigned.");
    } else {
      // 3) Assign tasks to selected user (if RPC didn't)
      const { error: assignErr } = await supabase
        .from("job_card_tasks")
        .update({ assignee_id: jobUserId })
        .eq("job_card_id", newCard.id)
        .is("assignee_id", null); // Only set where null (safe)
      if (assignErr) {
        console.error("Assign tasks error:", assignErr);
      }
    }

    presentToast({ message: "Job card created.", duration: 1200, color: "success" });
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
        {segment === "templates" && (
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

                {/* Tasks + Inline Subtasks */}
                {tasks.map((task, idx) => (
                  <React.Fragment key={idx}>
                    <IonItem>
                      <IonLabel position="stacked">Task {idx + 1}</IonLabel>
                      <IonInput
                        placeholder="Task Title"
                        value={task.title}
                        onIonChange={(e) => handleTaskField(idx, "title", e.detail.value!)}
                      />
                    </IonItem>
                    <IonItem lines="none">
                      <IonTextarea
                        placeholder="Description"
                        autoGrow
                        value={task.description}
                        onIonChange={(e) => handleTaskField(idx, "description", e.detail.value!)}
                      />
                      <IonButton fill="clear" color="danger" onClick={() => removeTask(idx)}>
                        <IonIcon icon={trashBin} />
                      </IonButton>
                    </IonItem>

                    {/* Inline Subtasks */}
                    <IonItemDivider>Subtasks</IonItemDivider>
                    {(task.subtasks || []).map((sub, sIdx) => (
                      <IonItem key={`${idx}-${sIdx}`}>
                        <IonInput
                          placeholder={`Subtask ${sIdx + 1} Title`}
                          value={sub.title}
                          onIonChange={(e) => updateSubtaskTitle(idx, sIdx, e.detail.value!)}
                        />
                        <IonButton
                          fill="clear"
                          color="danger"
                          onClick={() => removeSubtask(idx, sIdx)}
                        >
                          <IonIcon icon={trashBin} />
                        </IonButton>
                      </IonItem>
                    ))}
                    <div className="ion-padding-start ion-padding-bottom">
                      <IonButton fill="outline" size="small" onClick={() => addSubtask(idx)}>
                        <IonIcon icon={addCircle} slot="start" />
                        Add Subtask
                      </IonButton>
                    </div>

                    <IonItemDivider />
                  </React.Fragment>
                ))}

                <IonButton
                  fill="outline"
                  expand="block"
                  onClick={addTask}
                  className="ion-margin-top"
                >
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
                      <React.Fragment key={t.id}>
                        <IonItem>
                          <IonLabel>
                            <h3>{t.title}</h3>
                            <p>{t.description}</p>
                          </IonLabel>
                        </IonItem>
                        {(t.task_template_subitems || []).map((s: any) => (
                          <IonItem key={s.id} className="ion-padding-start">
                            <IonLabel>• {s.title}</IonLabel>
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

        {/* ==================== Job Cards ==================== */}
        {segment === "jobcards" && (
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
                  placeholder="Assign to User (applies to all tasks)"
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

                <IonButton expand="block" disabled={!validToCreate} onClick={createJobCard}>
                  Generate Job Card
                </IonButton>
              </IonCardContent>
            </IonCard>

            {jobCards.map((card) => (
              <IonCard key={card.id}>
                <IonCardHeader>
                  <IonCardTitle>
                    {card.name} <span style={{ fontSize: 12, color: "#666" }}>({card.status})</span>
                  </IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <IonList>
                    {card.job_card_tasks?.map((task: any) => (
                      <React.Fragment key={task.id}>
                        <IonItem>
                          <IonCheckbox checked={task.is_completed} disabled slot="start" />
                          <IonLabel>
                            <h3>{task.title}</h3>
                            <p>{task.description}</p>
                            <p style={{ fontSize: 12, color: "#666" }}>
                              Assigned to: {users.find((u) => u.id === task.assignee_id)?.name || "—"}
                            </p>
                          </IonLabel>
                        </IonItem>
                        {task.job_card_subtasks?.map((sub: any) => (
                          <IonItem key={sub.id} className="ion-padding-start">
                            <IonCheckbox checked={sub.is_completed} disabled slot="start" />
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
