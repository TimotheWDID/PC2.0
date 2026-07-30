<?php

namespace App\Console\Commands;

use App\Models\InboundEmail;
use App\Models\Message;
use App\Models\Ticket;
use App\Models\User;
use App\Notifications\AgentTicketReplyNotification;
use App\Notifications\InboundMailNeedsReviewNotification;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ImportInboundEmails extends Command
{
    protected $signature = 'supportpc:mail-import {--limit=50 : Maximum number of emails to process per run}';

    protected $description = 'Import inbound customer emails and attach them as ticket replies.';

    public function handle(): int
    {
        if (! config('inbound_mail.enabled', false)) {
            $this->info('Inbound mail import is disabled (INBOUND_MAIL_ENABLED=false).');
            return self::SUCCESS;
        }

        if (! function_exists('imap_open')) {
            $this->error('PHP IMAP extension is not available. Enable ext-imap to use inbound mail import.');
            return self::FAILURE;
        }

        $mailboxPath = $this->buildMailboxPath();
        $username = (string) config('inbound_mail.imap.username', '');
        $password = (string) config('inbound_mail.imap.password', '');
        $searchCriteria = (string) config('inbound_mail.imap.search', 'UNSEEN');
        $limit = max(1, (int) $this->option('limit'));

        if ($mailboxPath === null || $username === '' || $password === '') {
            $this->error('Inbound mail IMAP settings are incomplete.');
            return self::FAILURE;
        }

        $imap = @imap_open($mailboxPath, $username, $password);

        if (! $imap) {
            $errors = imap_errors() ?: [];
            $this->error('Unable to connect to mailbox: '.implode(' | ', $errors));
            return self::FAILURE;
        }

        $processed = 0;
        $created = 0;
        $skipped = 0;
        $failed = 0;

        try {
            $emailNumbers = imap_search($imap, $searchCriteria) ?: [];
            // Process oldest unseen emails first to avoid starving old messages when volume spikes.
            sort($emailNumbers);

            foreach (array_slice($emailNumbers, 0, $limit) as $emailNumber) {
                $processed++;
                $result = $this->processEmail($imap, (int) $emailNumber);

                if ($result === 'created') {
                    $created++;
                } elseif ($result === 'failed') {
                    $failed++;
                } else {
                    $skipped++;
                }
            }
        } finally {
            imap_close($imap);
        }

        $this->info("Inbound import done. Processed={$processed}, created={$created}, skipped={$skipped}, failed={$failed}.");

        return self::SUCCESS;
    }

    private function processEmail($imap, int $emailNumber): string
    {
        $overviewRows = imap_fetch_overview($imap, (string) $emailNumber, 0) ?: [];
        $overview = $overviewRows[0] ?? null;

        if (! $overview) {
            return 'failed';
        }

        $uid = (string) imap_uid($imap, $emailNumber);
        $rawMessageId = isset($overview->message_id) ? trim((string) $overview->message_id) : null;
        $messageId = $rawMessageId !== '' ? $rawMessageId : null;

        if ($uid !== '' && InboundEmail::query()->where('mailbox_uid', $uid)->exists()) {
            $this->markSeen($imap, $emailNumber);
            return 'skipped';
        }

        if ($messageId !== null && InboundEmail::query()->where('message_id', $messageId)->exists()) {
            $this->markSeen($imap, $emailNumber);
            return 'skipped';
        }

        $subject = $this->decodeMimeHeader(isset($overview->subject) ? (string) $overview->subject : '');
        $senderEmail = $this->extractSenderEmail(isset($overview->from) ? (string) $overview->from : '');
        $receivedAt = isset($overview->date) ? Carbon::parse((string) $overview->date) : now();

        try {
            $body = $this->extractBestBody($imap, $emailNumber);
            $body = $this->cleanupReplyBody($body);
            $maxLength = max(500, (int) config('inbound_mail.content.max_length', 10000));
            $body = mb_substr($body, 0, $maxLength);

            if ($body === '') {
                $this->storeInboundLog([
                    'mailbox_uid' => $uid !== '' ? $uid : null,
                    'message_id' => $messageId,
                    'sender_email' => $senderEmail,
                    'subject' => $subject,
                    'body_text' => null,
                    'status' => 'skipped_empty_body',
                    'error' => null,
                    'received_at' => $receivedAt,
                ]);
                $this->markSeen($imap, $emailNumber);
                return 'skipped';
            }

            [$ticket, $status, $error] = $this->resolveTicket($subject, $senderEmail);

            if (! $ticket) {
                $inbound = $this->storeInboundLog([
                    'mailbox_uid' => $uid !== '' ? $uid : null,
                    'message_id' => $messageId,
                    'sender_email' => $senderEmail,
                    'subject' => $subject,
                    'body_text' => $body,
                    'status' => $status,
                    'error' => $error,
                    'received_at' => $receivedAt,
                ]);

                if ($inbound && in_array($inbound->status, InboundEmail::HUMAN_REVIEW_STATUSES, true)) {
                    $this->notifyAgentsAboutUnlinkedInboundMail($inbound);
                }

                $this->markSeen($imap, $emailNumber);
                return 'skipped';
            }

            $message = Message::create([
                'ticket_id' => $ticket->id,
                'author_id' => $ticket->user_id,
                'content' => $body,
                'is_internal' => false,
                'attachments' => [],
            ]);

            $this->notifyAgentsForImportedCustomerReply($ticket, $message);

            $this->storeInboundLog([
                'mailbox_uid' => $uid !== '' ? $uid : null,
                'message_id' => $messageId,
                'ticket_id' => $ticket->id,
                'sender_email' => $senderEmail,
                'subject' => $subject,
                'body_text' => $body,
                'status' => 'processed',
                'error' => null,
                'received_at' => $receivedAt,
            ]);

            $this->markSeen($imap, $emailNumber);
            return 'created';
        } catch (\Throwable $exception) {
            Log::warning('inbound_mail_processing_failed', [
                'uid' => $uid,
                'subject' => $subject,
                'sender' => $senderEmail,
                'error' => $exception->getMessage(),
            ]);

            $this->storeInboundLog([
                'mailbox_uid' => $uid !== '' ? $uid : null,
                'message_id' => $messageId,
                'sender_email' => $senderEmail,
                'subject' => $subject,
                'body_text' => isset($body) && trim((string) $body) !== '' ? $body : null,
                'status' => 'failed',
                'error' => $exception->getMessage(),
                'received_at' => $receivedAt,
            ]);

            $this->markSeen($imap, $emailNumber);
            return 'failed';
        }
    }

    private function storeInboundLog(array $payload): ?InboundEmail
    {
        return InboundEmail::create([
            ...$payload,
            'processed_at' => now(),
        ]);
    }

    private function notifyAgentsAboutUnlinkedInboundMail(InboundEmail $inboundEmail): void
    {
        User::query()
            ->whereHas('agent', function ($query) {
                $query->where('is_active', true);
            })
            ->get()
            ->each(function (User $recipient) use ($inboundEmail) {
                $recipient->notify(new InboundMailNeedsReviewNotification($inboundEmail));
            });
    }

    private function notifyAgentsForImportedCustomerReply(Ticket $ticket, Message $message): void
    {
        $ticket->loadMissing([
            'user:id,first_name,last_name',
            'assignee:id',
            'assignee.agent:id,user_id,is_active',
        ]);

        $customerName = trim(($ticket->user?->first_name ?? '') . ' ' . ($ticket->user?->last_name ?? ''));
        $recipientIds = collect();

        $assigneeIsActiveAgent = (bool) ($ticket->assignee?->agent?->is_active ?? false);
        if ($assigneeIsActiveAgent && $ticket->assignee_id) {
            $recipientIds->push((int) $ticket->assignee_id);
        } else {
            $recipientIds = User::query()
                ->whereHas('agent', function ($query) {
                    $query->where('is_active', true);
                })
                ->pluck('id')
                ->map(fn ($id) => (int) $id);
        }

        if ($recipientIds->isEmpty()) {
            return;
        }

        User::query()
            ->whereIn('id', $recipientIds->unique()->values()->all())
            ->get()
            ->each(function (User $recipient) use ($ticket, $message, $customerName) {
                $recipient->notify(new AgentTicketReplyNotification($ticket, $message, $customerName));
            });
    }

    private function resolveTicket(string $subject, ?string $senderEmail): array
    {
        $ticketId = $this->extractTicketIdFromSubject($subject);

        if ($ticketId !== null) {
            $ticket = Ticket::query()->find($ticketId);

            if (! $ticket) {
                return [null, 'skipped_ticket_not_found', 'Ticket ID in subject does not exist.'];
            }

            $requireSenderMatch = (bool) config('inbound_mail.matching.require_sender_match_for_ticket_id', true);

            if ($requireSenderMatch && ! $this->matchesTicketSender($ticket, $senderEmail)) {
                return [null, 'skipped_sender_mismatch', 'Sender email does not match ticket owner/contact.'];
            }

            return [$ticket, 'processed', null];
        }

        if ($senderEmail === null) {
            return [null, 'skipped_no_ticket_reference', 'No ticket ID in subject and sender is empty.'];
        }

        $query = Ticket::query()
            ->where(function ($builder) use ($senderEmail) {
                $builder
                    ->whereRaw('LOWER(contact_email) = ?', [mb_strtolower($senderEmail)])
                    ->orWhereHas('user', function ($userQuery) use ($senderEmail) {
                        $userQuery->whereRaw('LOWER(email) = ?', [mb_strtolower($senderEmail)]);
                    });
            });

        if ((bool) config('inbound_mail.matching.fallback_requires_single_open_ticket', true)) {
            $query->where('is_resolved', false)
                ->where(function ($builder) {
                    $builder->whereNull('is_locked')->orWhere('is_locked', false);
                });
        }

        $tickets = $query->orderByDesc('updated_at')->limit(3)->get(['id', 'user_id', 'contact_email']);

        if ($tickets->count() === 1) {
            return [$tickets->first(), 'processed', null];
        }

        if ($tickets->isEmpty()) {
            return [null, 'skipped_no_matching_ticket', 'No matching ticket for sender.'];
        }

        return [null, 'skipped_ambiguous_ticket', 'Multiple candidate tickets for sender.'];
    }

    private function extractTicketIdFromSubject(string $subject): ?int
    {
        if (preg_match('/ticket\s*#\s*(\d+)/i', $subject, $matches) !== 1) {
            return null;
        }

        $ticketId = (int) ($matches[1] ?? 0);

        return $ticketId > 0 ? $ticketId : null;
    }

    private function matchesTicketSender(Ticket $ticket, ?string $senderEmail): bool
    {
        if ($senderEmail === null) {
            return false;
        }

        $candidate = mb_strtolower(trim($senderEmail));

        if ($candidate === '') {
            return false;
        }

        $contactEmail = mb_strtolower(trim((string) ($ticket->contact_email ?? '')));
        if ($contactEmail !== '' && $candidate === $contactEmail) {
            return true;
        }

        $userEmail = mb_strtolower(trim((string) ($ticket->user?->email ?? '')));

        return $userEmail !== '' && $candidate === $userEmail;
    }

    private function extractSenderEmail(string $rawFrom): ?string
    {
        $rawFrom = trim($rawFrom);

        if ($rawFrom === '') {
            return null;
        }

        if (preg_match('/<([^>]+)>/', $rawFrom, $matches) === 1) {
            $email = trim((string) ($matches[1] ?? ''));
            return filter_var($email, FILTER_VALIDATE_EMAIL) ? mb_strtolower($email) : null;
        }

        return filter_var($rawFrom, FILTER_VALIDATE_EMAIL) ? mb_strtolower($rawFrom) : null;
    }

    private function decodeMimeHeader(string $value): string
    {
        if ($value === '') {
            return '';
        }

        $parts = imap_mime_header_decode($value);

        if (! is_array($parts) || $parts === []) {
            return trim($value);
        }

        $decoded = '';

        foreach ($parts as $part) {
            $chunk = (string) ($part->text ?? '');
            $charset = strtoupper((string) ($part->charset ?? 'DEFAULT'));

            if ($charset !== 'DEFAULT' && $charset !== 'UTF-8') {
                $converted = @mb_convert_encoding($chunk, 'UTF-8', $charset);
                if ($converted !== false) {
                    $chunk = $converted;
                }
            }

            $decoded .= $chunk;
        }

        return trim($decoded);
    }

    private function extractBestBody($imap, int $emailNumber): string
    {
        $structure = imap_fetchstructure($imap, $emailNumber);

        if (! $structure) {
            return trim((string) imap_body($imap, $emailNumber));
        }

        $plainBody = $this->getPart($imap, $emailNumber, $structure, 'TEXT/PLAIN');
        if ($plainBody !== null && trim($plainBody) !== '') {
            return trim($plainBody);
        }

        $htmlBody = $this->getPart($imap, $emailNumber, $structure, 'TEXT/HTML');
        if ($htmlBody !== null && trim($htmlBody) !== '') {
            return trim(strip_tags($htmlBody));
        }

        return trim((string) imap_body($imap, $emailNumber));
    }

    private function getPart($imap, int $emailNumber, object $structure, string $mimeType, string $partNumber = ''): ?string
    {
        $currentMimeType = $this->getMimeType($structure);

        if ($currentMimeType === strtoupper($mimeType)) {
            $body = $partNumber === ''
                ? imap_body($imap, $emailNumber)
                : imap_fetchbody($imap, $emailNumber, $partNumber);

            return $this->decodeBody((string) $body, (int) ($structure->encoding ?? 0));
        }

        if (! isset($structure->parts) || ! is_array($structure->parts)) {
            return null;
        }

        foreach ($structure->parts as $index => $part) {
            $nextPartNumber = $partNumber === ''
                ? (string) ($index + 1)
                : $partNumber.'.'.($index + 1);

            $data = $this->getPart($imap, $emailNumber, $part, $mimeType, $nextPartNumber);

            if ($data !== null) {
                return $data;
            }
        }

        return null;
    }

    private function getMimeType(object $structure): string
    {
        $primary = [
            'TEXT',
            'MULTIPART',
            'MESSAGE',
            'APPLICATION',
            'AUDIO',
            'IMAGE',
            'VIDEO',
            'OTHER',
        ];

        $type = $primary[(int) ($structure->type ?? 0)] ?? 'OTHER';
        $subtype = strtoupper((string) ($structure->subtype ?? 'PLAIN'));

        return $type.'/'.$subtype;
    }

    private function decodeBody(string $body, int $encoding): string
    {
        return match ($encoding) {
            3 => base64_decode($body, true) ?: '',
            4 => quoted_printable_decode($body),
            default => $body,
        };
    }

    private function cleanupReplyBody(string $body): string
    {
        $body = str_replace(["\r\n", "\r"], "\n", $body);

        $markers = [
            '/^On .+wrote:\s*$/mi',
            '/^Le .+a ecrit\s*:\s*$/mi',
            '/^From:\s.+$/mi',
            '/^De\s*:\s.+$/mi',
            '/^---+\s*Original Message\s*---+$/mi',
        ];

        $lines = explode("\n", $body);
        $kept = [];

        foreach ($lines as $line) {
            $isQuotedLine = preg_match('/^\s*>/', $line) === 1;

            if ($isQuotedLine) {
                continue;
            }

            $isMarker = false;
            foreach ($markers as $pattern) {
                if (preg_match($pattern, $line) === 1) {
                    $isMarker = true;
                    break;
                }
            }

            if ($isMarker) {
                break;
            }

            $kept[] = $line;
        }

        $clean = trim(preg_replace('/\n{3,}/', "\n\n", implode("\n", $kept)) ?? '');

        return $clean;
    }

    private function buildMailboxPath(): ?string
    {
        $host = trim((string) config('inbound_mail.imap.host', ''));
        $port = (int) config('inbound_mail.imap.port', 993);
        $encryption = trim((string) config('inbound_mail.imap.encryption', 'ssl'));
        $mailbox = trim((string) config('inbound_mail.imap.mailbox', 'INBOX'));
        $validateCert = (bool) config('inbound_mail.imap.validate_cert', true);

        if ($host === '' || $port <= 0 || $mailbox === '') {
            return null;
        }

        $flags = '/imap';

        if ($encryption !== '') {
            $flags .= '/'.$encryption;
        }

        if (! $validateCert) {
            $flags .= '/novalidate-cert';
        }

        return sprintf('{%s:%d%s}%s', $host, $port, $flags, $mailbox);
    }

    private function markSeen($imap, int $emailNumber): void
    {
        if (! (bool) config('inbound_mail.imap.mark_as_seen', true)) {
            return;
        }

        imap_setflag_full($imap, (string) $emailNumber, '\\Seen');
    }
}
