import React, { useEffect, useState } from 'react';
import { supabase } from '../supbaseclient';
import { useHistory } from 'react-router-dom';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonInput,
  IonButton,
  IonText,
  IonLoading,
} from '@ionic/react';

const ResetPassword: React.FC = () => {
  const history = useHistory();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Retrieve recovery token from sessionStorage
  useEffect(() => {
    const recoveryToken = sessionStorage.getItem('recovery_token');
    if (!recoveryToken) {
      setErrorMsg('No recovery token found. Please request a new password reset.');
      return;
    }
    setToken(recoveryToken);

    // Set Supabase session using token
    supabase.auth.setSession({ access_token: recoveryToken, refresh_token: recoveryToken })
      .then(({ error }) => {
        if (error) {
          console.error('Error setting session:', error.message);
          setErrorMsg('Invalid or expired token. Please request a new password reset.');
        }
      });
  }, []);

  const handleReset = async () => {
    if (!password || !confirmPassword) {
      setErrorMsg('Please fill out both fields.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccess(true);
        sessionStorage.removeItem('recovery_token');
      }
    } catch (err: any) {
      console.error('Unexpected error:', err);
      setErrorMsg(err.message || 'Unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Password Reset Successful</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <IonText color="success">
            Your password has been updated successfully. You can now{' '}
            <a href="/login">login</a>.
          </IonText>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Reset Password</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {errorMsg && <IonText color="danger">{errorMsg}</IonText>}
        <IonInput
          type="password"
          placeholder="New Password"
          value={password}
          onIonChange={(e) => setPassword(e.detail.value!)}
          className="ion-margin-top"
        />
        <IonInput
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onIonChange={(e) => setConfirmPassword(e.detail.value!)}
          className="ion-margin-top"
        />
        <IonButton expand="block" onClick={handleReset} className="ion-margin-top">
          Reset Password
        </IonButton>
        <IonLoading isOpen={loading} message="Updating password..." />
      </IonContent>
    </IonPage>
  );
};

export default ResetPassword;
