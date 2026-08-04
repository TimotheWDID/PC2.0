<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'smsfactory' => [
        'enabled' => env('SMSFACTORY_ENABLED', false),
        'base_url' => env('SMSFACTORY_BASE_URL', 'https://api.smsfactor.com'),
        'send_path' => env('SMSFACTORY_SEND_PATH', '/send'),
        'max_length' => (int) env('SMSFACTORY_MAX_LENGTH', 160),
        'api_key' => env('SMSFACTORY_API_KEY'),
        'auth_header' => env('SMSFACTORY_AUTH_HEADER', 'X-API-KEY'),
        'auth_prefix' => env('SMSFACTORY_AUTH_PREFIX', ''),
        'header' => env('SMSFACTORY_HEADER', ''),
        'footer' => env('SMSFACTORY_FOOTER', env('SMSFACTORY_SIGNATURE', "Planete-Computers 2.0\n03.89.82.76.33")),
        'sender' => env('SMSFACTORY_SENDER', env('APP_NAME', 'SupportPC')),
        'default_country_code' => env('SMSFACTORY_DEFAULT_COUNTRY_CODE', '+33'),
        'timeout' => (float) env('SMSFACTORY_TIMEOUT', 10),
        'verify_ssl' => env('SMSFACTORY_VERIFY_SSL', true),
    ],

];
