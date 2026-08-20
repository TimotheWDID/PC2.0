import AuthenticatedSessionController from '@/actions/App/Http/Controllers/Auth/AuthenticatedSessionController';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import AuthLayout from '@/layouts/auth-layout';
import { request } from '@/routes/password';
import { Form, Head } from '@inertiajs/react';

interface LoginProps {
    status?: string;
    canResetPassword: boolean;
}

export default function Login({ status, canResetPassword }: LoginProps) {
    const csrfToken =
        typeof document !== 'undefined'
            ? (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content ?? ''
            : '';

    return (
        <AuthLayout
            title="Connectez-vous à votre compte"
            description="Connexion reservee aux agents"
        >
            <Head title="Connexion" />

            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-medium">Seuls les agents peuvent se connecter a cette interface.</p>
                <p className="mt-1">Pour acceder a un ticket, utilisez le lien recu dans votre notification.</p>
            </div>

            <Form
                {...AuthenticatedSessionController.store.form()}
                resetOnSuccess={['password']}
                className="flex flex-col gap-6"
            >
                {({ processing, errors }) => (
                    <>
                        <input type="hidden" name="_token" value={csrfToken} />

                        <div className="grid gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Adresse email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="email"
                                    placeholder="email@exemple.com"
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <div className="flex items-center">
                                    <Label htmlFor="password">Mot de passe</Label>
                                    {canResetPassword && (
                                        <TextLink
                                            href={request()}
                                            className="ml-auto text-sm"
                                            tabIndex={5}
                                        >
                                            Mot de passe oublié ?
                                        </TextLink>
                                    )}
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    name="password"
                                    required
                                    tabIndex={2}
                                    autoComplete="current-password"
                                    placeholder="Mot de passe"
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="flex items-start space-x-3">
                                <Checkbox
                                    id="remember"
                                    name="remember"
                                    defaultChecked
                                    tabIndex={3}
                                />
                                <div className="grid gap-1">
                                    <Label htmlFor="remember">Rester connecte sur cet appareil</Label>
                                    <p className="text-xs text-muted-foreground">
                                        A desactiver sur un appareil partage.
                                    </p>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="mt-4 w-full"
                                tabIndex={4}
                                disabled={processing}
                                data-test="login-button"
                            >
                                {processing && <Spinner />}
                                Se connecter
                            </Button>
                        </div>

                        <p className="text-center text-sm text-muted-foreground">
                            La creation de compte est desactivee.
                        </p>
                    </>
                )}
            </Form>

            {status && (
                <div role="status" aria-live="polite" className="mb-4 text-center text-sm font-medium text-primary">
                    {status}
                </div>
            )}
        </AuthLayout>
    );
}

