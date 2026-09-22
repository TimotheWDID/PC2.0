import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import axios from 'axios';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { initializeTheme } from './hooks/use-appearance';

const appName = import.meta.env.VITE_APP_NAME || 'SupportPC';

// Ensure CSRF/session headers are always present for axios calls (prod-safe).
// Le header X-CSRF-TOKEN n'est volontairement pas fixé en dur ici : Laravel le priorise
// sur le cookie XSRF-TOKEN, or un token figé au chargement de la SPA devient obsolète
// dès que la session se régénère et provoque des 419. On laisse axios lire le cookie
// XSRF-TOKEN (toujours à jour) à chaque requête via xsrfCookieName/xsrfHeaderName.
axios.defaults.withCredentials = true;
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
axios.defaults.xsrfCookieName = 'XSRF-TOKEN';
axios.defaults.xsrfHeaderName = 'X-XSRF-TOKEN';

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: (name) => {
        const pages = import.meta.glob('./pages/**/*.tsx');

        return resolvePageComponent(`./pages/${name}.tsx`, pages);
    },
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(<App {...props} />);

        window.setTimeout(() => {
            document.getElementById('initial-loader')?.classList.add('is-hidden');
        }, 0);
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
