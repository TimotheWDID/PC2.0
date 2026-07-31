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
        return (bool) $this->resolveOption($options, 'enabled', config('services.smsfactory.enabled', false))
            && ! empty($this->resolveOption($options, 'api_key', config('services.smsfactory.api_key')));
    }

    private function buildHeaders(array $options = []): array
    {
        $apiKey = (string) $this->resolveOption($options, 'api_key', config('services.smsfactory.api_key', ''));
        $headerName = (string) $this->resolveOption($options, 'auth_header', config('services.smsfactory.auth_header', 'X-API-KEY'));
        $prefix = trim((string) $this->resolveOption($options, 'auth_prefix', config('services.smsfactory.auth_prefix', '')));

        if ($apiKey === '' || $headerName === '') {
            return [];
        }

        return [
            $headerName => $prefix !== '' ? ($prefix . ' ' . $apiKey) : $apiKey,
        ];
    }

    private function resolveUrl(array $options = []): string
    {
        $baseUrl = rtrim((string) $this->resolveOption($options, 'base_url', config('services.smsfactory.base_url')), '/');
        $sendPath = ltrim((string) $this->resolveOption($options, 'send_path', config('services.smsfactory.send_path', '/send')), '/');

        return $baseUrl . '/' . $sendPath;
    }

    private function resolveSender(array $options = []): string
    {
        return (string) $this->resolveOption($options, 'sender', config('services.smsfactory.sender', 'SupportPC'));
    }

    private function resolveOption(array $options, string $key, mixed $default): mixed
    {
        return array_key_exists($key, $options) ? $options[$key] : $default;
    }

    private function buildPayload(string $recipient, string $message, string $sender): array
    {
        $message = $this->applySignature($message);
        $message = $this->enforceMaxLength($message);

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

    private function applySignature(string $message): string
    {
        $signature = trim((string) config('services.smsfactory.signature', ''));

        if ($signature === '') {
            return $message;
        }

        $normalizedMessage = rtrim($message);
        if ($normalizedMessage === '') {
            return $signature;
        }

        if (str_contains($normalizedMessage, $signature)) {
            return $normalizedMessage;
        }

        return $normalizedMessage . "\n\n" . $signature;
    }

    private function enforceMaxLength(string $message): string
    {
        $configuredLength = (int) config('services.smsfactory.max_length', self::DEFAULT_MAX_SMS_LENGTH);

        if ($configuredLength <= 0) {
            $configuredLength = self::DEFAULT_MAX_SMS_LENGTH;
        }

        $maxLength = min($configuredLength, self::DEFAULT_MAX_SMS_LENGTH);

        if (mb_strlen($message) <= $maxLength) {
            return $message;
        }

        [$contentWithoutProtectedSuffix, $protectedSuffix] = $this->extractProtectedSuffix($message);
        $remainingLength = $maxLength - mb_strlen($protectedSuffix);

        if ($remainingLength <= 0) {
            return $protectedSuffix;
        }

        $truncatedContent = rtrim(mb_substr(rtrim($contentWithoutProtectedSuffix), 0, $remainingLength));

        return $truncatedContent . $protectedSuffix;
    }

    /**
     * Protects trailing blocks that must not be truncated (reply link and signature).
     *
     * @return array{0: string, 1: string}
     */
    private function extractProtectedSuffix(string $message): array
    {
        $working = $message;
        $protectedSuffix = '';

        $signature = trim((string) config('services.smsfactory.signature', ''));
        if ($signature !== '') {
            $signatureSuffix = "\n\n" . $signature;

            if (str_ends_with($working, $signatureSuffix)) {
                $working = mb_substr($working, 0, mb_strlen($working) - mb_strlen($signatureSuffix));
                $protectedSuffix = $signatureSuffix . $protectedSuffix;
            } elseif (trim($working) === $signature) {
                $working = '';
                $protectedSuffix = $signature;
            }
        }

        if (preg_match('/(\n\n?[^\n]*https?:\/\/\S+)\s*$/u', $working, $matches, PREG_OFFSET_CAPTURE) === 1) {
            $fullMatch = $matches[1][0] ?? '';
            $byteOffset = $matches[1][1] ?? null;

            if (is_string($fullMatch) && is_int($byteOffset)) {
                $working = rtrim(substr($working, 0, $byteOffset));
                $protectedSuffix = $fullMatch . $protectedSuffix;
            }
        }

        return [$working, $protectedSuffix];
    }
}
