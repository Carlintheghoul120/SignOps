import React, { useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonInput,
  IonButton, IonLabel, IonToast
} from '@ionic/react';
import { supabase } from '../supbaseclient';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  const handleAuth = async () => {
    const { error } = isLogin
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    setToastMessage(error ? error.message : isLogin ? 'Logged in!' : 'Check your inbox to confirm.');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{isLogin ? 'Login' : 'Sign Up'}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonInput
          placeholder="Email"
          type="email"
          value={email}
           onIonChange={e => setEmail(e.detail.value!)}
        />
        <IonInput
          placeholder="Password"
          type="password"
          value={password}
          onIonChange={e => setPassword(e.detail.value!)}
        />
        <IonButton expand="block" onClick={handleAuth}>
          {isLogin ? 'Login' : 'Sign Up'}
        </IonButton>
        <IonButton fill="clear" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? 'Need an account?' : 'Already have an account?'}
        </IonButton>
      </IonContent>
      <IonToast
        isOpen={!!toastMessage}
        message={toastMessage}
        duration={1500}
        onDidDismiss={() => setToastMessage('')}
      />
    </IonPage>
  );
};

export default Login;
