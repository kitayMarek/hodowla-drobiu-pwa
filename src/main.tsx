import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { seedDemoData } from './db/seeds';

// Załaduj dane demo przy pierwszym uruchomieniu
seedDemoData().catch(console.error);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
