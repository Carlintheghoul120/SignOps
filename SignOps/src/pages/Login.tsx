import {
	IonButton,
	IonButtons,
	IonCard,
	IonCardContent,
	IonContent,
	IonHeader,
	IonImg,
	IonInput,
	IonMenuButton,
	IonPage,
	IonSpinner,
	IonText,
	IonTitle,
	IonToast,
	IonToolbar
} from '@ionic/react';
import {useHistory} from 'react-router-dom';
import {supabase} from '../supbaseclient';
import {useAuth} from '../AuthContext';
import {useState,useEffect} from 'react';
import LOGO from '../../resources/icon.png';

const Login: React.FC=() => {
	const history=useHistory();
	const {user}=useAuth();

	const [email,setEmail]=useState('');
	const [phone,setPhone]=useState('');
	const [password,setPassword]=useState('');
	const [isLogin,setIsLogin]=useState(true);
	const [usePhone,setUsePhone]=useState(false);

	const [toastMessage,setToastMessage]=useState('');
	const [errorMessage,setErrorMessage]=useState('');
	const [showResend,setShowResend]=useState(false);
	const [loadingResend,setLoadingResend]=useState(false);

	useEffect(() => {
		if(user) {
			history.replace('/quote/new');
		}
	},[user,history]);

	const handleAuth=async () => {
		setErrorMessage('');
		setToastMessage('');
		setShowResend(false);

		try {
			if(isLogin) {
				// --- LOGIN ---
				const credentials=usePhone
					? {phone,password}
					:{email,password};

				const {error}=await supabase.auth.signInWithPassword(credentials);

				if(error) {
					setErrorMessage(error.message);
					return;
				}

				const {data: userData}=await supabase.auth.getUser();

				if(!userData?.user) {
					setErrorMessage('Authentication failed. Please try again.');
					return;
				}

				const confirmed=
					userData.user.email_confirmed_at||userData.user.phone_confirmed_at;

				if(!confirmed) {
					setErrorMessage('Please verify your account before logging in.');
					setShowResend(!!userData.user.email);
					await supabase.auth.signOut();
					return;
				}


				// --- Insert into users table if not exists ---
				const {data: existing}=await supabase
					.from('users')
					.select('user_id')
					.eq('user_id',userData.user.id)
					.single();

				if(!existing) {
					await supabase.from('users').insert({
						user_id: userData.user.id,
						email: userData.user.email??null,
						phone: userData.user.phone??null,
						name: '',
					});
				}

				setToastMessage('Login successful!');
				history.push('/quote/new');
			} else {
				const credentials=usePhone
					? {phone,password}
					:{email,password};

				const {data,error}=await supabase.auth.signUp(credentials);

				if(error) {
					setErrorMessage(error.message);
				} else {
					setToastMessage(
						usePhone
							? 'Sign-up successful! Check your phone for a confirmation code.'
							:'Sign-up successful! Check your email to verify your account.'
					);
				}
			}
		} catch(e: any) {
			setErrorMessage(e.message||'Something went wrong');
		}
	};

	const handleResendVerification=async () => {
		setLoadingResend(true);
		setErrorMessage('');
		setToastMessage('');

		const {error}=await supabase.auth.resend({
			type: 'signup',
			email,
		});

		if(error) {
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
					<IonTitle>{isLogin? 'Login':'Sign Up'}</IonTitle>
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
					<IonImg
						src={LOGO}
						alt="App Logo"
						style={{maxWidth: 120,marginBottom: 20}}
					/>

					<IonCard style={{width: '100%',maxWidth: 400}}>
						<IonCardContent>
							<h2 style={{textAlign: 'center'}}>{isLogin? 'Login':'Sign Up'}</h2>

							{errorMessage&&(
								<IonText color="danger">
									<p style={{marginTop: 10,textAlign: 'center'}}>{errorMessage}</p>
								</IonText>
							)}

							{usePhone? (
								<IonInput
									label="Phone"
									labelPlacement="floating"
									fill="outline"
									type="tel"
									value={phone}
									onIonChange={(e) => setPhone(e.detail.value!)}
									style={{marginBottom: 16}}
								/>
							):(
								<IonInput
									label="Email"
									labelPlacement="floating"
									fill="outline"
									type="email"
									value={email}
									onIonChange={(e) => setEmail(e.detail.value!)}
									style={{marginBottom: 16}}
								/>
							)}

							<IonInput
								label="Password"
								labelPlacement="floating"
								fill="outline"
								type="password"
								value={password}
								onIonChange={(e) => setPassword(e.detail.value!)}
								style={{marginBottom: 16}}
							/>

							<IonButton expand="block" onClick={handleAuth}>
								{isLogin? 'Login':'Sign Up'}
							</IonButton>

							<IonButton
								fill="clear"
								expand="block"
								onClick={() => setIsLogin(!isLogin)}
							>
								{isLogin? 'Need an account?':'Already have an account?'}
							</IonButton>

							<IonButton
								fill="clear"
								expand="block"
								onClick={() => setUsePhone(!usePhone)}
							>
								{usePhone? 'Use email instead':'Use phone instead'}
							</IonButton>

							{showResend&&!usePhone&&(
								<IonButton
									fill="outline"
									expand="block"
									color="warning"
									onClick={handleResendVerification}
									disabled={loadingResend}
								>
									{loadingResend? <IonSpinner name="dots" />:'Resend Verification Email'}
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
