import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const style = document.createElement('style');
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body, #root {
    margin: 0;
    padding: 0;
    min-height: 100dvh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: #f3f4f6;
    -webkit-font-smoothing: antialiased;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  button { -webkit-tap-highlight-color: transparent; }
  input, textarea { font-family: inherit; }
`;
document.head.appendChild(style);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
