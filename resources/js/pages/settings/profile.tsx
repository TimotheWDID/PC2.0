import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import { send } from '@/routes/verification';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Transition } from '@headlessui/react';
import { Form, Head, Link, usePage } from '@inertiajs/react';

import DeleteUser from '@/components/delete-user';
import HeadingSmall from '@/components/heading-small';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { edit } from '@/routes/profile';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Paramètres du profil',
        href: edit().url,
    },
];

export default function Profile({
    mustVerifyEmail,
    status,
}: {
    mustVerifyEmail: boolean;
    status?: string;
}) {
    const { auth } = usePage<SharedData>().props;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Paramètres du profil" />

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall
                        title="Informations du profil"
                        description="Mettez à jour vos informations personnelles"
                    />

                    <Form
                        {...ProfileController.update.form()}
                        options={{
                            preserveScroll: true,
                        }}
                        className="space-y-6"
                    >
                        {({ processing, recentlySuccessful, errors }) => (
                            <>

                                <div className="grid gap-2 md:grid-cols-2 md:gap-4">
                                    <div>
                                        <Label htmlFor="first_name">Prénom</Label>
                                        <Input
                                            id="first_name"
                                            className="mt-1 block w-full"
                                            defaultValue={auth.user.first_name ?? ''}
                                            name="first_name"
                                            required
                                            autoComplete="given-name"
                                            placeholder="Prénom"
                                        />
                                        <InputError
                                            className="mt-2"
                                            message={errors.first_name}
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="last_name">Nom</Label>
                                        <Input
                                            id="last_name"
                                            className="mt-1 block w-full"
                                            defaultValue={auth.user.last_name ?? ''}
                                            name="last_name"
                                            required
                                            autoComplete="family-name"
                                            placeholder="Nom"
                                        />
                                        <InputError
                                            className="mt-2"
                                            message={errors.last_name}
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="email">Adresse email</Label>

                                    <Input
                                        id="email"
                                        type="email"
                                        className="mt-1 block w-full"
                                        defaultValue={auth.user.email}
                                        name="email"
                                        required
                                        autoComplete="username"
                                        placeholder="Adresse email"
                                    />

                                    <InputError
                                        className="mt-2"
                                        message={errors.email}
                                    />
                                </div>

                                <div className="grid gap-2 md:grid-cols-2 md:gap-4">
                                    <div>
                                        <Label htmlFor="phone">Téléphone</Label>
                                        <Input
                                            id="phone"
                                            className="mt-1 block w-full"
                                            defaultValue={auth.user.phone ?? ''}
                                            name="phone"
                                            autoComplete="tel"
                                            placeholder="Numéro de téléphone"
                                        />
                                        <InputError
                                            className="mt-2"
                                            message={errors.phone}
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="address">Adresse</Label>
                                        <Input
                                            id="address"
                                            className="mt-1 block w-full"
                                            defaultValue={auth.user.address ?? ''}
                                            name="address"
                                            autoComplete="street-address"
                                            placeholder="Adresse"
                                        />
                                        <InputError
                                            className="mt-2"
                                            message={errors.address}
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="default_notification_preference">Moyen de communication préféré</Label>
                                    <Select
                                        name="default_notification_preference"
                                        defaultValue={(auth.user as any).default_notification_preference ?? 'None'}
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue placeholder="Sélectionner un moyen" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Email">Email</SelectItem>
                                            <SelectItem value="SMS">SMS</SelectItem>
                                            <SelectItem value="None">Aucun</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <InputError
                                        className="mt-2"
                                        message={(errors as any).default_notification_preference}
                                    />
                                </div>

                                {mustVerifyEmail &&
                                    auth.user.email_verified_at === null && (
                                        <div>
                                            <p className="-mt-4 text-sm text-muted-foreground">
                                                Votre adresse email n'est pas vérifiée.{' '}
                                                <Link
                                                    href={send()}
                                                    as="button"
                                                    className="text-foreground underline decoration-neutral-300 underline-offset-4 transition-colors duration-300 ease-out hover:decoration-current! dark:decoration-neutral-500"
                                                >
                                                    Cliquez ici pour renvoyer l'email de
                                                    vérification.
                                                </Link>
                                            </p>

                                            {status ===
                                                'verification-link-sent' && (
                                                <div className="mt-2 text-sm font-medium text-green-600">
                                                    Un nouveau lien de vérification a
                                                    été envoyé à votre adresse
                                                    email.
                                                </div>
                                            )}
                                        </div>
                                    )}

                                <div className="flex items-center gap-4">
                                    <Button
                                        disabled={processing}
                                        data-test="update-profile-button"
                                    >
                                        Enregistrer
                                    </Button>

                                    <Transition
                                        show={recentlySuccessful}
                                        enter="transition ease-in-out"
                                        enterFrom="opacity-0"
                                        leave="transition ease-in-out"
                                        leaveTo="opacity-0"
                                    >
                                        <p className="text-sm text-neutral-600">
                                            Enregistré
                                        </p>
                                    </Transition>
                                </div>
                            </>
                        )}
                    </Form>
                </div>

                <DeleteUser />
            </SettingsLayout>
        </AppLayout>
    );
}
