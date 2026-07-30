<?php

return [
    'enabled' => env('INBOUND_MAIL_ENABLED', false),

    'imap' => [
        'host' => env('INBOUND_MAIL_IMAP_HOST'),
        'port' => (int) env('INBOUND_MAIL_IMAP_PORT', 993),
        'encryption' => env('INBOUND_MAIL_IMAP_ENCRYPTION', 'ssl'),
        'validate_cert' => env('INBOUND_MAIL_IMAP_VALIDATE_CERT', true),
        'username' => env('INBOUND_MAIL_IMAP_USERNAME'),
        'password' => env('INBOUND_MAIL_IMAP_PASSWORD'),
        'mailbox' => env('INBOUND_MAIL_IMAP_MAILBOX', 'INBOX'),
        'search' => env('INBOUND_MAIL_IMAP_SEARCH', 'UNSEEN'),
        'mark_as_seen' => env('INBOUND_MAIL_MARK_AS_SEEN', true),
    ],

    'matching' => [
        'require_sender_match_for_ticket_id' => env('INBOUND_MAIL_REQUIRE_SENDER_MATCH_FOR_TICKET_ID', true),
        'fallback_requires_single_open_ticket' => env('INBOUND_MAIL_FALLBACK_SINGLE_OPEN', true),
    ],

    'content' => [
        'max_length' => (int) env('INBOUND_MAIL_MAX_BODY_LENGTH', 10000),
    ],
];
