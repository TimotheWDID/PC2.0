import Heading from '@/components/heading';
import MobileNativeNav from '@/components/mobile-native-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { formatDateTimeFr } from '@/lib/datetime';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

type Severity = 'crit' | 'warn' | 'info';

type EventNote = {
    id: number;
    source: string;
    event_id: number;
    sev: Severity;
    noise: boolean;
    title: string;
    explain: string;
    advice: string | null;
    causes: string[];
    by: string | null;
    created_at: string | null;
    updated_at: string | null;
};

type NoteForm = {
    source: string;
    event_id: string;
    sev: Severity;
    noise: boolean;
    title: string;
    explain: string;
    advice: string;
    causes: string;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Diag rapide', href: '/diag' },
    { title: 'Événements appris', href: '/diag/event-notes' },
];

const severityLabel: Record<Severity, string> = {
    crit: 'Grave',
    warn: 'À surveiller',
    info: 'Pour information',
};

const severityClass: Record<Severity, string> = {
    crit: 'border-red-600/40 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    warn: 'border-amber-600/40 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    info: 'border-sky-600/40 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
};

const emptyForm: NoteForm = {
    source: '',
    event_id: '',
    sev: 'warn',
    noise: false,
    title: '',
    explain: '',
    advice: '',
    causes: '',
};

const formFromNote = (note: EventNote): NoteForm => ({
    source: note.source,
    event_id: String(note.event_id),
    sev: note.sev,
    noise: note.noise,
    title: note.title,
    explain: note.explain,
    advice: note.advice ?? '',
    causes: note.causes.join('\n'),
});

function NoteFields({
    note,
    severities,
    onDone,
}: {
    note: EventNote | null;
    severities: Severity[];
    onDone: () => void;
}) {
    const { data, setData, post, patch, processing, errors } =
        useForm<NoteForm>(note ? formFromNote(note) : emptyForm);

    const submit = () => {
        const options = { preserveScroll: true, onSuccess: onDone };
        if (note) {
            patch(`/diag/event-notes/${note.id}`, options);
        } else {
            post('/diag/event-notes', options);
        }
    };

    return (
        <form
            className="space-y-3 text-sm"
            onSubmit={(event) => {
                event.preventDefault();
                submit();
            }}
        >
            {note ? (
                <p className="font-mono text-xs text-muted-foreground">
                    Source {note.source} · n° {note.event_id}
                </p>
            ) : (
                <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
                    <label className="space-y-1">
                        <span className="text-xs font-medium">
                            Source (fournisseur)
                        </span>
                        <Input
                            value={data.source}
                            onChange={(event) =>
                                setData('source', event.target.value)
                            }
                            placeholder="Ex : Microsoft-Windows-DistributedCOM"
                            maxLength={255}
                        />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-medium">
                            N° d’événement
                        </span>
                        <Input
                            inputMode="numeric"
                            value={data.event_id}
                            onChange={(event) =>
                                setData(
                                    'event_id',
                                    event.target.value.replace(/\D/g, ''),
                                )
                            }
                            placeholder="Ex : 10016"
                        />
                    </label>
                    {(errors.source || errors.event_id) && (
                        <p className="text-xs text-red-600 sm:col-span-2">
                            {errors.source ?? errors.event_id}
                        </p>
                    )}
                </div>
            )}
            <label className="block space-y-1">
                <span className="text-xs font-medium">Titre</span>
                <Input
                    value={data.title}
                    onChange={(event) => setData('title', event.target.value)}
                    placeholder="Ex : Le pilote Wi-Fi a perdu la connexion"
                    maxLength={160}
                />
                {errors.title && (
                    <p className="text-xs text-red-600">{errors.title}</p>
                )}
            </label>
            <label className="block space-y-1">
                <span className="text-xs font-medium">
                    Ce que ça veut dire
                </span>
                <Textarea
                    value={data.explain}
                    onChange={(event) =>
                        setData('explain', event.target.value)
                    }
                    rows={3}
                    maxLength={2000}
                />
                {errors.explain && (
                    <p className="text-xs text-red-600">{errors.explain}</p>
                )}
            </label>
            <label className="block space-y-1">
                <span className="text-xs font-medium">
                    D’où ça vient le plus souvent (une cause par ligne, la plus
                    fréquente d’abord)
                </span>
                <Textarea
                    value={data.causes}
                    onChange={(event) => setData('causes', event.target.value)}
                    rows={3}
                />
                {errors.causes && (
                    <p className="text-xs text-red-600">{errors.causes}</p>
                )}
            </label>
            <label className="block space-y-1">
                <span className="text-xs font-medium">Que faire</span>
                <Textarea
                    value={data.advice}
                    onChange={(event) => setData('advice', event.target.value)}
                    rows={2}
                    maxLength={2000}
                />
            </label>
            <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2">
                    <span className="text-xs font-medium">Gravité</span>
                    <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                        value={data.sev}
                        onChange={(event) =>
                            setData('sev', event.target.value as Severity)
                        }
                    >
                        {severities.map((sev) => (
                            <option key={sev} value={sev}>
                                {severityLabel[sev]}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex items-center gap-2 text-xs">
                    <input
                        type="checkbox"
                        checked={data.noise}
                        onChange={(event) =>
                            setData('noise', event.target.checked)
                        }
                    />
                    Sans gravité : masqué par défaut dans PC2 Diag
                </label>
            </div>
            <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={processing}>
                    {note ? 'Enregistrer' : 'Apprendre cet événement'}
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onDone}
                >
                    Annuler
                </Button>
            </div>
        </form>
    );
}

export default function EventNotes({
    notes,
    severities,
}: {
    notes: EventNote[];
    severities: Severity[];
}) {
    const [editing, setEditing] = useState<number | 'new' | null>(null);
    const [query, setQuery] = useState('');

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) {
            return notes;
        }

        return notes.filter((note) =>
            [note.source, String(note.event_id), note.title, note.explain]
                .join(' ')
                .toLowerCase()
                .includes(q),
        );
    }, [notes, query]);

    const remove = (note: EventNote) => {
        if (
            !window.confirm(
                `Supprimer la fiche « ${note.title} » ? PC2 Diag ne saura plus expliquer cet événement.`,
            )
        ) {
            return;
        }

        router.delete(`/diag/event-notes/${note.id}`, {
            preserveScroll: true,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Événements appris" />
            <div className="space-y-4 py-2 sm:py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <Heading
                        title="Événements appris par PC2 Diag"
                        description="Ce que les techniciens ont appris à l’observateur d’événements de PC2 Diag. Chaque application associée télécharge cette liste à la lecture des journaux : une fiche écrite ici sert sur tous les postes."
                    />
                    <Button
                        size="sm"
                        onClick={() => setEditing('new')}
                        disabled={editing === 'new'}
                    >
                        <Plus className="mr-1 h-4 w-4" />
                        Ajouter un événement
                    </Button>
                </div>

                {editing === 'new' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Nouvel événement</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <NoteFields
                                note={null}
                                severities={severities}
                                onDone={() => setEditing(null)}
                            />
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4" />
                            {notes.length} événement(s) appris
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {notes.length > 5 && (
                            <Input
                                type="search"
                                className="h-8 max-w-sm"
                                value={query}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                                placeholder="Rechercher (source, n°, titre…)"
                            />
                        )}
                        {notes.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Aucun événement appris pour l’instant. Dans PC2
                                Diag, ouvrez un événement inconnu de
                                l’observateur d’événements et cliquez
                                « Apprendre cet événement à PC2 Diag ».
                            </p>
                        ) : (
                            shown.map((note) => (
                                <div
                                    key={note.id}
                                    className="rounded-md border p-3"
                                >
                                    {editing === note.id ? (
                                        <NoteFields
                                            note={note}
                                            severities={severities}
                                            onDone={() => setEditing(null)}
                                        />
                                    ) : (
                                        <>
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            note.noise
                                                                ? ''
                                                                : severityClass[
                                                                      note.sev
                                                                  ]
                                                        }
                                                    >
                                                        {note.noise
                                                            ? 'Sans gravité'
                                                            : severityLabel[
                                                                  note.sev
                                                              ]}
                                                    </Badge>
                                                    <span className="font-medium">
                                                        {note.title}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 px-2 text-xs"
                                                        onClick={() =>
                                                            setEditing(note.id)
                                                        }
                                                    >
                                                        <Pencil className="mr-1 h-3 w-3" />
                                                        Modifier
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 px-2 text-xs text-muted-foreground"
                                                        onClick={() =>
                                                            remove(note)
                                                        }
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                        <span className="sr-only">
                                                            Supprimer
                                                        </span>
                                                    </Button>
                                                </div>
                                            </div>
                                            <p className="mt-2 text-sm">
                                                {note.explain}
                                            </p>
                                            {note.causes.length > 0 && (
                                                <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-sm text-muted-foreground">
                                                    {note.causes.map(
                                                        (cause, index) => (
                                                            <li key={index}>
                                                                {cause}
                                                            </li>
                                                        ),
                                                    )}
                                                </ol>
                                            )}
                                            {note.advice && (
                                                <p className="mt-2 text-sm">
                                                    <span className="font-medium">
                                                        Que faire :
                                                    </span>{' '}
                                                    {note.advice}
                                                </p>
                                            )}
                                            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                                                Source {note.source} · n°{' '}
                                                {note.event_id}
                                                {note.by
                                                    ? ` · ${note.by}, ${formatDateTimeFr(note.updated_at)}`
                                                    : ''}
                                            </p>
                                        </>
                                    )}
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
            <MobileNativeNav showFab={false} />
        </AppLayout>
    );
}
