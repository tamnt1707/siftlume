import '@/lib/no-openui-devtools';
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@openuidev/react-ui/components.css';
import '@openuidev/react-ui/styles/index.css';
import '@/lib/i18n/react';
import '@/assets/fonts';
import '@/assets/app.css';
import '@/assets/genui.css';
import Popup from './Popup';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
