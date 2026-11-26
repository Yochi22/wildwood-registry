import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/archivo/wdth.css';
import './styles.css';
import App from './App.jsx';
import { I18nProvider } from './i18n/index.jsx';
import { AuthProvider } from './lib/auth.jsx';
import { ToastProvider } from './components/Toast.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>
);
