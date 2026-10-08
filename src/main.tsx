import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Zuxrash service worker registration failed:', error);
    });
  });
};

createRoot(document.getElementById('root')!).render(<App />);
registerServiceWorker();
