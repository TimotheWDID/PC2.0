<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

class TicketTimelineTemplateSettings
{
    public const BASE_EVENT_TYPES = [
        'manual_note',
        'customer_call',
        'on_site_intervention',
        'diagnostic',
        'parts_ordered',
        'parts_received',
        'resolution_test',
        'handover',
        'other',
        'commande_modification_prerequis',
    ];

    public const EVENT_TYPE_PATTERN = '/^[a-z0-9_\-]{2,60}$/';

    public static function defaults(): array
    {
        return config('ticket_timeline_templates.templates', []);
    }

    public static function load(): array
    {
        $defaults = self::normalizeTemplates(self::defaults(), true);
        $storedTemplates = [];

        if (Storage::disk('local')->exists('ticket_timeline_templates.json')) {
            $raw = Storage::disk('local')->get('ticket_timeline_templates.json');
            $decoded = json_decode($raw, true);

            if (is_array($decoded) && isset($decoded['templates']) && is_array($decoded['templates'])) {
                $storedTemplates = self::normalizeTemplates($decoded['templates']);
            }
        }

        $storedByType = [];
        foreach ($storedTemplates as $template) {
            $storedByType[$template['eventType']] = $template;
        }

        $defaultByType = [];
        foreach ($defaults as $template) {
            $defaultByType[$template['eventType']] = $template;
        }

        $merged = [];
        foreach ($defaults as $defaultTemplate) {
            $eventType = $defaultTemplate['eventType'];

            if (isset($storedByType[$eventType])) {
                $merged[] = array_merge($defaultTemplate, $storedByType[$eventType]);
                continue;
            }

            $merged[] = $defaultTemplate;
        }

        foreach ($storedTemplates as $storedTemplate) {
            $eventType = $storedTemplate['eventType'];

            if (!isset($defaultByType[$eventType])) {
                $merged[] = $storedTemplate;
            }
        }

        return [
            'templates' => $merged,
        ];
    }

    public static function save(array $settings): void
    {
        $templates = self::normalizeTemplates($settings['templates'] ?? []);

        Storage::disk('local')->put(
            'ticket_timeline_templates.json',
            json_encode(['templates' => $templates], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );
    }

    public static function normalizeTemplates(array $templates, bool $baseOnly = false): array
    {
        $normalized = [];

        foreach ($templates as $template) {
            if (!is_array($template)) {
                continue;
            }

            $eventType = (string) ($template['eventType'] ?? '');
            if (!preg_match(self::EVENT_TYPE_PATTERN, $eventType)) {
                continue;
            }

            if ($baseOnly && !in_array($eventType, self::BASE_EVENT_TYPES, true)) {
                continue;
            }

            $normalized[] = [
                'eventType' => $eventType,
                'label' => trim((string) ($template['label'] ?? $eventType)),
                'enabled' => (bool) ($template['enabled'] ?? false),
                'summary' => trim((string) ($template['summary'] ?? '')),
                'details' => trim((string) ($template['details'] ?? '')),
            ];
        }

        $normalizedByType = [];
        foreach ($normalized as $template) {
            $normalizedByType[$template['eventType']] = $template;
        }

        $complete = [];
        foreach (self::BASE_EVENT_TYPES as $eventType) {
            $complete[] = $normalizedByType[$eventType] ?? [
                'eventType' => $eventType,
                'label' => $eventType,
                'enabled' => false,
                'summary' => '',
                'details' => '',
            ];
        }

        if (!$baseOnly) {
            foreach ($normalized as $template) {
                if (in_array($template['eventType'], self::BASE_EVENT_TYPES, true)) {
                    continue;
                }

                $complete[] = $template;
            }
        }

        return $complete;
    }

    public static function allowedEventTypes(): array
    {
        $loaded = self::load();
        $types = array_map(
            static fn(array $template): string => (string) ($template['eventType'] ?? ''),
            $loaded['templates'] ?? []
        );

        return array_values(array_unique(array_filter($types)));
    }
}
