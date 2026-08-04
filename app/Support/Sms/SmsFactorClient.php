<?php

namespace App\Support\Sms;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Transport HTTP pur vers l'API SMS Factor. Le texte reçu est envoyé tel quel :
 * la composition (placeholders, décorations, troncature) est faite en amont
 * par SmsComposer.
 */
class SmsFactorClient
{
    public function isEnabled(array $overrides = []): bool
    {
        return SmsSettings::isEnabled($this->resolveSettings($overrides));
    }

    /**
     * @param array<string, mixed> $overrides Surcharges ponctuelles des réglages (page sms-debug).
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
    public function send(string $toE164, string $text, ?string $sender = null, array $overrides = []): array
    {
        $settings = $this->resolveSettings($overrides);
        $url = $this->resolveUrl($settings);

        if (! SmsSettings::isEnabled($settings)) {
            return $this->failure($url, 'Canal SMS désactivé ou clé API absente.');
        }

        if (preg_match('/^\+\d{8,15}$/', $toE164) !== 1) {
            Log::warning('SMSFactor : destinataire invalide.', ['to' => $toE164]);

            return $this->failure($url, 'Destinataire invalide : ' . $toE164);
        }

        $content = trim($text);

        if ($content === '') {
            Log::warning('SMSFactor : message vide.', ['to' => $toE164]);

            return $this->failure($url, 'Message vide.');
        }

        $payload = [
            'sms' => [
                'message' => [
                    'text' => $content,
                    'sender' => $sender ?: (string) ($settings['sender'] ?? config('app.name', 'SupportPC')),
                ],
                'recipients' => [
                    'gsm' => [
                        ['value' => $toE164],
                    ],
                ],
            ],
        ];

        $request = Http::timeout((float) ($settings['timeout'] ?? 10))
            ->acceptJson()
            ->asJson()
            ->withHeaders($this->buildHeaders($settings));

        if (! (bool) ($settings['verify_ssl'] ?? true)) {
            $request = $request->withoutVerifying();
        }

        try {
            $response = $request->post($url, $payload);
            $body = $response->body();
            $decoded = $this->decodeResponse($body);

            if (! $response->successful()) {
                Log::error('SMSFactor : requête en échec.', [
                    'status' => $response->status(),
                    'body' => $body,
                    'to' => $toE164,
                ]);
            }

            return [
                'ok' => $response->successful(),
                'http_status' => $response->status(),
                'api_code' => $this->extractApiCode($decoded),
                'body' => $body,
                'decoded' => $decoded,
                'url' => $url,
                'request' => $payload,
            ];
        } catch (\Throwable $exception) {
            Log::error('SMSFactor : exception transport.', [
                'message' => $exception->getMessage(),
                'to' => $toE164,
            ]);

            return $this->failure($url, $exception->getMessage(), $payload);
        }
    }

    private function resolveSettings(array $overrides): array
    {
        return array_merge(SmsSettings::load(), $overrides);
    }

    private function resolveUrl(array $settings): string
    {
        $baseUrl = rtrim((string) ($settings['base_url'] ?? ''), '/');
        $sendPath = ltrim((string) ($settings['send_path'] ?? '/send'), '/');

        return $baseUrl . '/' . $sendPath;
    }

    private function buildHeaders(array $settings): array
    {
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

    private function decodeResponse(string $body): ?array
    {
        $decoded = json_decode($body, true);

        return json_last_error() === JSON_ERROR_NONE && is_array($decoded) ? $decoded : null;
    }

    private function extractApiCode(?array $decoded): int|string|null
    {
        if (! is_array($decoded)) {
            return null;
        }

        $code = data_get($decoded, 'code', data_get($decoded, 'status'));

        return is_int($code) || is_string($code) ? $code : null;
    }

    private function failure(string $url, string $reason, array $request = []): array
    {
        return [
            'ok' => false,
            'http_status' => null,
            'api_code' => null,
            'body' => $reason,
            'decoded' => null,
            'url' => $url,
            'request' => $request,
        ];
    }
}
