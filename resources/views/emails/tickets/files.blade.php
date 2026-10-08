@component('mail::message')
@php
	$footerEnabled = !empty($mailFooter['enabled'] ?? false);
	$footerText = trim((string) ($mailFooter['content'] ?? ''));
	$footerImage = trim((string) ($mailFooter['image_url'] ?? ''));
	$hasFooterText = $footerEnabled && $footerText !== '';
	$hasFooterImage = $footerEnabled && $footerImage !== '';
	$formatSize = function (int $bytes): string {
		if ($bytes >= 1048576) {
			return number_format($bytes / 1048576, 1, ',', ' ') . ' Mo';
		}

		return max(1, (int) round($bytes / 1024)) . ' Ko';
	};
@endphp

@if ($hasFooterImage)
<p style="text-align: right; margin: 0 0 8px 0;">
<img src="{{ $footerImage }}" alt="{{ $mailFooter['image_alt'] ?? 'Logo SupportPC' }}" style="max-width: 56px; height: auto; display: inline-block;">
</p>
@endif

# Ticket #{{ $ticket->id }}: {{ $ticket->title }}

Bonjour {{ $recipientFirstName }},

@if ($files->count() > 1)
Nous vous transmettons {{ $files->count() }} documents concernant votre ticket.
@else
Nous vous transmettons un document concernant votre ticket.
@endif

@if ($note !== '')
@component('mail::panel')
{!! nl2br(e($note)) !!}
@endcomponent
@endif

@foreach ($files as $file)
- {{ $file->original_name }} ({{ $formatSize((int) $file->size) }})
@endforeach

@if ($attachFiles)
@if ($files->count() > 1)
Les documents sont joints à cet email. Vous pouvez aussi les retrouver à tout moment sur la page de votre ticket.
@else
Le document est joint à cet email. Vous pouvez aussi le retrouver à tout moment sur la page de votre ticket.
@endif
@else
Les fichiers étant volumineux, ils ne sont pas joints à cet email : vous pouvez les télécharger depuis la page de votre ticket.
@endif

@component('mail::button', ['url' => !empty($magicLinkUrl) ? $magicLinkUrl : route('tickets.show', ['ticket' => $ticket->id])])
Voir le ticket et les documents
@endcomponent

@if ($hasFooterText || $hasFooterImage)

---

@if ($hasFooterText)
{!! nl2br(e($footerText)) !!}
@endif

@endif

@if (! $hasFooterText)
Cordialement,
{{ config('app.name') }}
@endif
@endcomponent
