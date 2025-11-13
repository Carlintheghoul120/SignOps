import React, { useEffect, useState } from 'react';
import { supabase } from '../supbaseclient.tsx';
import { useHistory } from 'react-router-dom';

export default function ResetPassword() {
  const history = useHistory();
  const [password, setPassword] = useState('');

  useEffect(() => {
    // Try to restore recovery session if Supabase sent us a link with token
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        console.log('Supabase PASSWORD_RECOVERY triggered');
      }
    });
  }, []);

  const handleReset = async () => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      alert(error.message);
    } else {
      alert('Password updated successfully!');
      history.replace('/login');
    }
  };

  return (
    <div className="ion-padding">
      <h2>Reset Password</h2>
      <input
        type="password"
        placeholder="Enter new password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={handleReset}>Update Password</button>
    </div>
  );
}
