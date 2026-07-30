@component('mail::message')
# Ticket #{{ $ticket->id }}: {{ $ticket->title }}

Bonjour {{ $user->first_name }},

Vous avez un nouveau message sur votre ticket {{ strtolower($ticketKindLabel ?? 'Support') }}.

@component('mail::panel')
{!! nl2br(e($messageBody)) !!}
@endcomponent

@component('mail::button', ['url' => route('tickets.show', ['ticket' => $ticket->id])])
Voir le ticket
@endcomponent

Vous pouvez aussi répondre directement à cet email pour ajouter une réponse au ticket.

@if (!empty($mailFooter['enabled'] ?? false) && !empty(trim((string) ($mailFooter['content'] ?? ''))))

---

@if (!empty(trim((string) ($mailFooter['image_url'] ?? ''))))

<p>
<img src="{{ $mailFooter['image_url'] }}" alt="{{ $mailFooter['image_alt'] ?? 'Logo SupportPC' }}" style="max-width: 220px; height: auto; display: block; margin-bottom: 12px;">
</p>
@endif

{!! nl2br(e($mailFooter['content'])) !!}
@endif

Cordialement,
{{ config('app.name') }}
@endcomponent
