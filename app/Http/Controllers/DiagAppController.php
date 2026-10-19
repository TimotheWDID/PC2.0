<?php

namespace App\Http\Controllers;

use App\Models\DiagAppToken;
use App\Models\Diagnostic;
use App\Models\Ticket;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

/**
 * API of the PC2 Diag Windows application: it looks up tickets and sends
 * the diagnostic it ran, onto a ticket or as a quick diag. The pairing keys
 * are managed from the Diag rapide page.
 */
class DiagAppController extends DiagnosticController
{
    private const OPEN_STATUSES = ['open', 'in_progress', 'pending'];

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'user' => trim(($user->first_name ?? '').' '.($user->last_name ?? '')) ?: $user->email,
            'site' => config('app.name'),
            'url' => url('/'),
            'key_name' => $request->attributes->get('diag_app_token')?->name,
        ]);
    }

    /**
     * Open tickets, searched by number, title or client name.
     */
    public function tickets(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('q', ''));
        $number = preg_match('/^#?(\d+)$/', $search, $match) ? (int) $match[1] : null;

        $tickets = Ticket::query()
            ->with(['user:id,first_name,last_name', 'device'])
            ->when($number, fn (Builder $query) => $query->whereKey($number))
            ->when(! $number, fn (Builder $query) => $query->whereIn('status', self::OPEN_STATUSES))
            ->when(! $number && $search !== '', function (Builder $query) use ($search) {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $search).'%';
                $query->where(function (Builder $query) use ($like) {
                    $query->where('title', 'like', $like)
                        ->orWhereHas('user', fn (Builder $user) => $user
                            ->where('first_name', 'like', $like)
                            ->orWhere('last_name', 'like', $like)
                            ->orWhere('email', 'like', $like));
                });
            })
            ->latest()
            ->limit(30)
            ->get()
            ->map(fn (Ticket $ticket) => $this->ticketPayload($ticket));

        return response()->json(['tickets' => $tickets]);
    }

    public function ticket(Ticket $ticket): JsonResponse
    {
        $ticket->loadMissing(['user:id,first_name,last_name', 'device']);

        return response()->json(['ticket' => $this->ticketPayload($ticket)]);
    }

    /**
     * Diagnostic sent by the app: on the ticket when one is given (the
     * inventory fills its device, as from the Diag Atelier), else kept as a
     * quick diag to attach later.
     */
    public function submit(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ticket_id' => 'nullable|integer|min:1',
            'report' => 'required|array',
            'report.format' => 'required|in:diag-app',
            'inventory' => 'nullable|array',
        ]);

        // validated() keeps only the checked keys of report: read it whole
        $report = $request->input('report');

        if (strlen((string) json_encode($report)) > 3000000) {
            throw ValidationException::withMessages(['report' => 'Rapport trop volumineux.']);
        }

        $ticket = null;
        if (! empty($data['ticket_id'])) {
            $ticket = Ticket::query()->find($data['ticket_id']);
            if (! $ticket) {
                throw ValidationException::withMessages(['ticket_id' => "Le ticket #{$data['ticket_id']} n'existe pas."]);
            }
        }

        $inventory = $this->normalizeInventory($data['inventory'] ?? null);
        $machine = is_array($report['machine'] ?? null) ? $report['machine'] : [];
        $status = is_array($report['status'] ?? null) ? $report['status'] : [];
        $viability = is_array($report['viability'] ?? null) ? $report['viability'] : [];

        $diagnostic = Diagnostic::create([
            'ticket_id' => null,
            'technician_id' => Auth::id(),
            'machine_name' => $this->shortString($machine['name'] ?? null, 255),
            'overall' => in_array($status['overall'] ?? null, ['good', 'warn', 'crit'], true) ? $status['overall'] : null,
            'overall_label' => $this->shortString($status['overallLabel'] ?? null, 255),
            'viability_score' => isset($viability['score']) && is_numeric($viability['score'])
                ? max(0, min(100, (int) round($viability['score'])))
                : null,
            'viability_level' => $this->shortString($viability['level'] ?? null, 20),
            'viability_label' => $this->shortString($viability['verdict'] ?? null, 255),
            'report' => $report,
            'inventory' => $inventory ?: null,
        ]);

        if (! $ticket) {
            return response()->json([
                'id' => $diagnostic->id,
                'ticket' => null,
                'report_url' => route('diag.diagnostics.show', $diagnostic),
                'list_url' => route('diag.index'),
            ], 201);
        }

        $sync = $this->recordOnTicket($ticket, $diagnostic, $inventory);
        $device = $sync['device'];

        return response()->json([
            'id' => $diagnostic->id,
            'ticket' => ['id' => $ticket->id, 'title' => $ticket->title],
            'report_url' => route('tickets.diagnostics.show', [$ticket, $diagnostic]),
            'ticket_url' => route('tickets.show', $ticket),
            'device' => $device ? ['id' => $device->id, 'name' => $device->display_name] : null,
            'device_created' => $sync['created'],
            'filled' => $sync['filled'],
            'conflicts' => $sync['conflicts'],
            'warnings' => $sync['warnings'],
        ], 201);
    }

    /**
     * Pairs a new install of the app: the key is shown once on the Diag
     * rapide page, with a pc2diag:// link that hands it to the app.
     */
    public function issueToken(Request $request): RedirectResponse
    {
        $name = trim((string) ($request->validate(['name' => 'nullable|string|max:100'])['name'] ?? ''));

        [, $plain] = DiagAppToken::issue($request->user(), $name !== '' ? $name : 'Application Diag');

        return redirect()->route('diag.index')->with('diag_app_token', $plain);
    }

    public function revokeToken(Request $request, DiagAppToken $token): RedirectResponse
    {
        $user = $request->user();
        abort_unless((int) $token->user_id === (int) $user->id || $user->agent?->is_admin, 404);

        $token->delete();

        return back()->with('success', 'Clé révoquée : l\'application associée ne peut plus envoyer de diag.');
    }

    private function ticketPayload(Ticket $ticket): array
    {
        return [
            'id' => $ticket->id,
            'title' => $ticket->title,
            'status' => $ticket->status,
            'client' => $ticket->user ? trim(($ticket->user->first_name ?? '').' '.($ticket->user->last_name ?? '')) : null,
            'device' => $ticket->device?->display_name,
            'url' => route('tickets.show', $ticket),
        ];
    }
}
