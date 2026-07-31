<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SmsFactoryClient
{
    private const DEFAULT_MAX_SMS_LENGTH = 120;

    public function send(string $to, string $message, ?string $sender = null): bool
    {
        return (bool) ($this->sendDetailed($to, $message, $sender)['ok'] ?? false);
    }

    /**
     * @param array<string, mixed> $options
     * @return array{
     *   ok: bool,
     *   http_status: int|null,
     *   api_code: int|string|null,
     *   body: string|null,
     *   decoded: array<string, mixed>|null,
     *   url: string,
     *   request: array<string, mixed>
     * }
     */
    public function sendDetailed(string $to, string $message, ?string $sender = null, array $options = []): array
    {
        if (! $this->isEnabled($options)) {
            return [
                'ok' => false,
                'http_status' => null,
                'api_code' => null,
                'body' => null,
                'decoded' => null,
                'url' => $this->resolveUrl($options),
                'request' => [],
            ];
        }

        $recipient = $this->normalizePhone($to);
        if ($recipient === null) {
            Log::warning('SMSFactory recipient is invalid.', ['to' => $to]);

            return [
                'ok' => false,
                'http_status' => null,
                'api_code' => null,
                'body' => null,
                'decoded' => null,
                'url' => $this->resolveUrl($options),
                'request' => [],
            ];
        }

        $content = trim($message);
        if ($content === '') {
            Log::warning('SMSFactory message is empty.', ['to' => $recipient]);

            return [
                'ok' => false,
                'http_status' => null,
                'api_code' => null,
                'body' => null,
                'decoded' => null,
                'url' => $this->resolveUrl($options),
                'request' => [],
            ];
        }

        $url = $this->resolveUrl($options);
        $payload = $this->buildPayload(
            $recipient,
            $content,
            $sender ?: $this->resolveSender($options)
        );

        $request = Http::timeout((float) $this->resolveOption($options, 'timeout', config('services.smsfactory.timeout', 10)))
            ->acceptJson()
            ->asJson()
            ->withHeaders($this->buildHeaders($options));

        if (! (bool) $this->resolveOption($options, 'verify_ssl', config('services.smsfactory.verify_ssl', true))) {
            $request = $request->withoutVerifying();
        }

        try {
            $response = $request->post($url, $payload);
            $body = $response->body();
            $decoded = $this->decodeResponse($body);
            $apiCode = $this->extractApiCode($decoded);

            if (! $response->successful()) {
                Log::error('SMSFactory request failed.', [
                    'status' => $response->status(),
                    'body' => $body,
                    'to' => $recipient,
                    'decoded' => $decoded,
                ]);
            }

            return [
                'ok' => $response->successful(),
                'http_status' => $response->status(),
                'api_code' => $apiCode,
                'body' => $body,
                'decoded' => $decoded,
                'url' => $url,
                'request' => $payload,
            ];
        } catch (\Throwable $exception) {
            Log::error('SMSFactory transport exception.', [
                'message' => $exception->getMessage(),
                'to' => $recipient,
            ]);

            return [
                'ok' => false,
                'http_status' => null,
                'api_code' => null,
                'body' => $exception->getMessage(),
                'decoded' => null,
                'url' => $url,
                'request' => $payload,
            ];
        }
    }

    public function isEnabled(array $options = []): bool
    {
        $settings = $this->resolveSettings($options);

        return (bool) ($settings['enabled'] ?? false)
            && ! empty($settings['api_key'] ?? null);
    }

    private function buildHeaders(array $options = []): array
    {
        $settings = $this->resolveSettings($options);
        $apiKey = (string) ($settings['api_key'] ?? '');
        $headerName = (string) ($settings['auth_header'] ?? 'X-API-KEY');
        $prefix = trim((string) ($settings['auth_prefix'] ?? ''));

        if ($apiKey === '' || $headerName === '') {
            return [];
        }

        return [
            $headerName => $prefix !== '' ? ($prefix . ' ' . $apiKey) : $apiKey,
        ];
    }

    private function resolveUrl(array $options = []): string
    {
        $settings = $this->resolveSettings($options);
        $baseUrl = rtrim((string) ($settings['base_url'] ?? ''), '/');
        $sendPath = ltrim((string) ($settings['send_path'] ?? '/send'), '/');

        return $baseUrl . '/' . $sendPath;
    }

    private function resolveSender(array $options = []): string
    {
        $settings = $this->resolveSettings($options);

        return (string) ($settings['sender'] ?? config('app.name', 'SupportPC'));
    }

    private function resolveOption(array $options, string $key, mixed $default): mixed
    {
        return array_key_exists($key, $options) ? $options[$key] : $default;
    }

    private function buildPayload(string $recipient, string $message, string $sender, array $options = []): array
    {
        $settings = $this->resolveSettings($options);
        $message = $this->prepareMessage($message, $settings, (bool) ($options['bypass_decorations'] ?? false));

        return [
            'sms' => [
                'message' => [
                    'text' => $message,
                    'sender' => $sender,
                ],
                'recipients' => [
                    'gsm' => [
                        [
                            'value' => $recipient,
                        ],
                    ],
                ],
            ],
        ];
    }

    private function decodeResponse(string $body): ?array
    {
        $decoded = json_decode($body, true);

        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            return $decoded;
        }

        return null;
    }

    private function extractApiCode(?array $decoded): int|string|null
    {
        if (! is_array($decoded)) {
            return null;
        }

        $code = data_get($decoded, 'code', data_get($decoded, 'status'));

        return is_int($code) || is_string($code) ? $code : null;
    }

    private function normalizePhone(string $phone): ?string
    {
        $phone = preg_replace('/\s+/', '', trim($phone)) ?? '';
        if ($phone === '') {
            return null;
        }

        $normalized = preg_replace('/[^\d\+]/', '', $phone) ?? '';

        if ($normalized === '' || strlen($normalized) < 8) {
            return null;
        }

        return $normalized;
    }

    private function resolveSettings(array $options = []): array
    {
        return array_merge(SmsFactorySettings::load(), $options);
    }

    private function prepareMessage(string $message, array $settings, bool $bypassDecorations): string
    {
        $content = trim($message);

        if ($bypassDecorations) {
            return $content;
        }

        $header = trim((string) ($settings['header'] ?? ''));
        $footer = trim((string) ($settings['footer'] ?? $settings['signature'] ?? ''));
        $segments = array_values(array_filter([$header, $content, $footer], static fn (string $segment): bool => $segment !== ''));

        if ($segments === []) {
            return '';
        }

        $decorated = implode("\n\n", $segments);
        $maxLength = (int) ($settings['max_length'] ?? self::DEFAULT_MAX_SMS_LENGTH);

        if ($maxLength <= 0) {
            $maxLength = self::DEFAULT_MAX_SMS_LENGTH;
        }

        if (mb_strlen($decorated) <= $maxLength) {
            return $decorated;
        }

        if ($content === '') {
            return mb_substr($decorated, 0, $maxLength);
        }

        $separatorLength = 0;

        if ($header !== '') {
            $separatorLength += 2;
        }

        if ($footer !== '') {
            $separatorLength += 2;
        }

        $availableContentLength = $maxLength - mb_strlen($header) - mb_strlen($footer) - $separatorLength;

        if ($availableContentLength <= 0) {
            return mb_substr($decorated, 0, $maxLength);
        }

        $truncatedContent = rtrim(mb_substr($content, 0, $availableContentLength));

        return implode("\n\n", array_values(array_filter([$header, $truncatedContent, $footer], static fn (string $segment): bool => $segment !== '')));
    }
}
