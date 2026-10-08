<?php

namespace App\Mail;

use App\Models\Ticket;
use App\Models\TicketFile;
use App\Support\MailFooterSettings;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Attachment;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Collection;

class TicketFilesSharedMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param  Collection<int, TicketFile>  $files
     */
    public function __construct(
        public Ticket $ticket,
        public Collection $files,
        public string $note = '',
        public ?string $magicLinkUrl = null,
        public bool $attachFiles = true,
    ) {}

    public function envelope(): Envelope
    {
        $label = $this->files->count() > 1 ? 'Documents' : 'Document';

        return new Envelope(
            subject: "[Support] Ticket #{$this->ticket->id} : {$label} pour vous",
        );
    }

    public function content(): Content
    {
        $firstName = trim((string) ($this->ticket->user?->first_name ?? ''));

        return new Content(
            markdown: 'emails.tickets.files',
            with: [
                'ticket' => $this->ticket,
                'files' => $this->files,
                'note' => $this->note,
                'magicLinkUrl' => $this->magicLinkUrl,
                'attachFiles' => $this->attachFiles,
                'recipientFirstName' => $firstName !== '' ? $firstName : 'client',
                'mailFooter' => MailFooterSettings::load(),
            ],
        );
    }

    /**
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        if (! $this->attachFiles) {
            return [];
        }

        return $this->files
            ->map(fn (TicketFile $file) => Attachment::fromStorageDisk('local', $file->path)
                ->as($file->original_name)
                ->withMime($file->mime_type ?: 'application/octet-stream'))
            ->values()
            ->all();
    }
}
