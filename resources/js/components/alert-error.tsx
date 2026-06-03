import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircleIcon } from 'lucide-react';
import { useMemo } from 'react';

export default function AlertError({
    errors,
    title,
    reportContext,
}: {
    errors: string[];
    title?: string;
    reportContext?: string;
}) {
    const reportHref = useMemo(() => {
        if (!reportContext) {
            return null;
        }

        const sanitizedErrors = Array.from(new Set(errors))
            .map((error) => error.trim())
            .filter(Boolean)
            .slice(0, 8)
            .join('\n- ');

        const reportTitle = `Signalement automatique - ${reportContext}`;
        const reportMessage = [
            `Contexte: ${reportContext}`,
            `Page: ${typeof window !== 'undefined' ? window.location.pathname : ''}`,
            '',
            'Erreurs observées:',
            sanitizedErrors ? `- ${sanitizedErrors}` : '- Aucune erreur détaillée fournie',
        ].join('\n');

        const params = new URLSearchParams({
            special_only: '1',
            ticket_kind: 'bug',
            report_title: reportTitle,
            report_message: reportMessage,
        });

        return `/tickets/bugs-improvements/create?${params.toString()}`;
    }, [errors, reportContext]);

    return (
        <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>{title || 'Something went wrong.'}</AlertTitle>
            <AlertDescription>
                <ul className="list-inside list-disc text-sm">
                    {Array.from(new Set(errors)).map((error, index) => (
                        <li key={index}>{error}</li>
                    ))}
                </ul>
                {reportHref && (
                    <div className="mt-4">
                        <Button asChild variant="outline" size="sm">
                            <a href={reportHref}>Signaler le bug</a>
                        </Button>
                    </div>
                )}
            </AlertDescription>
        </Alert>
    );
}
