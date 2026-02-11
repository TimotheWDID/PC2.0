import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { initializeTheme } from './hooks/use-appearance';

const appName = import.meta.env.VITE_APP_NAME || 'SupportPC';

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: (name) =>
        (function () {
            const pages = import.meta.glob('./pages/**/*.tsx');
            // debug: log available pages keys and requested name to help resolve Page not found issues
            try {
                // eslint-disable-next-line no-console
                console.debug('Inertia available pages:', Object.keys(pages));
                // eslint-disable-next-line no-console
                console.debug('Inertia resolving component for:', `./pages/${name}.tsx`);
            } catch (e) {
                // ignore
            }
            return resolvePageComponent(`./pages/${name}.tsx`, pages);
        })(),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(<App {...props} />);
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
