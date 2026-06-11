<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

class TicketActionListSettings
{
    public const LIST_KEY_PATTERN = '/^[a-z0-9_\-]{2,60}$/';

    public static function defaults(): array
    {
        return config('ticket_action_lists.lists', []);
    }

    public static function load(): array
    {
        $defaults = self::normalizeLists(self::defaults());
        $storedLists = [];

        if (Storage::disk('local')->exists('ticket_action_lists.json')) {
            $raw = Storage::disk('local')->get('ticket_action_lists.json');
            $decoded = json_decode($raw, true);

            if (is_array($decoded) && isset($decoded['lists']) && is_array($decoded['lists'])) {
                $storedLists = self::normalizeLists($decoded['lists']);
            }
        }

        $storedByKey = [];
        foreach ($storedLists as $list) {
            $storedByKey[$list['key']] = $list;
        }

        $merged = [];
        foreach ($defaults as $defaultList) {
            $key = $defaultList['key'];

            if (isset($storedByKey[$key])) {
                $merged[] = array_merge($defaultList, $storedByKey[$key]);
                unset($storedByKey[$key]);
                continue;
            }

            $merged[] = $defaultList;
        }

        foreach ($storedByKey as $list) {
            $merged[] = $list;
        }

        return [
            'lists' => array_values($merged),
        ];
    }

    public static function save(array $settings): void
    {
        $lists = self::normalizeLists($settings['lists'] ?? []);

        Storage::disk('local')->put(
            'ticket_action_lists.json',
            json_encode(['lists' => $lists], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );
    }

    public static function normalizeLists(array $lists): array
    {
        $normalized = [];

        foreach ($lists as $list) {
            if (!is_array($list)) {
                continue;
            }

            $key = trim((string) ($list['key'] ?? ''));
            if (!preg_match(self::LIST_KEY_PATTERN, $key)) {
                continue;
            }

            $label = trim((string) ($list['label'] ?? $key));
            if ($label === '') {
                $label = $key;
            }

            $tasks = collect($list['tasks'] ?? [])
                ->filter(fn($task) => is_string($task) && trim($task) !== '')
                ->map(fn($task) => trim((string) $task))
                ->values()
                ->slice(0, 30)
                ->all();

            $normalized[] = [
                'key' => $key,
                'label' => $label,
                'tasks' => $tasks,
            ];
        }

        $unique = [];
        foreach ($normalized as $item) {
            $unique[$item['key']] = $item;
        }

        return array_values($unique);
    }
}
