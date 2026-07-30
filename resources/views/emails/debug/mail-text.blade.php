{{ $subject }}

{{ $body }}

@if (!empty($mailFooter['enabled'] ?? false) && !empty(trim((string) ($mailFooter['content'] ?? ''))))

---

@if (!empty(trim((string) ($mailFooter['image_url'] ?? ''))))
[Image] {{ $mailFooter['image_alt'] ?? 'Logo SupportPC' }}: {{ $mailFooter['image_url'] }}

@endif

{{ $mailFooter['content'] }}
@endif

--
{{ config('app.name') }}
