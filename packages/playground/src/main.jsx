import React from 'react';
import { createRoot } from 'react-dom/client';
// Ensure default theme variables are present even if the loader injection
// is not active in this environment
import 'postcss-uxdsl/src/theme/default-palette.css';
import App from './App.jsx';
import './styles.uxdsl';

const root = createRoot(document.getElementById('root'));
root.render(<App />);
