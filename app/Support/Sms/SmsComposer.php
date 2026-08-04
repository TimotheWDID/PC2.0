<?php

namespace App\Support\Sms;

class SmsComposer
{
    public function __construct(private array $settings)
    {
    }

    public static function fromSettings(): self
    {
        return new self(SmsSettings::load());
    }

    /**
     * Compose le texte final d'un SMS : rendu des placeholders, décorations
     * optionnelles (header/footer), puis troncature unique à max_length en
     * préservant intégralement le lien magique et le footer.
     *
     * @param array{magic_link?: string|null} $context
     */
    public function compose(string $content, array $context = [], bool $withDecorations = false): string
    {
        $text = trim($this->renderPlaceholders($content, $context));

        if ($withDecorations) {
            $segments = array_values(array_filter(
                [$this->header(), $text, $this->footer()],
                static fn (string $segment): bool => $segment !== ''
            ));

            $text = implode("\n\n", $segments);
        }

        return $this->truncate($text);
    }

    private function renderPlaceholders(string $content, array $context): string
    {
        $magicLink = trim((string) ($context['magic_link'] ?? ''));
        $footer = $this->footer();

        $rendered = preg_replace_callback(
            '/\[(magiclink|signature)\]/i',
            static fn (array $matches): string => match (strtolower($matches[1])) {
                'magiclink' => $magicLink !== '' ? $magicLink : $matches[0],
                'signature' => $footer,
            },
            $content
        );

        return $rendered ?? $content;
    }

    /**
     * Troncature en une seule passe : si le texte dépasse max_length, le lien
     * (https://...) et le footer sont conservés intégralement et le corps est
     * rogné pour tenir dans la limite.
     */
    private function truncate(string $text): string
    {
        $maxLength = $this->maxLength();

        if ($text === '' || mb_strlen($text) <= $maxLength) {
            return $text;
        }

        $link = $this->extractLink($text);
        $footer = $this->footer();

        $preserved = array_values(array_filter(
            [$link, $footer !== '' && $footer !== $link ? $footer : ''],
            static fn (string $part): bool => $part !== ''
        ));

        if ($preserved === []) {
            return rtrim(mb_substr($text, 0, $maxLength));
        }

        $preservedLength = 0;
        foreach ($preserved as $part) {
            $preservedLength += mb_strlen($part) + 1;
        }

        $body = $text;
        foreach ($preserved as $part) {
            $body = str_replace($part, '', $body);
        }
        $body = trim(preg_replace('/\s+/', ' ', $body) ?? '');

        $suffix = implode(' ', $preserved);

        if (mb_strlen($suffix) >= $maxLength) {
            return rtrim(mb_substr($link !== '' ? $link : $suffix, 0, $maxLength));
        }

        $availableBodyLength = $maxLength - $preservedLength;

        if ($body === '' || $availableBodyLength <= 0) {
            return $suffix;
        }

        $prefix = rtrim(mb_substr($body, 0, $availableBodyLength));

        return $prefix === '' ? $suffix : $prefix . ' ' . $suffix;
    }

    private function extractLink(string $text): string
    {
        return preg_match('/https?:\/\/\S+/i', $text, $matches) === 1 ? $matches[0] : '';
    }

    private function header(): string
    {
        return trim((string) ($this->settings['header'] ?? ''));
    }

    private function footer(): string
    {
        return trim((string) ($this->settings['footer'] ?? ''));
    }

    private function maxLength(): int
    {
        $maxLength = (int) ($this->settings['max_length'] ?? SmsSettings::DEFAULT_LENGTH);

        return $maxLength > 0 ? $maxLength : SmsSettings::DEFAULT_LENGTH;
    }
}
