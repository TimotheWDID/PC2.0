<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Public Base URL
    |--------------------------------------------------------------------------
    |
    | Optional short domain/base URL used to build ticket magic links for
    | SMS and email. Example: https://s.planete-computers.com
    |
    */
    'public_base_url' => env('TICKET_MAGIC_LINK_BASE_URL', env('APP_URL', 'http://localhost')),

    /*
    |--------------------------------------------------------------------------
    | Magic Link Expiration
    |--------------------------------------------------------------------------
    |
    | Number of days after a ticket is marked as resolved/closed before the
    | public magic link expires.
    |
    */
    'expire_days_after_resolution' => (int) env('TICKET_MAGIC_LINK_EXPIRE_DAYS', 30),

    /*
    |--------------------------------------------------------------------------
    | Route Throttling
    |--------------------------------------------------------------------------
    |
    | Strict throttling to mitigate brute-force attempts on /t/{token}.
    |
    */
    'rate_limit_per_minute' => (int) env('TICKET_MAGIC_LINK_RATE_LIMIT_PER_MINUTE', 60),
    'rate_limit_per_hour' => (int) env('TICKET_MAGIC_LINK_RATE_LIMIT_PER_HOUR', 1200),

    /*
    |--------------------------------------------------------------------------
    | Message Endpoints Throttling
    |--------------------------------------------------------------------------
    |
    | Chat history is polled from the frontend, so limits must be high enough
    | to avoid blocking normal users while still protecting token endpoints.
    |
    */
    'messages_auth_per_minute' => (int) env('TICKET_MESSAGES_AUTH_RATE_LIMIT_PER_MINUTE', 600),
    'messages_auth_per_hour' => (int) env('TICKET_MESSAGES_AUTH_RATE_LIMIT_PER_HOUR', 8000),
    'messages_token_per_minute' => (int) env('TICKET_MESSAGES_TOKEN_RATE_LIMIT_PER_MINUTE', 180),
    'messages_token_per_hour' => (int) env('TICKET_MESSAGES_TOKEN_RATE_LIMIT_PER_HOUR', 3000),
    'messages_anonymous_per_minute' => (int) env('TICKET_MESSAGES_ANON_RATE_LIMIT_PER_MINUTE', 10),
    'messages_anonymous_per_hour' => (int) env('TICKET_MESSAGES_ANON_RATE_LIMIT_PER_HOUR', 120),
];
