import { IonButton, IonButtons, IonCard, IonCardContent, IonContent, IonHeader, IonImg, IonInput, IonMenuButton, IonPage, IonSpinner, IonText, IonTitle, IonToast, IonToolbar } from '@ionic/react';
import ExploreContainer from '../../components/ExploreContainer';
import { useHistory } from 'react-router-dom';
import { supabase } from '../../supbaseclient';
import { useAuth } from '../../AuthContext';
import {useState,useEffect} from 'react';


const Login: React.FC = () => {
	const history = useHistory();
  const { user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showResend, setShowResend] = useState(false);
  const [loadingResend, setLoadingResend] = useState(false);

  useEffect(() => {
    if (user) {
      history.replace('/quote/new');
    }
  }, [user, history]);

  const handleAuth = async () => {
    setErrorMessage('');
    setToastMessage('');
    setShowResend(false);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();

      if (!userData?.user?.email_confirmed_at) {
        setErrorMessage('Please verify your email before logging in.');
        setShowResend(true);
        await supabase.auth.signOut(); // prevent session reuse
        return;
      }

      // Insert into users table if not already inserted
      const { data: existing } = await supabase
        .from('users')
        .select('user_id')
        .eq('user_id', userData.user.id)
        .single();

      if (!existing) {
        await supabase.from('users').insert({
          user_id: userData.user.id,
          email: userData.user.email,
          name: '', // optionally collect name later
        });
      }

      setToastMessage('Login successful!');
      history.push('/quote/new');

    } else {
      const { error } = await supabase.auth.signUp({ email, password });

      if (error) {
        setErrorMessage(error.message);
      } else {
        setToastMessage('Sign-up successful! Check your email to verify your account.');
      }
    }
  };

  const handleResendVerification = async () => {
    setLoadingResend(true);
    setErrorMessage('');
    setToastMessage('');

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });

    if (error) {
      setErrorMessage(error.message);
    } else {
      setToastMessage('Verification email resent!');
    }

    setLoadingResend(false);
  };

  return (
	<IonPage>
	  <IonHeader>
		<IonToolbar>
			<IonButtons slot="start">
			<IonMenuButton />
			</IonButtons>
		  <IonTitle>Login</IonTitle>
		</IonToolbar>
	  </IonHeader>
<IonContent fullscreen className="ion-padding">
        <div
          style={{
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column',
          }}
        >
          {/* Logo */}
          <IonImg
            src="/assets/logo.png"
            alt="App Logo"
            style={{ maxWidth: 120, marginBottom: 20 }}
          />

          <IonCard style={{ width: '100%', maxWidth: 400 }}>
            <IonCardContent>
              <h2 style={{ textAlign: 'center' }}>{isLogin ? 'Login' : 'Sign Up'}</h2>

              {errorMessage && (
                <IonText color="danger">
                  <p style={{ marginTop: 10, textAlign: 'center' }}>{errorMessage}</p>
                </IonText>
              )}

              <IonInput
                label="Email"
                labelPlacement="floating"
                fill="outline"
                type="email"
                value={email}
                onIonChange={(e) => setEmail(e.detail.value!)}
                style={{ marginBottom: 16 }}
              />

              <IonInput
                label="Password"
                labelPlacement="floating"
                fill="outline"
                type="password"
                value={password}
                onIonChange={(e) => setPassword(e.detail.value!)}
                style={{ marginBottom: 16 }}
              />

              <IonButton expand="block" onClick={handleAuth}>
                {isLogin ? 'Login' : 'Sign Up'}
              </IonButton>

              <IonButton fill="clear" expand="block" onClick={() => setIsLogin(!isLogin)}>
                {isLogin ? 'Need an account?' : 'Already have an account?'}
              </IonButton>

              {showResend && (
                <IonButton
                  fill="outline"
                  expand="block"
                  color="warning"
                  onClick={handleResendVerification}
                  disabled={loadingResend}
                >
                  {loadingResend ? <IonSpinner name="dots" /> : 'Resend Verification Email'}
                </IonButton>
              )}
            </IonCardContent>
          </IonCard>
        </div>

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

export default Login;
