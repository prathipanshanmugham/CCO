import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/bodoni-moda/opsz.css';
import '@fontsource-variable/bodoni-moda/opsz-italic.css';
import '@fontsource-variable/jost/wght.css';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import './styles/app.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
