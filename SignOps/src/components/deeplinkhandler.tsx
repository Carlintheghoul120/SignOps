import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { useHistory } from 'react-router-dom';

const DeepLinkHandler: React.FC = () => {
  const history = useHistory();

  useEffect(() => {
    let handle: any;

    const setup = async () => {
      handle = await App.addListener('appUrlOpen', (data) => {
        const url = data?.url;
        console.log('[DeepLinkHandler] URL opened:', url);

        if (!url) return;

        // Match our deep link
        if (url.startsWith('com.signops.app://reset-password')) {
          console.log('[DeepLinkHandler] Navigating to reset-password');
          history.replace('/reset-password');
        }
      });
    };

    setup();

    return () => {
      if (handle && typeof handle.remove === 'function') handle.remove();
    };
  }, [history]);

  return null;
};

export default DeepLinkHandler;
