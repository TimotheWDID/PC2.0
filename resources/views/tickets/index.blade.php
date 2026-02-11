<?php
Route::resource('tickets', \App\Http\Controllers\TicketController::class);
?>

@extends('layouts.app')

@section('content')
<div class="container">
    <h1>Liste des tickets</h1>
    <a href="{{ route('tickets.create') }}" class="btn btn-primary mb-3">Nouveau ticket</a>
    <table class="table table-bordered">
        <thead>
            <tr>
                <th>ID</th>
                <th>Sujet</th>
                <th>Statut</th>
                <th>Créé le</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
            @forelse($tickets as $ticket)
                <tr>
                    <td>{{ $ticket->id }}</td>
                    <td>{{ $ticket->subject ?? '-' }}</td>
                    <td>{{ $ticket->status ?? '-' }}</td>
                    <td>{{ $ticket->created_at->format('d/m/Y H:i') }}</td>
                    <td>
                        <a href="{{ route('tickets.show', $ticket->id) }}" class="btn btn-info btn-sm">Voir</a>
                        <a href="{{ route('tickets.edit', $ticket->id) }}" class="btn btn-warning btn-sm">Modifier</a>
                        <form action="{{ route('tickets.destroy', $ticket->id) }}" method="POST" style="display:inline-block">
                            @csrf
                            @method('DELETE')
                            <button type="submit" class="btn btn-danger btn-sm" onclick="return confirm('Supprimer ce ticket ?')">Supprimer</button>
                        </form>
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="5">Aucun ticket trouvé.</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</div>
@endsection
