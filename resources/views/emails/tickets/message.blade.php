@component('mail::message')
@php
	$footerEnabled = !empty($mailFooter['enabled'] ?? false);
	$footerText = trim((string) ($mailFooter['content'] ?? ''));
	$footerImage = trim((string) ($mailFooter['image_url'] ?? ''));
	$hasFooterText = $footerEnabled && $footerText !== '';
	$hasFooterImage = $footerEnabled && $footerImage !== '';
@endphp

@if ($hasFooterImage)
<p style="text-align: right; margin: 0 0 8px 0;">
<img src="{{ $footerImage }}" alt="{{ $mailFooter['image_alt'] ?? 'Logo SupportPC' }}" style="max-width: 56px; height: auto; display: inline-block;">
</p>
@endif

# Ticket #{{ $ticket->id }}: {{ $ticket->title }}

Bonjour {{ $recipientFirstName ?? 'client' }},

Vous avez un nouveau message sur votre ticket {{ strtolower($ticketKindLabel ?? 'Support') }}.

@component('mail::panel')
{!! nl2br(e($messageBody)) !!}
@endcomponent

@component('mail::button', ['url' => !empty($magicLinkUrl) ? $magicLinkUrl : route('tickets.show', ['ticket' => $ticket->id])])
Voir le ticket
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
