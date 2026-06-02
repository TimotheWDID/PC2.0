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
    @inertiaHead

    <!-- Chargement du JS via Vite -->
    @viteReactRefresh
    @vite('resources/js/app.tsx')
</head>
<body class="antialiased bg-gray-100 text-gray-900">
    @inertia
</body>
</html>
