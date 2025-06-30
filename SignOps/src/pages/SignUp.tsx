  import React, { useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonInput,
  IonButton, IonLabel, IonToast, IonText
} from '@ionic/react';
import { supabase } from '../supbaseclient';
import { useHistory } from 'react-router-dom';

const Signup: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const history = useHistory();

  const handleSignup = async () => {
    if (!email || !password || !confirm) {
      setToastMessage('All fields are required.');
      return;
    }

    if (password !== confirm) {
      setToastMessage('Passwords do not match.');
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setToastMessage(error.message);
    } else {
      setToastMessage('Signup successful. Please check your email.');
      setTimeout(() => history.push('/login'), 2000); // redirect after toast
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Sign Up</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonLabel position="floating">Email</IonLabel>
        <IonInput
          type="email"
          value={email}
          onIonChange={e => setEmail(e.detail.value!)}
          placeholder="you@example.com"
        />

        <IonLabel position="floating">Password</IonLabel>
        <IonInput
          type="password"
          value={password}
          onIonChange={e => setPassword(e.detail.value!)}
          placeholder="Create a password"
        />

        <IonLabel position="floating">Confirm Password</IonLabel>
        <IonInput
          type="password"
          value={confirm}
          onIonChange={e => setConfirm(e.detail.value!)}
          placeholder="Repeat password"
        />

        <IonButton expand="block" onClick={handleSignup} className="ion-margin-top">
          Sign Up
        </IonButton>

        <IonText color="medium">
          <p className="ion-padding-top ion-text-center">
            Already have an account? <a href="/login">Login</a>
          </p>
        </IonText>

        <IonToast
          isOpen={!!toastMessage}
          message={toastMessage}
          duration={2000}
          onDidDismiss={() => setToastMessage('')}
        />
      </IonContent>
    </IonPage>
  );
};

export default Signup;
