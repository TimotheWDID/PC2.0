<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <!-- Titre dynamique géré par Inertia -->
    <title inertia>{{ config('app.name', 'Laravel') }}</title>

    <!-- Favicon et autres métas -->
    <link rel="icon" href="{{ asset('images/logo32.svg') }}" type="image/svg+xml">

    <style>
        @keyframes initial-loader-spin {
            from {
                transform: rotate(0deg) scale(0.96);
            }
            50% {
                transform: rotate(180deg) scale(1);
            }
            to {
                transform: rotate(360deg) scale(0.96);
            }
        }

        @keyframes initial-loader-pulse {
            0%, 100% {
                opacity: 0.7;
            }
            50% {
                opacity: 1;
            }
        }

        #initial-loader {
            position: fixed;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f8fafc;
            color: #141d3a;
            z-index: 9999;
            transition: opacity 220ms ease, visibility 220ms ease;
        }

        .dark #initial-loader {
            background: #141d3a;
            color: #ffffff;
        }

        #initial-loader.is-hidden {
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
        }

        #initial-loader .initial-loader-logo {
            width: clamp(140px, 24vw, 240px);
            height: auto;
            animation: initial-loader-spin 2.4s linear infinite, initial-loader-pulse 1.8s ease-in-out infinite;
            filter: drop-shadow(0 18px 34px rgba(0, 0, 0, 0.15));
        }

        .dark #initial-loader .initial-loader-logo {
            filter: drop-shadow(0 18px 34px rgba(0, 0, 0, 0.35));
        }

        #initial-loader .initial-loader-ring {
            position: absolute;
            width: clamp(220px, 40vw, 420px);
            height: clamp(220px, 40vw, 420px);
            border-radius: 9999px;
            border: 1px solid color-mix(in oklab, currentColor 16%, transparent);
            box-shadow: 0 0 0 1px color-mix(in oklab, currentColor 8%, transparent) inset;
            opacity: 0.45;
        }
    </style>

    <script>
        (() => {
            try {
                const savedAppearance = localStorage.getItem('appearance') || 'system';
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const isDark = savedAppearance === 'dark' || (savedAppearance === 'system' && prefersDark);

                document.documentElement.classList.toggle('dark', isDark);
                document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
                document.documentElement.style.backgroundColor = isDark ? '#141d3a' : '#f8fafc';
            } catch (error) {
                // If localStorage or matchMedia is unavailable, keep the default rendering.
            }
        })();
    </script>

    @inertiaHead

    <!-- Chargement du JS via Vite -->
    @viteReactRefresh
    @vite('resources/js/app.tsx')
</head>
<body class="antialiased bg-background text-foreground">
    <div id="initial-loader" aria-label="Chargement de l'application" role="status">
        <div class="initial-loader-ring"></div>
        <img src="{{ asset('images/Logo.svg') }}" alt="SupportPC" class="initial-loader-logo">
    </div>
    @inertia
</body>
</html>
