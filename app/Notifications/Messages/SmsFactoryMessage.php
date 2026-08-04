<?php

namespace App\Notifications\Messages;

/**
 * DTO du SMS prêt à l'envoi : le contenu est final (composé et tronqué en amont).
 */
class SmsFactoryMessage
{
    public function __construct(
        public string $content,
        public ?string $recipient = null,
        public ?string $sender = null,
    ) {}

    public function to(string $recipient): self
    {
        $this->recipient = $recipient;

        return $this;
    }

    public function from(string $sender): self
    {
        $this->sender = $sender;

        return $this;
    }
}
