import { dashboard, login, register } from '@/routes';
import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';

export default function Welcome() {
    const { auth } = usePage<SharedData>().props;

    return (
        <>
            <Head title="SupportPC" />
            <div className="auth-shell flex min-h-screen flex-col px-4 py-6 sm:px-6 lg:px-10">
                <header className="mx-auto flex w-full max-w-6xl items-center justify-end py-2">
                    <nav className="flex items-center gap-3 text-sm">
                        {auth.user ? (
                            <Link
                                href={dashboard()}
                                className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-foreground hover:bg-muted"
                            >
                                Ouvrir le dashboard
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href={login()}
                                    className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-foreground hover:bg-muted"
                                >
                                    Connexion
                                </Link>
                                <Link
                                    href={register()}
                                    className="inline-flex items-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90"
                                >
                                    Creer un compte
                                </Link>
                            </>
                        )}
                    </nav>
                </header>

                <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-6 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:py-12">
                    <section className="rounded-2xl border border-border/70 bg-card/90 p-7 shadow-sm backdrop-blur-sm sm:p-10">
                        <p className="mb-4 inline-flex rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                            SupportPC
                        </p>
                        <h1 className="text-balance text-3xl font-semibold leading-tight sm:text-4xl">
                            Gestion SAV centralisee, claire et rapide
                        </h1>
                        <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
                            Suivez vos tickets, commandes et appareils depuis une interface unique, avec une experience coherente sur desktop et mobile.
                        </p>

                        <div className="mt-7 flex flex-wrap gap-3">
                            <Link
                                href={auth.user ? dashboard() : login()}
                                className="inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                            >
                                {auth.user ? 'Acceder au dashboard' : 'Se connecter'}
                            </Link>
                            {!auth.user && (
                                <Link
                                    href={register()}
                                    className="inline-flex items-center rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                                >
                                    Demarrer maintenant
                                </Link>
                            )}
                        </div>
                    </section>

                    <section className="rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/50 p-7 shadow-sm sm:p-10">
                        <h2 className="text-xl font-semibold">Ce que vous gagnez</h2>
                        <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                            <li className="rounded-lg border border-border/70 bg-background/70 p-3">
                                Pilotage unifie des demandes clients, reparations et interventions.
                            </li>
                            <li className="rounded-lg border border-border/70 bg-background/70 p-3">
                                Historique exploitable pour le suivi qualite et les delais de traitement.
                            </li>
                            <li className="rounded-lg border border-border/70 bg-background/70 p-3">
                                Parcours de travail coherents entre equipe admin, agents et utilisateurs.
                            </li>
                        </ul>
                    </section>
                </main>
            </div>
        </>
    );
}
