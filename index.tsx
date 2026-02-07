import { Buffer } from 'buffer';
(window as any).Buffer = Buffer;

import React from 'react';
import ReactDOM from 'react-dom/client';
// Ensure LI.FI integrator is set before any SDK calls (must be ≤23 chars)
import './services/lifi';
import App from './App';
import { WalletProvider } from './providers/WalletProvider';
import './index.css';
import './toast-custom.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WalletProvider>
      <App />
    </WalletProvider>
  </React.StrictMode>,
);
