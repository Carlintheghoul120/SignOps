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
import { useLocation, useHistory } from 'react-router-dom';
import { supabase } from '../supbaseclient';

const ResetPassword: React.FC = () => {
  const location = useLocation();
  const history = useHistory();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  /**
   * Step 1: Parse the token and exchange for a session
   * The Supabase reset email sends a link like:
   * https://project.supabase.co/auth/v1/verify?token=xyz&type=recovery&redirect_to=com.signops.app://auth/callback
   */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const type = params.get('type');

    if (token && type === 'recovery') {
      (async () => {
        const { data, error } = await supabase.auth.exchangeCodeForSession(token);
        if (error) {
          setErrorMessage('Invalid or expired link.');
        } else {
          setReady(true);
        }
      })();
    } else {
      setErrorMessage('Missing or invalid recovery token.');
    }
  }, [location.search]);

  /**
   * Step 2: Reset password once user sets a new one
   */
  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      setErrorMessage('Please enter both fields.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setToastMessage('Password reset successful! Redirecting to login...');
      setTimeout(() => history.replace('/login'), 2000);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Reset Password</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="ion-padding">
        {errorMessage && (
          <IonText color="danger">
            <p>{errorMessage}</p>
          </IonText>
        )}

        {ready ? (
          <>
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

            <IonButton expand="block" onClick={handleResetPassword} disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </IonButton>
          </>
        ) : (
          <IonText color="medium">
            <p>Loading reset link...</p>
          </IonText>
        )}

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
