{{ $subject }}

Bonjour,

Vous avez un nouveau message sur votre ticket support.

{{ $body }}

@php
	$footerEnabled = !empty($mailFooter['enabled'] ?? false);
	$footerText = trim((string) ($mailFooter['content'] ?? ''));
	$footerImage = trim((string) ($mailFooter['image_url'] ?? ''));
	$hasFooterText = $footerEnabled && $footerText !== '';
	$hasFooterImage = $footerEnabled && $footerImage !== '';
@endphp

@if ($hasFooterText || $hasFooterImage)

---

@if ($hasFooterImage)
[Image] {{ $mailFooter['image_alt'] ?? 'Logo SupportPC' }}: {{ $footerImage }}

@endif

@if ($hasFooterText)
{{ $footerText }}
@endif
@endif

@if (! $hasFooterText)
Cordialement,
{{ config('app.name') }}
@endif
