<?php

namespace App\Http\Controllers;

use App\Models\DiagEventNote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

/**
 * Shared knowledge base of the PC2 Diag event viewer: the technicians teach
 * it the Windows events it does not know, from the app or from the site, and
 * every paired app downloads the whole list.
 */
class DiagEventNoteController extends Controller
{
    /** The app downloads the whole list and keeps a copy for offline use. */
    public function apiIndex(): JsonResponse
    {
        $notes = $this->notes();

        return response()->json([
            'notes' => $notes,
            'updated_at' => collect($notes)->max('updated_at'),
        ]);
    }

    /** From the app: creates the note of this event, or updates it if a colleague already wrote one. */
    public function apiStore(Request $request): JsonResponse
    {
        $data = $this->validated($request, true);

        $note = DiagEventNote::query()
            ->where('source', $data['source'])
            ->where('event_id', $data['event_id'])
            ->first();
        $created = ! $note;

        $note = $this->save($note ?? new DiagEventNote, $data, $request);

        return response()->json(['note' => $note->toPayload()], $created ? 201 : 200);
    }

    public function index(): InertiaResponse
    {
        return Inertia::render('Diagnostics/EventNotes', [
            'notes' => $this->notes(),
            'severities' => DiagEventNote::SEVERITIES,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request, true);

        if (DiagEventNote::query()->where('source', $data['source'])->where('event_id', $data['event_id'])->exists()) {
            return back()->withErrors(['source' => 'PC2 Diag connaît déjà cet événement : modifiez sa fiche dans la liste.']);
        }

        $this->save(new DiagEventNote, $data, $request);

        return back()->with('success', 'Événement appris : il sera expliqué dans tous les PC2 Diag.');
    }

    public function update(Request $request, DiagEventNote $note): RedirectResponse
    {
        $this->save($note, $this->validated($request, false), $request);

        return back()->with('success', 'Fiche mise à jour.');
    }

    public function destroy(DiagEventNote $note): RedirectResponse
    {
        $note->delete();

        return back()->with('success', 'Fiche supprimée : PC2 Diag ne connaît plus cet événement.');
    }

    /** @return list<array<string, mixed>> */
    private function notes(): array
    {
        return DiagEventNote::query()
            ->with(['author:id,first_name,last_name,email', 'editor:id,first_name,last_name,email'])
            ->orderBy('source')
            ->orderBy('event_id')
            ->get()
            ->map(fn (DiagEventNote $note) => $note->toPayload())
            ->all();
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, bool $withEvent): array
    {
        // causes: one per line from the forms, or a list from the app
        if (is_string($request->input('causes'))) {
            $request->merge(['causes' => preg_split('/\R/', $request->input('causes'))]);
        }
        $request->merge(['causes' => collect($request->input('causes', []))
            ->filter(fn ($cause) => is_string($cause))
            ->map(fn (string $cause) => trim($cause))
            ->filter()
            ->values()
            ->all()]);

        $rules = [
            'sev' => ['required', Rule::in(DiagEventNote::SEVERITIES)],
            'noise' => 'boolean',
            'title' => 'required|string|max:160',
            'explain' => 'required|string|max:2000',
            'advice' => 'nullable|string|max:2000',
            'causes' => 'array|max:10',
            'causes.*' => 'string|max:200',
        ];
        if ($withEvent) {
            $rules['source'] = 'required|string|max:255';
            $rules['event_id'] = 'required|integer|min:0|max:4294967295';
        }

        $data = $request->validate($rules, [
            'title.required' => 'Donnez un titre à cet événement.',
            'explain.required' => 'Expliquez en une phrase ce que veut dire cet événement.',
            'causes.max' => '10 causes au plus.',
        ]);
        if ($withEvent) {
            $data['source'] = trim($data['source']);
        }
        $data['noise'] = (bool) ($data['noise'] ?? false);

        return $data;
    }

    private function save(DiagEventNote $note, array $data, Request $request): DiagEventNote
    {
        $note->fill($data);
        if (! $note->exists) {
            $note->created_by = $request->user()->id;
        } else {
            $note->updated_by = $request->user()->id;
        }
        $note->save();

        return $note->load(['author:id,first_name,last_name,email', 'editor:id,first_name,last_name,email']);
    }
}
