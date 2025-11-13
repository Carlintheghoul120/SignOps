import React, { useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { supabase } from '../supbaseclient.tsx';

const DeepLinkHandler: React.FC = () => {
  const history = useHistory();

  const handleUrl = async (url: string) => {
    try {
      console.log('[DeepLinkHandler] Handling URL:', url);
      const parsed = new URL(url);
      const type = parsed.searchParams.get('type');

      // ✅ Handle Supabase password recovery
      if (url.startsWith('com.signops.app://reset') || type === 'recovery') {
        console.log('[DeepLinkHandler] Password recovery detected');
        sessionStorage.setItem('recovery_url', url);
        history.replace('/reset-password');
        return;
      }

      // ✅ Handle OAuth or login redirect
      if (url.includes('/auth/callback')) {
        console.log('[DeepLinkHandler] Auth callback detected');
        const { error } = await supabase.auth.exchangeCodeForSession(url);
        if (error) {
          console.error('[DeepLinkHandler] exchangeCodeForSession failed:', error.message);
          history.replace('/login');
        } else {
          history.replace('/quote/new');
        }
        return;
      }

      // ✅ Fallback to login if unmatched
      history.replace('/login');
    } catch (err) {
      console.error('[DeepLinkHandler] Failed to handle deep link:', err);
      history.replace('/login');
    }
  };

  useEffect(() => {
    const setup = async () => {
      const launchUrl = await CapacitorApp.getLaunchUrl();
      if (launchUrl?.url) {
        console.log('[DeepLinkHandler] Launch URL:', launchUrl.url);
        await handleUrl(launchUrl.url);
      }

      const listener = await CapacitorApp.addListener('appUrlOpen', async (event) => {
        if (event?.url) {
          console.log('[DeepLinkHandler] Event URL:', event.url);
          await handleUrl(event.url);
        }
      });

      return () => listener.remove();
    };

    setup();
  }, [history]);

  return null;
};

export default DeepLinkHandler;
