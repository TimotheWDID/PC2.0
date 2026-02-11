@extends('layouts.app')

@section('content')
<div class="container">
    <h1>Créer un ticket</h1>
    <form action="{{ route('tickets.store') }}" method="POST">
        @csrf
        <div class="mb-3">
            <label for="subject" class="form-label">Sujet</label>
            <input type="text" name="subject" id="subject" class="form-control" value="{{ old('subject') }}" required>
            @error('subject')
                <div class="text-danger">{{ $message }}</div>
            @enderror
        </div>
        <div class="mb-3">
            <label for="description" class="form-label">Description</label>
            <textarea name="description" id="description" class="form-control" rows="4" required>{{ old('description') }}</textarea>
            @error('description')
                <div class="text-danger">{{ $message }}</div>
            @enderror
        </div>
        <div class="mb-3">
            <label for="category_id" class="form-label">Catégorie</label>
            <select name="category_id" id="category_id" class="form-control">
                <option value="">-- Sélectionner --</option>
                {{-- À remplir dynamiquement avec les catégories --}}
            </select>
        </div>
        <button type="submit" class="btn btn-success">Créer</button>
        <a href="{{ route('tickets.index') }}" class="btn btn-secondary">Annuler</a>
    </form>
</div>
@endsection
