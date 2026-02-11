@component('mail::message')
# Ticket #{{ $ticket->id }}: {{ $ticket->title }}

Bonjour {{ $user->first_name }},

Vous avez un nouveau message sur votre ticket.

@component('mail::panel')
{!! nl2br(e($messageBody)) !!}
@endcomponent

@component('mail::button', ['url' => route('tickets.show', $ticket->id)])
Voir le ticket
@endcomponent

Vous pouvez aussi répondre directement à cet email pour ajouter une réponse au ticket.

Cordialement,
{{ config('app.name') }}
@endcomponent
