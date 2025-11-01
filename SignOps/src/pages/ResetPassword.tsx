import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonInput,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/react';
import { useEffect, useState } from 'react';
import { supabase } from '../supbaseclient.tsx';
import { useHistory } from 'react-router-dom';

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const history = useHistory();

  useEffect(() => {
    // Supabase automatically sets the session from the link token
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setErrorMessage(
          'No active reset session found. Please open the reset link again.'
        );
      }
    };
    checkSession();
  }, []);

  const handleUpdatePassword = async () => {
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErrorMessage(error.message);
    } else {
      setToastMessage('Password updated successfully! Please log in again.');
      // Give toast time to show before redirecting
      setTimeout(() => history.replace('/login'), 2000);
    }

    setLoading(false);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Reset Password</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard style={{ maxWidth: 400, margin: 'auto', marginTop: '15%' }}>
          <IonCardContent>
            {errorMessage && (
              <IonText color="danger">
                <p style={{ textAlign: 'center' }}>{errorMessage}</p>
              </IonText>
            )}

            <IonInput
              label="New Password"
              labelPlacement="floating"
              fill="outline"
              type="password"
              value={password}
              onIonChange={(e) => setPassword(e.detail.value!)}
              style={{ marginBottom: 16 }}
            />

            <IonInput
              label="Confirm Password"
              labelPlacement="floating"
              fill="outline"
              type="password"
              value={confirmPassword}
              onIonChange={(e) => setConfirmPassword(e.detail.value!)}
              style={{ marginBottom: 16 }}
            />

            <IonButton
              expand="block"
              onClick={handleUpdatePassword}
              disabled={loading}
            >
              {loading ? <IonSpinner name="dots" /> : 'Update Password'}
            </IonButton>
          </IonCardContent>
        </IonCard>

        <IonToast
          isOpen={!!toastMessage}
          message={toastMessage}
          duration={2500}
          color="success"
          onDidDismiss={() => setToastMessage('')}
        />
      </IonContent>
    </IonPage>
  );
};

export default ResetPassword;
