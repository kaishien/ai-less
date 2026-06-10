import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { installBrowserLogCapture } from './lib/install-browser-log-capture';
import './styles.css';

installBrowserLogCapture();

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
