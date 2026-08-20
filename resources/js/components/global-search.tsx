import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { Computer, Loader2, Search, ShoppingCart, Ticket, User } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

type SearchResult = {
    id: string;
    type: 'ticket' | 'user' | 'commande' | 'device';
    type_label: string;
    title: string;
    subtitle: string;
    status_key: string;
    status_label: string;
    href: string;
};

const MIN_QUERY_LENGTH = 2;

const typeBadgeClass: Record<SearchResult['type'], string> = {
    ticket: 'bg-blue-100 text-blue-800 border-blue-200',
    user: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    commande: 'bg-amber-100 text-amber-800 border-amber-200',
    device: 'bg-cyan-100 text-cyan-800 border-cyan-200',
};

const statusBadgeClass = (statusKey: string): string => {
    switch (statusKey) {
        case 'open':
        case 'new':
            return 'bg-sky-100 text-sky-800 border-sky-200';
        case 'in_progress':
        case 'commandé':
        case 'panier':
            return 'bg-indigo-100 text-indigo-800 border-indigo-200';
        case 'pending':
            return 'bg-orange-100 text-orange-800 border-orange-200';
        case 'resolved':
        case 'closed':
        case 'traité':
        case 'traite':
        case 'receptionner':
        case 'réceptionner':
            return 'bg-green-100 text-green-800 border-green-200';
        default:
            return 'bg-muted text-muted-foreground border-border';
    }
};

const iconForType = (type: SearchResult['type']) => {
    if (type === 'ticket') return Ticket;
    if (type === 'commande') return ShoppingCart;
    if (type === 'device') return Computer;
    return User;
};

export function GlobalSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        const onPointerDown = (event: MouseEvent) => {
            if (!rootRef.current) return;
            if (!rootRef.current.contains(event.target as Node)) {
                setIsFocused(false);
            }
        };

        document.addEventListener('mousedown', onPointerDown);

        return () => {
            document.removeEventListener('mousedown', onPointerDown);
        };
    }, []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const isShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';

            if (!isShortcut) {
                return;
            }

            event.preventDefault();
            setIsFocused(true);
            inputRef.current?.focus();
            inputRef.current?.select();
        };

        window.addEventListener('keydown', onKeyDown);

        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, []);

    useEffect(() => {
        const term = query.trim();

        if (term.length < MIN_QUERY_LENGTH) {
            setResults([]);
            setIsLoading(false);
            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            try {
                setIsLoading(true);
                const response = await fetch(`/search/global?q=${encodeURIComponent(term)}`, {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json',
                    },
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch search results');
                }

                const payload = (await response.json()) as { results?: SearchResult[] };
                setResults(Array.isArray(payload.results) ? payload.results : []);
            } catch (error) {
                if (!controller.signal.aborted) {
                    setResults([]);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        }, 220);

        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [query]);

    const shouldOpenPanel = useMemo(() => {
        if (!isFocused) return false;
        if (query.trim().length < MIN_QUERY_LENGTH) return false;

        return true;
    }, [isFocused, query]);

    return (
        <div ref={rootRef} className="relative w-full max-w-md">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => setIsFocused(true)}
                placeholder="Rechercher ticket, client, commande..."
                className="h-11 rounded-full border-border/70 bg-background pl-10 pr-20 text-sm"
            />
            {isLoading ? (
                <Loader2 className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin" />
            ) : (
                <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-md border border-border/70 px-1.5 py-0.5 text-[10px] font-medium">
                    Ctrl+K
                </span>
            )}

            {shouldOpenPanel ? (
                <div className="bg-popover absolute top-11 z-50 w-full overflow-hidden rounded-xl border border-border/80 shadow-lg">
                    <div className="border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
                        {results.length > 0
                            ? `${results.length} resultat(s)`
                            : 'Aucun resultat'}
                    </div>

                    <div className="max-h-96 overflow-y-auto p-1.5">
                        {results.map((item) => {
                            const TypeIcon = iconForType(item.type);

                            return (
                                <Link
                                    key={item.id}
                                    href={item.href}
                                    onClick={() => setIsFocused(false)}
                                    className="hover:bg-muted/70 focus-visible:bg-muted/70 flex items-start gap-2 rounded-lg px-2 py-2.5 transition-colors"
                                >
                                    <span className="mt-0.5 rounded-md border border-border/80 p-1.5 text-muted-foreground">
                                        <TypeIcon className="h-3.5 w-3.5" />
                                    </span>

                                    <span className="min-w-0 flex-1">
                                        <span className="mb-1 flex flex-wrap items-center gap-1.5">
                                            <Badge
                                                variant="outline"
                                                className={cn('text-[10px] uppercase tracking-wide', typeBadgeClass[item.type])}
                                            >
                                                {item.type_label}
                                            </Badge>
                                            {item.status_label ? (
                                                <Badge
                                                    variant="outline"
                                                    className={cn('text-[10px]', statusBadgeClass(item.status_key))}
                                                >
                                                    {item.status_label}
                                                </Badge>
                                            ) : null}
                                        </span>

                                        <span className="block truncate text-sm font-medium text-foreground">
                                            {item.title}
                                        </span>
                                        {item.subtitle ? (
                                            <span className="block truncate text-xs text-muted-foreground">
                                                {item.subtitle}
                                            </span>
                                        ) : null}
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
