import RegisteredUserController from '@/actions/App/Http/Controllers/Auth/RegisteredUserController';
import { login } from '@/routes';
import { Form, Head } from '@inertiajs/react';

import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import AuthLayout from '@/layouts/auth-layout';

export default function Register() {
    return (
        <AuthLayout
            title="Créer un compte"
            description="Entrez vos informations ci-dessous pour créer votre compte"
        >
            <Head title="Inscription" />
            <Form
                {...RegisteredUserController.store.form()}
                resetOnSuccess={['password', 'password_confirmation']}
                disableWhileProcessing
                className="flex flex-col gap-6"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-6">
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="first_name">Prénom</Label>
                                    <Input
                                        id="first_name"
                                        type="text"
                                        required
                                        autoFocus
                                        tabIndex={1}
                                        autoComplete="given-name"
                                        name="first_name"
                                        placeholder="Prénom"
                                    />
                                    <InputError
                                        message={errors.first_name}
                                        className="mt-2"
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="last_name">Nom</Label>
                                    <Input
                                        id="last_name"
                                        type="text"
                                        required
                                        tabIndex={2}
                                        autoComplete="family-name"
                                        name="last_name"
                                        placeholder="Nom"
                                    />
                                    <InputError
                                        message={errors.last_name}
                                        className="mt-2"
                                    />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="email">Adresse email (optionnel)</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    tabIndex={2}
                                    autoComplete="email"
                                    name="email"
                                    placeholder="email@exemple.com"
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="phone">Téléphone (optionnel)</Label>
                                <Input
                                    id="phone"
                                    type="text"
                                    tabIndex={3}
                                    autoComplete="tel"
                                    name="phone"
                                    placeholder="+33 6 12 34 56 78"
                                />
                                <InputError message={errors.phone} />
                            </div>

                            <div className="grid sm:grid-cols-3 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="address">Adresse (optionnel)</Label>
                                    <Input
                                        id="address"
                                        type="text"
                                        tabIndex={4}
                                        autoComplete="street-address"
                                        name="address"
                                        placeholder="Rue et numéro"
                                    />
                                    <InputError message={errors.address} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="postal_code">Code postal (optionnel)</Label>
                                    <Input
                                        id="postal_code"
                                        type="text"
                                        tabIndex={5}
                                        autoComplete="postal-code"
                                        name="postal_code"
                                        placeholder="75000"
                                    />
                                    <InputError message={errors.postal_code} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="city">Ville (optionnel)</Label>
                                    <Input
                                        id="city"
                                        type="text"
                                        tabIndex={6}
                                        autoComplete="address-level2"
                                        name="city"
                                        placeholder="Paris"
                                    />
                                    <InputError message={errors.city} />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password">Mot de passe</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    tabIndex={3}
                                    autoComplete="new-password"
                                    name="password"
                                    placeholder="Mot de passe"
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password_confirmation">
                                    Confirmer le mot de passe
                                </Label>
                                <Input
                                    id="password_confirmation"
                                    type="password"
                                    required
                                    tabIndex={4}
                                    autoComplete="new-password"
                                    name="password_confirmation"
                                    placeholder="Confirmer le mot de passe"
                                />
                                <InputError
                                    message={errors.password_confirmation}
                                />
                            </div>

                            <Button
                                type="submit"
                                className="mt-2 w-full"
                                tabIndex={5}
                                data-test="register-user-button"
                            >
                                {processing && <Spinner />}
                                Créer un compte
                            </Button>
                        </div>

                        <div className="text-center text-sm text-muted-foreground">
                            Vous avez déjà un compte ?{' '}
                            <TextLink href={login()} tabIndex={6}>
                                Se connecter
                            </TextLink>
                        </div>
                    </>
                )}
            </Form>
        </AuthLayout>
    );
}
