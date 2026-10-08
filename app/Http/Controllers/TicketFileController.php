<?php

namespace App\Http\Controllers;

use App\Mail\TicketFilesSharedMail;
use App\Models\MessageAttachment;
use App\Models\Ticket;
use App\Models\TicketFile;
use App\Models\TicketTimelineEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

/**
 * Files of a ticket: the ones agents add directly to the ticket (internal or
 * shared with the customer) plus the ones posted in the chat. Agents can also
 * email ticket files to the customer.
 */
class TicketFileController extends Controller
{
    private const MIMES = 'jpg,jpeg,png,gif,webp,heic,bmp,pdf,doc,docx,odt,rtf,xls,xlsx,ods,csv,ppt,pptx,txt,xml,json,zip,7z,rar,mp4,mov,eml,msg';

    private const MAX_KB = 20480;

    private const MAX_COUNT = 10;

    /** Above this total, files are not attached to the email: the customer downloads them from the ticket page. */
    private const MAIL_ATTACHMENT_LIMIT_BYTES = 10 * 1024 * 1024;

    public function index(Request $request, Ticket $ticket): JsonResponse
    {
        $this->authorizeTicketAccess($request, $ticket);
        $isAgent = $this->isAgentContext();

        $files = $ticket->files()
            ->with('uploader:id,first_name,last_name')
            ->when(! $isAgent, fn ($query) => $query->where('visibility', TicketFile::VISIBILITY_EXTERNAL))
            ->latest()
            ->get()
            ->map(fn (TicketFile $file) => $this->serializeFile($ticket, $file, $isAgent));

        $chatFiles = MessageAttachment::query()
            ->whereHas('message', function ($query) use ($ticket, $isAgent) {
                $query->where('ticket_id', $ticket->id)
                    ->when(! $isAgent, fn ($q) => $q->where('is_internal', false));
            })
            ->with('message:id,ticket_id,author_id,is_internal', 'message.author:id,first_name,last_name')
            ->latest()
            ->get()
            ->map(fn (MessageAttachment $attachment) => [
                'id' => $attachment->id,
                'source' => 'chat',
                'name' => $attachment->original_name,
                'mime_type' => $attachment->mime_type,
                'size' => (int) $attachment->size,
                'visibility' => $attachment->message->is_internal ? TicketFile::VISIBILITY_INTERNAL : TicketFile::VISIBILITY_EXTERNAL,
                'created_at' => $attachment->created_at?->toIso8601String(),
                'uploaded_by' => $this->personName($attachment->message->author),
                'last_sent_at' => null,
                'last_sent_to' => null,
                'download_path' => "/tickets/{$ticket->id}/messages/{$attachment->message_id}/attachments/{$attachment->id}",
            ]);

        return response()->json([
            'files' => $files->concat($chatFiles)->sortByDesc('created_at')->values(),
            'customer_email' => $isAgent ? $this->customerEmail($ticket) : null,
            'limits' => [
                'max_kb' => self::MAX_KB,
                'max_count' => self::MAX_COUNT,
                'mimes' => self::MIMES,
            ],
        ]);
    }

    public function store(Request $request, Ticket $ticket): JsonResponse
    {
        $validated = $request->validate([
            'files' => ['required', 'array', 'min:1', 'max:'.self::MAX_COUNT],
            'files.*' => ['file', 'mimes:'.self::MIMES, 'max:'.self::MAX_KB],
            'visibility' => ['required', Rule::in(TicketFile::VISIBILITIES)],
        ], [
            'files.*.mimes' => 'Type de fichier non autorise.',
            'files.*.max' => 'Fichier trop volumineux (20 Mo maximum).',
        ]);

        $created = [];

        foreach ($request->file('files', []) as $upload) {
            $created[] = TicketFile::create([
                'ticket_id' => $ticket->id,
                'uploaded_by' => Auth::id(),
                'path' => $upload->store("tickets/{$ticket->id}/files", 'local'),
                'original_name' => $upload->getClientOriginalName(),
                'mime_type' => $upload->getClientMimeType(),
                'size' => (int) $upload->getSize(),
                'visibility' => $validated['visibility'],
            ]);
        }

        $names = collect($created)->pluck('original_name')->implode(', ');
        $this->logEvent($ticket, 'files_added', count($created) > 1
            ? count($created).' fichiers ajoutes au ticket'
            : 'Fichier ajoute au ticket', [
                'files' => $names,
                'visibility' => $validated['visibility'],
            ]);

        return response()->json([
            'files' => collect($created)->map(fn (TicketFile $file) => $this->serializeFile($ticket, $file->load('uploader:id,first_name,last_name'), true)),
        ], 201);
    }

    public function update(Request $request, Ticket $ticket, TicketFile $file): JsonResponse
    {
        abort_unless((int) $file->ticket_id === (int) $ticket->id, 404);

        $validated = $request->validate([
            'visibility' => ['required', Rule::in(TicketFile::VISIBILITIES)],
        ]);

        $file->update(['visibility' => $validated['visibility']]);

        return response()->json([
            'file' => $this->serializeFile($ticket, $file->load('uploader:id,first_name,last_name'), true),
        ]);
    }

    public function destroy(Ticket $ticket, TicketFile $file): JsonResponse
    {
        abort_unless((int) $file->ticket_id === (int) $ticket->id, 404);

        Storage::disk('local')->delete($file->path);
        $file->delete();

        $this->logEvent($ticket, 'file_removed', 'Fichier supprime du ticket', [
            'files' => $file->original_name,
        ]);

        return response()->json(['success' => true]);
    }

    public function download(Request $request, Ticket $ticket, TicketFile $file): BinaryFileResponse
    {
        abort_unless((int) $file->ticket_id === (int) $ticket->id, 404);
        $this->authorizeTicketAccess($request, $ticket);

        // Internal files are for agents only, even via a valid magic link.
        if (! $file->isExternal() && ! $this->isAgentContext()) {
            abort(403, 'Acces non autorise.');
        }

        abort_unless(Storage::disk('local')->exists($file->path), 404);

        return response()->download(Storage::disk('local')->path($file->path), $file->original_name);
    }

    /**
     * Email ticket files to the customer. Sent files become visible on the
     * customer's ticket page, so the link in the email always works.
     */
    public function send(Request $request, Ticket $ticket): JsonResponse
    {
        $validated = $request->validate([
            'file_ids' => ['required', 'array', 'min:1', 'max:20'],
            'file_ids.*' => ['integer'],
            'email' => ['required', 'email:filter', 'max:255'],
            'message' => ['nullable', 'string', 'max:5000'],
        ]);

        $files = $ticket->files()->whereIn('id', $validated['file_ids'])->get();

        if ($files->count() !== count(array_unique($validated['file_ids']))) {
            return response()->json(['message' => 'Fichier introuvable sur ce ticket.'], 422);
        }

        $missing = $files->first(fn (TicketFile $file) => ! Storage::disk('local')->exists($file->path));
        if ($missing) {
            return response()->json(['message' => "Le fichier {$missing->original_name} est introuvable sur le serveur."], 422);
        }

        $attachFiles = $files->sum('size') <= self::MAIL_ATTACHMENT_LIMIT_BYTES;
        $magicLinkUrl = $ticket->getOrCreateMagicLink()['url'] ?? null;

        try {
            Mail::to($validated['email'])->send(new TicketFilesSharedMail(
                $ticket->loadMissing('user'),
                $files,
                trim((string) ($validated['message'] ?? '')),
                $magicLinkUrl,
                $attachFiles,
            ));
        } catch (Throwable $exception) {
            Log::warning('Ticket files email failed', [
                'ticket_id' => $ticket->id,
                'error' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => "L'email n'a pas pu etre envoye : ".$exception->getMessage(),
            ], 502);
        }

        $now = now();
        foreach ($files as $file) {
            $file->forceFill([
                'visibility' => TicketFile::VISIBILITY_EXTERNAL,
                'last_sent_at' => $now,
                'last_sent_to' => $validated['email'],
            ])->save();
        }

        $this->logEvent($ticket, 'files_sent', 'Fichiers envoyes au client par email', [
            'files' => $files->pluck('original_name')->implode(', '),
            'email' => $validated['email'],
            'attached' => $attachFiles,
        ]);

        $files->load('uploader:id,first_name,last_name');

        return response()->json([
            'files' => $files->map(fn (TicketFile $file) => $this->serializeFile($ticket, $file, true))->values(),
            'attached' => $attachFiles,
        ]);
    }

    private function serializeFile(Ticket $ticket, TicketFile $file, bool $isAgent): array
    {
        return [
            'id' => $file->id,
            'source' => 'ticket',
            'name' => $file->original_name,
            'mime_type' => $file->mime_type,
            'size' => (int) $file->size,
            'visibility' => $file->visibility,
            'created_at' => $file->created_at?->toIso8601String(),
            'uploaded_by' => $isAgent ? $this->personName($file->uploader) : null,
            'last_sent_at' => $isAgent ? $file->last_sent_at?->toIso8601String() : null,
            'last_sent_to' => $isAgent ? $file->last_sent_to : null,
            'download_path' => "/tickets/{$ticket->id}/files/{$file->id}/download",
        ];
    }

    private function personName($user): ?string
    {
        if (! $user) {
            return null;
        }

        $name = trim(($user->first_name ?? '').' '.($user->last_name ?? ''));

        return $name !== '' ? $name : null;
    }

    private function customerEmail(Ticket $ticket): ?string
    {
        $ticket->loadMissing('user:id,email');
        $email = trim((string) ($ticket->contact_email ?: ($ticket->user?->email ?? '')));

        return $email !== '' ? $email : null;
    }

    private function logEvent(Ticket $ticket, string $type, string $summary, array $details): void
    {
        if (! $this->isAgentContext()) {
            return;
        }

        TicketTimelineEvent::create([
            'ticket_id' => $ticket->id,
            'technician_id' => Auth::id(),
            'event_type' => $type,
            'summary' => $summary,
            'details' => $details,
            'happened_at' => now(),
        ]);
    }

    private function isAgentContext(): bool
    {
        $user = Auth::user();

        if (! $user || ! $user->agent) {
            return false;
        }

        $sessionPreviewMode = request()->session()->get('preview_mode');
        $previewAsNonAgent = is_string($sessionPreviewMode)
            ? $sessionPreviewMode === 'user'
            : (bool) request()->session()->get('preview_as_non_agent', false);

        return ! $previewAsNonAgent;
    }

    private function hasMagicTokenAccess(Request $request, Ticket $ticket): bool
    {
        $token = trim((string) $request->query('token', ''));

        if ($token === '' || ! Ticket::looksLikeMagicToken($token)) {
            return false;
        }

        return hash_equals((string) $ticket->ticket_token_hash, Ticket::hashMagicToken($token))
            && ! $ticket->isMagicTokenExpired();
    }

    private function authorizeTicketAccess(Request $request, Ticket $ticket): void
    {
        $user = Auth::user();

        if (! $user) {
            abort_unless($this->hasMagicTokenAccess($request, $ticket), 403, 'Acces au ticket refuse: lien invalide ou expire.');

            return;
        }

        if ($this->isAgentContext()) {
            return;
        }

        abort_unless((int) $ticket->user_id === (int) $user->id, 403, 'Acces non autorise.');
    }
}
