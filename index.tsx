import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// ?debug=1 enables the expanded stack-trace panel + HOLD button on the
// error fallback. In production the fallback stays minimal — just the
// "SYSTEM FAULT · RESTARTING IN N" ticker.
const debugMode =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('debug') === '1';

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary restartDelaySec={3} debug={debugMode}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
