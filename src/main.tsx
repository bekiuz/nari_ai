import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const registerServiceWorker = () => {
  // Capacitor apps use a native WebView and should not register the PWA service worker.
  // This avoids interference with Capacitor's native bridge/plugin injection.
  if (!('serviceWorker' in navigator)) return;
  if (!['http:', 'https:'].includes(window.location.protocol)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Zuxrash service worker registration failed:', error);
    });
  });
};

createRoot(document.getElementById('root')!).render(<App />);
registerServiceWorker();
