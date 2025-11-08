import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonInput,
  IonButton,
  IonText,
  IonToast,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { supabase } from '../supbaseclient.tsx';

const ResetPassword: React.FC = () => {
  const history = useHistory();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [canReset, setCanReset] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthStateChange]', event, session);
      if (event === 'PASSWORD_RECOVERY') {
        // Supabase has created a temporary session for password recovery
        setCanReset(true);
      }
    });

    return () => {
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  const handleResetPassword = async () => {
    setErrorMessage('');
    setToastMessage('');

    if (!password || !confirmPassword) {
      setErrorMessage('Please enter both fields.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    if (!canReset) {
      setErrorMessage('Auth session missing. Please open the reset link again.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMessage(error.message);
      } else {
        setToastMessage('Password reset successful! Redirecting to login...');
        setTimeout(() => history.replace('/login'), 2000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Reset Password</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {errorMessage && (
          <IonText color="danger">
            <p>{errorMessage}</p>
          </IonText>
        )}

        <IonInput
          type="password"
          placeholder="New Password"
          value={password}
          onIonChange={(e) => setPassword(e.detail.value!)}
          style={{ marginBottom: 16 }}
        />
        <IonInput
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onIonChange={(e) => setConfirmPassword(e.detail.value!)}
          style={{ marginBottom: 16 }}
        />

        <IonButton
          expand="block"
          onClick={handleResetPassword}
          disabled={loading || !canReset}
        >
          {loading ? 'Resetting...' : 'Reset Password'}
        </IonButton>

        <IonToast
          isOpen={!!toastMessage}
          message={toastMessage}
          duration={2000}
          color="success"
          onDidDismiss={() => setToastMessage('')}
        />
      </IonContent>
    </IonPage>
  );
};

export default ResetPassword;
