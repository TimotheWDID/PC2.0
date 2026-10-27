import Heading from '@/components/heading';
import MobileNativeNav from '@/components/mobile-native-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { formatDateTimeFr } from '@/lib/datetime';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import {
    FileText,
    Network,
    Pencil,
    Plus,
    Stethoscope,
    Trash2,
} from 'lucide-react';
import React from 'react';
import { AuditStatusBadge, type AuditRow } from './Index';

type Host = {
    ip: string;
    mac?: string;
    hostname?: string;
    vendor?: string;
    kind?: string;
    kind_hint?: string;
    ports?: number[];
    rtt_ms?: number;
    self?: boolean;
    gateway?: boolean;
};

type Scan = {
    id: number;
    created_at: string | null;
    technician: string | null;
    machine_name: string | null;
    subnet: string | null;
    local_ip: string | null;
    gateway: string | null;
    dns: string | null;
    public_ip: string | null;
    duration_ms: number | null;
    host_count: number;
    hosts: Host[];
};

type AuditDiagnostic = {
    id: number;
    created_at: string | null;
    technician: string | null;
    machine_name: string | null;
    overall: string | null;
    overall_label: string | null;
    viability_score: number | null;
    viability_level: string | null;
    viability_label: string | null;
    report_url: string;
};

type AuditDevice = {
    id: number;
    kind: string;
    kind_label: string;
    name: string;
    hostname: string | null;
    ip: string | null;
    mac: string | null;
    serial_number: string | null;
    location: string | null;
    assigned_to: string | null;
    status: string;
    source: string;
    open_ports: number[];
    notes: string | null;
    diagnosable: boolean;
    diagnostics_count: number | null;
    device: { id: number; name: string; url: string } | null;
    diagnostic: AuditDiagnostic | null;
    tool_url: string;
};

type DeviceForm = {
    kind: string;
    name: string;
    hostname: string;
    ip: string;
    mac: string;
    serial_number: string;
    location: string;
    assigned_to: string;
    status: string;
    notes: string;
    device_id: string;
};

const emptyForm = (): DeviceForm => ({
    kind: 'computer',
    name: '',
    hostname: '',
    ip: '',
    mac: '',
    serial_number: '',
    location: '',
    assigned_to: '',
    status: 'todo',
    notes: '',
    device_id: '',
});

const overallClass: Record<string, string> = {
    good: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    warn: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    crit: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
};

const overallLabel: Record<string, string> = {
    good: 'Bon état',
    warn: 'À surveiller',
    crit: 'Critique',
};

const ipKey = (ip?: string | null) =>
    (ip ?? '')
        .split('.')
        .map((part) => part.padStart(3, '0'))
        .join('.');

function DiagnosticBadge({ diagnostic }: { diagnostic: AuditDiagnostic }) {
    const level = diagnostic.overall ?? '';

    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${overallClass[level] ?? 'bg-muted text-muted-foreground'}`}
            title={diagnostic.overall_label ?? undefined}
        >
            {overallLabel[level] ?? 'Diagnostiqué'}
            {diagnostic.viability_score !== null
                ? ` · ${diagnostic.viability_score}/100`
                : ''}
        </span>
    );
}

export default function AuditShow({
    audit,
    client,
    devices,
    scans,
    kinds,
    deviceStatuses,
    statuses,
    clientDevices,
}: {
    audit: AuditRow & { notes: string | null; report_url: string };
    client: {
        id: number;
        name: string;
        client_type: string;
        email: string | null;
        phone: string | null;
        url: string;
    } | null;
    devices: AuditDevice[];
    scans: Scan[];
    kinds: Record<string, string>;
    deviceStatuses: Record<string, string>;
    statuses: Record<string, string>;
    clientDevices: { id: number; name: string }[];
}) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Audits', href: '/audits' },
        { title: client?.name ?? audit.title, href: audit.url },
    ];

    const [notes, setNotes] = React.useState(audit.notes ?? '');
    const [deviceOpen, setDeviceOpen] = React.useState(false);
    const [editing, setEditing] = React.useState<AuditDevice | null>(null);
    const [form, setForm] = React.useState<DeviceForm>(emptyForm());
    const [errors, setErrors] = React.useState<Record<string, string>>({});
    const [processing, setProcessing] = React.useState(false);
    const [scanId, setScanId] = React.useState<number | null>(
        scans[0]?.id ?? null,
    );
    const [picked, setPicked] = React.useState<string[]>([]);
    const [kindFilter, setKindFilter] = React.useState('all');

    const scan = scans.find((s) => s.id === scanId) ?? scans[0] ?? null;
    const knownMacs = new Set(devices.map((d) => d.mac).filter(Boolean));
    const knownIps = new Set(devices.map((d) => d.ip).filter(Boolean));
    const isKnown = (host: Host) =>
        (host.mac && knownMacs.has(host.mac)) || knownIps.has(host.ip);

    const counts = React.useMemo(
        () => ({
            devices: devices.length,
            diagnosed: devices.filter((d) => d.diagnostic).length,
            todo: devices.filter((d) => d.status === 'todo').length,
            crit: devices.filter((d) => d.diagnostic?.overall === 'crit')
                .length,
            warn: devices.filter((d) => d.diagnostic?.overall === 'warn')
                .length,
        }),
        [devices],
    );

    const shownDevices =
        kindFilter === 'all'
            ? devices
            : kindFilter === 'computers'
              ? devices.filter((d) => d.diagnosable)
              : devices.filter((d) => !d.diagnosable);

    const updateAudit = (data: { status?: string; notes?: string }) =>
        router.patch(audit.url, data, { preserveScroll: true });

    const openDevice = (device: AuditDevice | null) => {
        setEditing(device);
        setForm(
            device
                ? {
                      kind: device.kind,
                      name: device.name,
                      hostname: device.hostname ?? '',
                      ip: device.ip ?? '',
                      mac: device.mac ?? '',
                      serial_number: device.serial_number ?? '',
                      location: device.location ?? '',
                      assigned_to: device.assigned_to ?? '',
                      status: device.status,
                      notes: device.notes ?? '',
                      device_id: device.device ? String(device.device.id) : '',
                  }
                : emptyForm(),
        );
        setErrors({});
        setDeviceOpen(true);
    };

    const submitDevice = (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        const payload = {
            ...form,
            device_id: form.device_id ? Number(form.device_id) : null,
        };
        const options = {
            preserveScroll: true,
            onSuccess: () => setDeviceOpen(false),
            onError: (nextErrors: Record<string, string>) =>
                setErrors(nextErrors),
            onFinish: () => setProcessing(false),
        };
        if (editing) {
            router.patch(
                `${audit.url}/devices/${editing.id}`,
                payload,
                options,
            );
        } else {
            router.post(`${audit.url}/devices`, payload, options);
        }
    };

    const removeDevice = (device: AuditDevice) => {
        if (
            !window.confirm(
                `Retirer « ${device.name} » de l'audit ?${device.diagnostics_count ? ' Ses diagnostics seront supprimés.' : ''}`,
            )
        )
            return;
        router.delete(`${audit.url}/devices/${device.id}`, {
            preserveScroll: true,
        });
    };

    const addHosts = () => {
        if (!scan || picked.length === 0) return;
        router.post(
            `${audit.url}/network-scans/${scan.id}/hosts`,
            { ips: picked },
            { preserveScroll: true, onSuccess: () => setPicked([]) },
        );
    };

    const field = (key: keyof DeviceForm, label: string, placeholder = '') => (
        <div className="space-y-1.5">
            <Label htmlFor={`dev-${key}`}>{label}</Label>
            <Input
                id={`dev-${key}`}
                value={form[key]}
                placeholder={placeholder}
                onChange={(e) =>
                    setForm((current) => ({
                        ...current,
                        [key]: e.target.value,
                    }))
                }
            />
            {errors[key] && (
                <p className="text-sm text-destructive">{errors[key]}</p>
            )}
        </div>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Audit · ${client?.name ?? audit.title}`} />
            <div className="w-full space-y-4 py-2 sm:py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                        <Heading
                            title={client?.name ?? audit.title}
                            description={`${audit.title}${audit.site_name ? ` · ${audit.site_name}` : ''}`}
                        />
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <AuditStatusBadge
                                status={audit.status}
                                label={audit.status_label}
                            />
                            {client && (
                                <Link
                                    href={client.url}
                                    className="underline-offset-2 hover:underline"
                                >
                                    Fiche client
                                </Link>
                            )}
                            {audit.technician && (
                                <span>· {audit.technician}</span>
                            )}
                            <span>
                                · créé le {formatDateTimeFr(audit.created_at)}
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Select
                            value={audit.status}
                            onValueChange={(value) =>
                                updateAudit({ status: value })
                            }
                        >
                            <SelectTrigger className="w-44">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(statuses).map(
                                    ([value, label]) => (
                                        <SelectItem key={value} value={value}>
                                            {label}
                                        </SelectItem>
                                    ),
                                )}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" asChild>
                            <a
                                href={audit.report_url}
                                target="_blank"
                                rel="noreferrer"
                            >
                                <FileText className="h-4 w-4" />
                                Rapport d'audit
                            </a>
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                if (
                                    window.confirm(
                                        'Supprimer cet audit, ses scans, ses appareils et leurs diagnostics ? Les fiches appareils du client sont conservées.',
                                    )
                                )
                                    router.delete(audit.url);
                            }}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    {[
                        ['Appareils', counts.devices, ''],
                        ['Diagnostiqués', counts.diagnosed, ''],
                        [
                            'À diagnostiquer',
                            counts.todo,
                            counts.todo ? 'text-amber-600' : '',
                        ],
                        [
                            'Critiques',
                            counts.crit,
                            counts.crit ? 'text-red-600' : '',
                        ],
                        [
                            'À surveiller',
                            counts.warn,
                            counts.warn ? 'text-amber-600' : '',
                        ],
                    ].map(([label, value, cls]) => (
                        <Card key={label as string}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">
                                    {label}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className={`text-2xl font-semibold ${cls}`}>
                                    {value}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {devices.length === 0 && scans.length === 0 && (
                    <Card>
                        <CardContent className="space-y-1 pt-6 text-sm">
                            <p className="font-medium">Pour remplir l'audit</p>
                            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                                <li>
                                    Lancez PC2 Diag sur un PC du client et
                                    ouvrez <b>Audit</b> dans la barre du haut.
                                </li>
                                <li>
                                    Choisissez cet audit, puis{' '}
                                    <b>Scanner le réseau</b> : les équipements
                                    trouvés arrivent ici.
                                </li>
                                <li>
                                    Sur chaque PC : <b>Analyser</b>, puis{' '}
                                    <b>Envoyer à l'audit</b>. Le PC s'ajoute aux
                                    appareils avec son diagnostic.
                                </li>
                            </ol>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle>Appareils ({devices.length})</CardTitle>
                        <div className="flex flex-wrap gap-2">
                            <Select
                                value={kindFilter}
                                onValueChange={setKindFilter}
                            >
                                <SelectTrigger className="w-48">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        Tous les appareils
                                    </SelectItem>
                                    <SelectItem value="computers">
                                        Ordinateurs et serveurs
                                    </SelectItem>
                                    <SelectItem value="network">
                                        Réseau et périphériques
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <Button
                                variant="outline"
                                onClick={() => openDevice(null)}
                            >
                                <Plus className="h-4 w-4" />
                                Ajouter un appareil
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {shownDevices.length === 0 ? (
                            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                                Aucun appareil.
                            </p>
                        ) : (
                            <div className="divide-y">
                                {shownDevices.map((device) => (
                                    <div
                                        key={device.id}
                                        className="grid gap-2 px-4 py-3 md:grid-cols-[2fr_1.2fr_1.3fr_auto] md:items-center"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate font-medium">
                                                {device.name}
                                            </p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {device.kind_label}
                                                {device.ip
                                                    ? ` · ${device.ip}`
                                                    : ''}
                                                {device.hostname &&
                                                device.hostname !== device.name
                                                    ? ` · ${device.hostname}`
                                                    : ''}
                                                {device.serial_number
                                                    ? ` · S/N ${device.serial_number}`
                                                    : ''}
                                            </p>
                                            {device.device && (
                                                <Link
                                                    href={device.device.url}
                                                    className="text-xs text-primary hover:underline"
                                                >
                                                    Fiche appareil :{' '}
                                                    {device.device.name}
                                                </Link>
                                            )}
                                        </div>
                                        <div className="text-sm">
                                            {device.location ||
                                            device.assigned_to ? (
                                                <>
                                                    {device.location}
                                                    {device.location &&
                                                    device.assigned_to
                                                        ? ' · '
                                                        : ''}
                                                    {device.assigned_to}
                                                </>
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    -
                                                </span>
                                            )}
                                        </div>
                                        <div className="space-y-0.5">
                                            {device.diagnostic ? (
                                                <>
                                                    <DiagnosticBadge
                                                        diagnostic={
                                                            device.diagnostic
                                                        }
                                                    />
                                                    <p className="truncate text-xs text-muted-foreground">
                                                        {device.diagnostic
                                                            .overall_label ??
                                                            ''}{' '}
                                                        ·{' '}
                                                        {formatDateTimeFr(
                                                            device.diagnostic
                                                                .created_at,
                                                        )}
                                                    </p>
                                                </>
                                            ) : (
                                                <Badge variant="outline">
                                                    {deviceStatuses[
                                                        device.status
                                                    ] ?? device.status}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap justify-end gap-1">
                                            {device.diagnostic && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    asChild
                                                >
                                                    <a
                                                        href={
                                                            device.diagnostic
                                                                .report_url
                                                        }
                                                    >
                                                        Rapport
                                                    </a>
                                                </Button>
                                            )}
                                            {device.diagnosable && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    title="Diag Atelier dans le navigateur (HWiNFO, rapport batterie, analyse PC2 Diag)"
                                                    asChild
                                                >
                                                    <a href={device.tool_url}>
                                                        <Stethoscope className="h-4 w-4" />
                                                    </a>
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                    openDevice(device)
                                                }
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                    removeDevice(device)
                                                }
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Network className="h-5 w-5" />
                            Réseau
                        </CardTitle>
                        {scans.length > 1 && (
                            <Select
                                value={String(scan?.id ?? '')}
                                onValueChange={(value) => {
                                    setScanId(Number(value));
                                    setPicked([]);
                                }}
                            >
                                <SelectTrigger className="w-72">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {scans.map((s) => (
                                        <SelectItem
                                            key={s.id}
                                            value={String(s.id)}
                                        >
                                            {formatDateTimeFr(s.created_at)} ·{' '}
                                            {s.subnet ?? '?'} · {s.host_count}{' '}
                                            équipement(s)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {!scan ? (
                            <p className="text-sm text-muted-foreground">
                                Aucun scan réseau. Dans PC2 Diag, ouvrez{' '}
                                <b>Audit</b>, choisissez cet audit puis{' '}
                                <b>Scanner le réseau</b>.
                            </p>
                        ) : (
                            <>
                                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                                    <p>
                                        <span className="text-muted-foreground">
                                            Réseau :{' '}
                                        </span>
                                        {scan.subnet ?? '-'}
                                    </p>
                                    <p>
                                        <span className="text-muted-foreground">
                                            Passerelle :{' '}
                                        </span>
                                        {scan.gateway ?? '-'}
                                    </p>
                                    <p>
                                        <span className="text-muted-foreground">
                                            DNS :{' '}
                                        </span>
                                        {scan.dns ?? '-'}
                                    </p>
                                    <p>
                                        <span className="text-muted-foreground">
                                            IP publique :{' '}
                                        </span>
                                        {scan.public_ip ?? '-'}
                                    </p>
                                    <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">
                                        Scan du{' '}
                                        {formatDateTimeFr(scan.created_at)}
                                        {scan.machine_name
                                            ? ` depuis ${scan.machine_name}`
                                            : ''}
                                        {scan.technician
                                            ? ` par ${scan.technician}`
                                            : ''}
                                        {scan.duration_ms
                                            ? ` · ${Math.round(scan.duration_ms / 1000)} s`
                                            : ''}{' '}
                                        ·{' '}
                                        <button
                                            type="button"
                                            className="underline"
                                            onClick={() => {
                                                if (
                                                    window.confirm(
                                                        'Supprimer ce scan réseau ?',
                                                    )
                                                )
                                                    router.delete(
                                                        `${audit.url}/network-scans/${scan.id}`,
                                                        {
                                                            preserveScroll: true,
                                                        },
                                                    );
                                            }}
                                        >
                                            supprimer
                                        </button>
                                    </p>
                                </div>
                                <div className="overflow-x-auto rounded-md border">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                                            <tr>
                                                <th className="w-8 px-3 py-2"></th>
                                                <th className="px-3 py-2">
                                                    Adresse IP
                                                </th>
                                                <th className="px-3 py-2">
                                                    Nom
                                                </th>
                                                <th className="px-3 py-2">
                                                    MAC / fabricant
                                                </th>
                                                <th className="px-3 py-2">
                                                    Type
                                                </th>
                                                <th className="px-3 py-2">
                                                    Ports ouverts
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {[...scan.hosts]
                                                .sort((a, b) =>
                                                    ipKey(a.ip).localeCompare(
                                                        ipKey(b.ip),
                                                    ),
                                                )
                                                .map((host) => {
                                                    const known = isKnown(host);
                                                    return (
                                                        <tr key={host.ip}>
                                                            <td className="px-3 py-2">
                                                                {known ? null : (
                                                                    <Checkbox
                                                                        checked={picked.includes(
                                                                            host.ip,
                                                                        )}
                                                                        onCheckedChange={(
                                                                            checked,
                                                                        ) =>
                                                                            setPicked(
                                                                                (
                                                                                    current,
                                                                                ) =>
                                                                                    checked
                                                                                        ? [
                                                                                              ...current,
                                                                                              host.ip,
                                                                                          ]
                                                                                        : current.filter(
                                                                                              (
                                                                                                  ip,
                                                                                              ) =>
                                                                                                  ip !==
                                                                                                  host.ip,
                                                                                          ),
                                                                            )
                                                                        }
                                                                    />
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 font-mono text-xs">
                                                                {host.ip}
                                                                {host.gateway && (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="ml-1"
                                                                    >
                                                                        passerelle
                                                                    </Badge>
                                                                )}
                                                                {host.self && (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="ml-1"
                                                                    >
                                                                        PC du
                                                                        scan
                                                                    </Badge>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                {host.hostname ??
                                                                    '-'}
                                                                {known && (
                                                                    <span className="block text-xs text-emerald-700 dark:text-emerald-400">
                                                                        Dans
                                                                        l'audit
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 text-xs">
                                                                <span className="font-mono">
                                                                    {host.mac ??
                                                                        '-'}
                                                                </span>
                                                                {host.vendor && (
                                                                    <span className="block text-muted-foreground">
                                                                        {
                                                                            host.vendor
                                                                        }
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 text-xs">
                                                                {kinds[
                                                                    host.kind ??
                                                                        ''
                                                                ] ?? '-'}
                                                                {host.kind_hint && (
                                                                    <span className="block text-muted-foreground">
                                                                        {
                                                                            host.kind_hint
                                                                        }
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 text-xs">
                                                                {(
                                                                    host.ports ??
                                                                    []
                                                                ).join(', ') ||
                                                                    '-'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setPicked(
                                                scan.hosts
                                                    .filter((h) => !isKnown(h))
                                                    .map((h) => h.ip),
                                            )
                                        }
                                    >
                                        Tout sélectionner
                                    </Button>
                                    <Button
                                        size="sm"
                                        disabled={picked.length === 0}
                                        onClick={addHosts}
                                    >
                                        Ajouter {picked.length || ''} aux
                                        appareils
                                    </Button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Observations</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Textarea
                            rows={5}
                            value={notes}
                            placeholder="Constats généraux, sauvegardes, licences, recommandations… (repris dans le rapport d'audit)"
                            onChange={(e) => setNotes(e.target.value)}
                        />
                        <div className="flex justify-end">
                            <Button
                                variant="outline"
                                disabled={notes === (audit.notes ?? '')}
                                onClick={() => updateAudit({ notes })}
                            >
                                Enregistrer
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={deviceOpen} onOpenChange={setDeviceOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editing
                                ? "Modifier l'appareil"
                                : 'Ajouter un appareil'}
                        </DialogTitle>
                        <DialogDescription>
                            Un ordinateur se complète tout seul quand PC2 Diag
                            envoie son diagnostic à l'audit.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={submitDevice} className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label>Type</Label>
                                <Select
                                    value={form.kind}
                                    onValueChange={(value) =>
                                        setForm((c) => ({ ...c, kind: value }))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(kinds).map(
                                            ([value, label]) => (
                                                <SelectItem
                                                    key={value}
                                                    value={value}
                                                >
                                                    {label}
                                                </SelectItem>
                                            ),
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            {field(
                                'name',
                                'Nom *',
                                'Poste accueil, imprimante RDC…',
                            )}
                            {field(
                                'location',
                                'Emplacement',
                                'Accueil, bureau 2…',
                            )}
                            {field('assigned_to', 'Utilisateur', 'Julie')}
                            {field('ip', 'Adresse IP', '192.168.1.20')}
                            {field('mac', 'Adresse MAC')}
                            {field('hostname', 'Nom réseau')}
                            {field('serial_number', 'N° de série')}
                            <div className="space-y-1.5">
                                <Label>État</Label>
                                <Select
                                    value={form.status}
                                    onValueChange={(value) =>
                                        setForm((c) => ({
                                            ...c,
                                            status: value,
                                        }))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(deviceStatuses).map(
                                            ([value, label]) => (
                                                <SelectItem
                                                    key={value}
                                                    value={value}
                                                >
                                                    {label}
                                                </SelectItem>
                                            ),
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Fiche appareil du client</Label>
                                <Select
                                    value={form.device_id || 'none'}
                                    onValueChange={(value) =>
                                        setForm((c) => ({
                                            ...c,
                                            device_id:
                                                value === 'none' ? '' : value,
                                        }))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">
                                            Aucune
                                        </SelectItem>
                                        {clientDevices.map((d) => (
                                            <SelectItem
                                                key={d.id}
                                                value={String(d.id)}
                                            >
                                                {d.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.device_id && (
                                    <p className="text-sm text-destructive">
                                        {errors.device_id}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="dev-notes">Notes</Label>
                            <Textarea
                                id="dev-notes"
                                rows={3}
                                value={form.notes}
                                onChange={(e) =>
                                    setForm((c) => ({
                                        ...c,
                                        notes: e.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDeviceOpen(false)}
                            >
                                Annuler
                            </Button>
                            <Button type="submit" disabled={processing}>
                                {editing ? 'Enregistrer' : 'Ajouter'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
            <MobileNativeNav showFab={false} />
        </AppLayout>
    );
}
