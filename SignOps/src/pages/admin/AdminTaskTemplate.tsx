import React, { useEffect, useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonButton,
  IonIcon,
  IonModal,
  IonItemDivider,
} from '@ionic/react';
import { addCircle, trashBin } from 'ionicons/icons';
import { supabase } from '../../supbaseclient';
type TaskItem = {
  title: string;
  description: string;
};

const AdminTaskTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateName, setTemplateName] = useState('');
const [tasks, setTasks] = useState<TaskItem[]>([{ title: '', description: '' }]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase.from('task_templates').select('*');
    if (!error) setTemplates(data);
  };

  const handleTaskChange = (index: number, field: keyof TaskItem, value: string) => {
  const updatedTasks = [...tasks];
  updatedTasks[index][field] = value;
  setTasks(updatedTasks);
};


  const addTask = () => setTasks([...tasks, { title: '', description: '' }]);
  const removeTask = (index: number) => setTasks(tasks.filter((_, i) => i !== index));

  const saveTemplate = async () => {
    setIsSubmitting(true);
    const { data: template, error: insertError } = await supabase
      .from('task_templates')
      .insert([{ name: templateName }])
      .select()
      .single();

    if (insertError || !template) return alert('Error saving template');

    const items = tasks.map((t, idx) => ({
      template_id: template.id,
      title: t.title,
      description: t.description,
      position: idx,
    }));

    const { error: taskError } = await supabase.from('task_template_items').insert(items);
    if (taskError) return alert('Error saving tasks');

    setTemplateName('');
    setTasks([{ title: '', description: '' }]);
    await fetchTemplates();
    setIsSubmitting(false);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Task Templates</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <h2>Create New Template</h2>
        <IonInput
          label="Template Name"
          value={templateName}
          onIonChange={e => setTemplateName(e.detail.value!)}
          placeholder="e.g. Signage Creation"
        />

        {tasks.map((task, index) => (
          <IonItem key={index} lines="none">
            <IonInput
              label="Task Title"
              value={task.title}
              placeholder="Task title"
              onIonChange={e => handleTaskChange(index, 'title', e.detail.value!)}
            />
            <IonTextarea
              value={task.description}
              placeholder="Description"
              onIonChange={e => handleTaskChange(index, 'description', e.detail.value!)}
            />
            <IonButton fill="clear" color="danger" onClick={() => removeTask(index)}>
              <IonIcon icon={trashBin} />
            </IonButton>
          </IonItem>
        ))}

        <IonButton fill="outline" onClick={addTask} className="ion-margin-top">
          <IonIcon icon={addCircle} slot="start" /> Add Task
        </IonButton>

        <IonButton expand="block" className="ion-margin-top" onClick={saveTemplate} disabled={isSubmitting}>
          Save Template
        </IonButton>

        <IonItemDivider className="ion-margin-top" />
        <h2>Existing Templates</h2>
        <IonList>
          {templates.map((tpl) => (
            <IonItem key={tpl.id}>{tpl.name}</IonItem>
          ))}
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default AdminTaskTemplates;
