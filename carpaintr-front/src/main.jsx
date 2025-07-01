import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import 'rsuite/dist/rsuite.min.css'
import '../styles.less';

const fallbackEl = document.getElementById('fallback-refresh');
if (fallbackEl) {
  fallbackEl.remove();
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

