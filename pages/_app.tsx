// pages/_app.tsx
import { useEffect } from 'react';
import { appWithTranslation } from 'next-i18next';
import '../styles/globals.css';

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // Registrar Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW registrado:', reg))
        .catch(err => console.log('Erro ao registrar SW:', err));
    }
  }, []);

  return <Component {...pageProps} />;
}

export default appWithTranslation(MyApp);