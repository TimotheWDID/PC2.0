import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, User } from 'lucide-react';

export type ClientType = 'person' | 'company';

export type CompanyOption = {
    id: number;
    name: string;
};

export type ClientIdentityData = {
    client_type: ClientType;
    company_name: string;
    siret: string;
    company_id: string;
    first_name: string;
    last_name: string;
};

type Props = {
    data: ClientIdentityData;
    onChange: <K extends keyof ClientIdentityData>(
        key: K,
        value: ClientIdentityData[K],
    ) => void;
    errors?: Partial<Record<keyof ClientIdentityData, string>>;
    companies?: CompanyOption[];
    lockType?: boolean;
    idPrefix?: string;
};

const NO_COMPANY = '';

export function ClientTypeToggle({
    value,
    onChange,
    disabled = false,
}: {
    value: ClientType;
    onChange: (value: ClientType) => void;
    disabled?: boolean;
}) {
    const options: { value: ClientType; label: string; Icon: typeof User }[] = [
        { value: 'person', label: 'Personne', Icon: User },
        { value: 'company', label: 'Entreprise', Icon: Building2 },
    ];

    return (
        <div
            className="inline-flex rounded-lg border border-border bg-muted/30 p-1"
            role="radiogroup"
            aria-label="Type de client"
        >
            {options.map(({ value: optionValue, label, Icon }) => (
                <button
                    key={optionValue}
                    type="button"
                    role="radio"
                    aria-checked={value === optionValue}
                    disabled={disabled}
                    onClick={() => onChange(optionValue)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        value === optionValue
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Icon className="h-4 w-4" />
                    {label}
                </button>
            ))}
        </div>
    );
}

export function ClientTypeBadge({ type }: { type?: string | null }) {
    const isCompany = type === 'company';
    const Icon = isCompany ? Building2 : User;

    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
            <Icon className="h-3 w-3" />
            {isCompany ? 'Entreprise' : 'Personne'}
        </span>
    );
}

/**
 * Champs d'identité d'un client : raison sociale pour une entreprise,
 * prénom/nom et entreprise de rattachement (facultative) pour une personne.
 */
export default function ClientIdentityFields({
    data,
    onChange,
    errors = {},
    companies = [],
    lockType = false,
    idPrefix = '',
}: Props) {
    const isCompany = data.client_type === 'company';

    return (
        <div className="grid gap-4">
            <div className="grid gap-2">
                <Label>Type de client</Label>
                <div>
                    <ClientTypeToggle
                        value={data.client_type}
                        onChange={(value) => onChange('client_type', value)}
                        disabled={lockType}
                    />
                </div>
                {errors.client_type && (
                    <p className="text-sm text-destructive">
                        {errors.client_type}
                    </p>
                )}
            </div>

            {isCompany ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor={`${idPrefix}company_name`}>
                            Raison sociale *
                        </Label>
                        <Input
                            id={`${idPrefix}company_name`}
                            placeholder="Nom de l'entreprise"
                            value={data.company_name}
                            onChange={(e) =>
                                onChange('company_name', e.target.value)
                            }
                            required
                        />
                        {errors.company_name && (
                            <p className="text-sm text-destructive">
                                {errors.company_name}
                            </p>
                        )}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor={`${idPrefix}siret`}>SIRET</Label>
                        <Input
                            id={`${idPrefix}siret`}
                            placeholder="123 456 789 00012"
                            value={data.siret}
                            onChange={(e) => onChange('siret', e.target.value)}
                        />
                        {errors.siret && (
                            <p className="text-sm text-destructive">
                                {errors.siret}
                            </p>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor={`${idPrefix}first_name`}>
                                Prénom *
                            </Label>
                            <Input
                                id={`${idPrefix}first_name`}
                                placeholder="Prénom"
                                value={data.first_name}
                                onChange={(e) =>
                                    onChange('first_name', e.target.value)
                                }
                                required
                            />
                            {errors.first_name && (
                                <p className="text-sm text-destructive">
                                    {errors.first_name}
                                </p>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor={`${idPrefix}last_name`}>
                                Nom *
                            </Label>
                            <Input
                                id={`${idPrefix}last_name`}
                                placeholder="Nom"
                                value={data.last_name}
                                onChange={(e) =>
                                    onChange('last_name', e.target.value)
                                }
                                required
                            />
                            {errors.last_name && (
                                <p className="text-sm text-destructive">
                                    {errors.last_name}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor={`${idPrefix}company_id`}>
                            Entreprise (facultatif)
                        </Label>
                        <select
                            id={`${idPrefix}company_id`}
                            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                            value={data.company_id}
                            onChange={(e) =>
                                onChange('company_id', e.target.value)
                            }
                        >
                            <option value={NO_COMPANY}>
                                Aucune entreprise
                            </option>
                            {companies.map((company) => (
                                <option
                                    key={company.id}
                                    value={String(company.id)}
                                >
                                    {company.name}
                                </option>
                            ))}
                        </select>
                        {companies.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                                Aucune entreprise enregistrée pour le moment.
                            </p>
                        )}
                        {errors.company_id && (
                            <p className="text-sm text-destructive">
                                {errors.company_id}
                            </p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
