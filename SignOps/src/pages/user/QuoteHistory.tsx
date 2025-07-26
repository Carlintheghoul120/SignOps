import React, { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonText,
  IonButtons,
  IonMenuButton
} from '@ionic/react';
import { useAuth } from '../../AuthContext';
import { supabase } from '../../supbaseclient';

interface Quote {
  quote_id: string;
  width: number;
  height: number;
  total_cost: number;
  created_at: string;
}

const QuoteHistory: React.FC = () => {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);

  useEffect(() => {
    if (user?.id) fetchQuotes();
  }, [user]);

  const fetchQuotes = async () => {
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });

    if (data) setQuotes(data);
    if (error) console.error(error.message);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
			 <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle className="ion-text-center">Quote History</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {quotes.length === 0 ? (
          <IonText color="medium"><p>No quotes found.</p></IonText>
        ) : (
          <IonList>
            {quotes.map(q => (
              <IonItem key={q.quote_id}>
                <IonLabel>
                  <h2>Quote #{q.quote_id.slice(0, 6)}...</h2>
                  <p>Size: {q.width}m × {q.height}m</p>
                  <p>Total: R{q.total_cost.toFixed(2)}</p>
                  <p>{new Date(q.created_at).toLocaleString()}</p>
                </IonLabel>
              </IonItem>
            ))}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
};

export default QuoteHistory;