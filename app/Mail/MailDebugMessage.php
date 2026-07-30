<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use App\Support\MailFooterSettings;

class MailDebugMessage extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $subjectLine,
        public string $messageBody,
        public bool $asHtml = true,
        public ?string $fromAddress = null,
        public ?string $fromName = null,
        public ?string $replyToAddress = null,
    ) {
    }

    public function envelope(): Envelope
    {
        $replyTo = $this->replyToAddress ? [new Address($this->replyToAddress)] : [];

        return new Envelope(
            subject: $this->subjectLine,
            from: $this->fromAddress ? new Address($this->fromAddress, $this->fromName ?: null) : null,
            replyTo: $replyTo,
        );
    }

    public function content(): Content
    {
        if ($this->asHtml) {
            return new Content(
                view: 'emails.debug.mail-html',
                with: [
                    'body' => $this->messageBody,
                    'subject' => $this->subjectLine,
                    'mailFooter' => MailFooterSettings::load(),
                ],
            );
        }

        return new Content(
            text: 'emails.debug.mail-text',
            with: [
                'body' => $this->messageBody,
                'subject' => $this->subjectLine,
                'mailFooter' => MailFooterSettings::load(),
            ],
        );
    }
}
