import { Head, useForm } from '@inertiajs/react'
import { useEffect, useState } from 'react'

type Category = {
  id: number
  name: string
}

type Props = {
  categories: Category[]
  success?: boolean
  ticketId?: number | string | null
}

import MobileNativeNav from '@/components/mobile-native-nav';

export default function KioskCreate({ categories, success = false, ticketId = null }: Props) {
  const [isDark, setIsDark] = useState(false)

  const applyTheme = (darkMode: boolean) => {
    document.documentElement.classList.toggle('dark', darkMode)
  }

  useEffect(() => {
    const saved = window.localStorage.getItem('kiosk-theme')

    if (saved === 'dark') {
      setIsDark(true)
      applyTheme(true)
      return
    }

    if (saved === 'light') {
      setIsDark(false)
      applyTheme(false)
      return
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setIsDark(prefersDark)
    applyTheme(prefersDark)
  }, [])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    applyTheme(next)
    window.localStorage.setItem('kiosk-theme', next ? 'dark' : 'light')
  }

  const { data, setData, post, processing, errors } = useForm({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    address: '',
    postal_code: '',
    city: '',
    title: '',
    message: '',
    device_password: '',
    no_device_password: false,
    category_id: '',
  })

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    post('/kiosk/tickets')
  }

  const resetForNextClient = () => {
    window.location.href = '/kiosk/tickets/create'
  }

  return (
    <div>
      <Head title="Demande de support" />

      <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 md:px-10 dark:bg-background dark:text-foreground">
        <div className="mx-auto max-w-3xl">
          <header className="mb-6 flex items-start justify-between gap-4 rounded-2xl bg-card p-6 shadow-sm ring-1 ring-border dark:bg-card dark:ring-border">
            <div>
              <h1 className="text-3xl font-semibold text-foreground md:text-4xl dark:text-foreground">Demande de support</h1>
              <p className="mt-3 text-lg text-muted-foreground dark:text-muted-foreground">Remplissez ce formulaire. Nous vous recontactons rapidement.</p>
              <p className="mt-2 text-sm text-muted-foreground dark:text-muted-foreground">Comptez environ 2 minutes pour compléter votre demande.</p>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'}
              title={isDark ? 'Mode clair' : 'Mode sombre'}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-input bg-card text-foreground hover:bg-muted dark:border-input dark:bg-card dark:text-foreground dark:hover:bg-muted"
            >
              {isDark ? (
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3c0 0 0 0 0 0a7 7 0 0 0 9.79 9.79Z" />
                </svg>
              )}
            </button>
          </header>

          {success && (
            <section role="status" aria-live="polite" className="mb-6 rounded-2xl border-2 border-secondary/45 bg-secondary/15 p-6 dark:border-secondary/45 dark:bg-secondary/20">
              <h2 className="text-2xl font-semibold text-foreground dark:text-foreground">Merci, votre demande est envoyee.</h2>
              {ticketId && (
                <p className="mt-2 text-lg text-foreground dark:text-foreground">
                  Numero de suivi: <span className="font-bold">#{ticketId}</span>
                </p>
              )}
              <button
                type="button"
                onClick={resetForNextClient}
                className="mt-4 rounded-xl bg-primary px-6 py-4 text-lg font-semibold text-white hover:bg-primary/90"
              >
                Nouvelle demande
              </button>
            </section>
          )}

          <form onSubmit={submit} className="space-y-6 rounded-2xl bg-card p-6 shadow-sm ring-1 ring-border dark:bg-card dark:ring-border">
            <section className="space-y-4 rounded-xl border border-border p-4 dark:border-border">
              <h2 className="text-2xl font-semibold text-foreground dark:text-foreground">1. Vos informations</h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="first_name" className="mb-2 block text-lg font-medium text-foreground dark:text-foreground">Prenom</label>
                  <input
                    id="first_name"
                    type="text"
                    value={data.first_name}
                    onChange={(e) => setData('first_name', e.target.value)}
                    className="h-14 w-full rounded-xl border-2 border-input bg-card px-4 text-xl text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none dark:border-input dark:bg-card dark:text-foreground dark:placeholder:text-muted-foreground"
                    required
                    autoComplete="given-name"
                  />
                  {errors.first_name && <p className="mt-2 text-base text-destructive">{errors.first_name}</p>}
                </div>

                <div>
                  <label htmlFor="last_name" className="mb-2 block text-lg font-medium text-foreground dark:text-foreground">Nom</label>
                  <input
                    id="last_name"
                    type="text"
                    value={data.last_name}
                    onChange={(e) => setData('last_name', e.target.value)}
                    className="h-14 w-full rounded-xl border-2 border-input bg-card px-4 text-xl text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none dark:border-input dark:bg-card dark:text-foreground dark:placeholder:text-muted-foreground"
                    required
                    autoComplete="family-name"
                  />
                  {errors.last_name && <p className="mt-2 text-base text-destructive">{errors.last_name}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="phone" className="mb-2 block text-lg font-medium text-foreground dark:text-foreground">Telephone</label>
                  <input
                    id="phone"
                    type="tel"
                    value={data.phone}
                    onChange={(e) => setData('phone', e.target.value)}
                    className="h-14 w-full rounded-xl border-2 border-input bg-card px-4 text-xl text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none dark:border-input dark:bg-card dark:text-foreground dark:placeholder:text-muted-foreground"
                    autoComplete="tel"
                    placeholder="Ex: 06 12 34 56 78"
                  />
                  {errors.phone && <p className="mt-2 text-base text-destructive">{errors.phone}</p>}
                </div>

                <div>
                  <label htmlFor="email" className="mb-2 block text-lg font-medium text-foreground dark:text-foreground">Email (optionnel)</label>
                  <input
                    id="email"
                    type="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    className="h-14 w-full rounded-xl border-2 border-input bg-card px-4 text-xl text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none dark:border-input dark:bg-card dark:text-foreground dark:placeholder:text-muted-foreground"
                    autoComplete="email"
                    placeholder="Ex: client@email.com"
                  />
                  {errors.email && <p className="mt-2 text-base text-destructive">{errors.email}</p>}
                </div>
              </div>

              <details className="rounded-xl border border-input p-4 dark:border-input">
                <summary className="cursor-pointer text-lg font-medium text-foreground dark:text-foreground">Adresse (optionnel)</summary>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label htmlFor="address" className="mb-2 block text-lg font-medium text-foreground dark:text-foreground">Adresse</label>
                    <input
                      id="address"
                      type="text"
                      value={data.address}
                      onChange={(e) => setData('address', e.target.value)}
                      className="h-14 w-full rounded-xl border-2 border-input bg-card px-4 text-xl text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none dark:border-input dark:bg-card dark:text-foreground dark:placeholder:text-muted-foreground"
                      autoComplete="street-address"
                    />
                  </div>
                  <div>
                    <label htmlFor="postal_code" className="mb-2 block text-lg font-medium text-foreground dark:text-foreground">Code postal</label>
                    <input
                      id="postal_code"
                      type="text"
                      value={data.postal_code}
                      onChange={(e) => setData('postal_code', e.target.value)}
                      className="h-14 w-full rounded-xl border-2 border-input bg-card px-4 text-xl text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none dark:border-input dark:bg-card dark:text-foreground dark:placeholder:text-muted-foreground"
                      autoComplete="postal-code"
                    />
                  </div>
                  <div>
                    <label htmlFor="city" className="mb-2 block text-lg font-medium text-foreground dark:text-foreground">Ville</label>
                    <input
                      id="city"
                      type="text"
                      value={data.city}
                      onChange={(e) => setData('city', e.target.value)}
                      className="h-14 w-full rounded-xl border-2 border-input bg-card px-4 text-xl text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none dark:border-input dark:bg-card dark:text-foreground dark:placeholder:text-muted-foreground"
                      autoComplete="address-level2"
                    />
                  </div>
                </div>
              </details>
            </section>

            <section className="space-y-4 rounded-xl border border-border p-4 dark:border-border">
              <h2 className="text-2xl font-semibold text-foreground dark:text-foreground">2. Votre demande</h2>

              <div>
                <label htmlFor="title" className="mb-2 block text-lg font-medium text-foreground dark:text-foreground">Sujet</label>
                <input
                  id="title"
                  type="text"
                  value={data.title}
                  onChange={(e) => setData('title', e.target.value)}
                  className="h-14 w-full rounded-xl border-2 border-input bg-card px-4 text-xl text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none dark:border-input dark:bg-card dark:text-foreground dark:placeholder:text-muted-foreground"
                  required
                  placeholder="Ex: Mon ordinateur ne demarre plus"
                />
                {errors.title && <p className="mt-2 text-base text-destructive">{errors.title}</p>}
              </div>

              <div>
                <label htmlFor="category_id" className="mb-2 block text-lg font-medium text-foreground dark:text-foreground">Type de demande (optionnel)</label>
                <select
                  id="category_id"
                  value={data.category_id}
                  onChange={(e) => setData('category_id', e.target.value)}
                  className="h-14 w-full rounded-xl border-2 border-input bg-card px-4 text-xl text-foreground focus:border-ring focus:outline-none dark:border-input dark:bg-card dark:text-foreground"
                >
                  <option value="">Choisir</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
                {errors.category_id && <p className="mt-2 text-base text-destructive">{errors.category_id}</p>}
              </div>

              <div>
                <label htmlFor="message" className="mb-2 block text-lg font-medium text-foreground dark:text-foreground">Expliquez le probleme</label>
                <textarea
                  id="message"
                  rows={6}
                  value={data.message}
                  onChange={(e) => setData('message', e.target.value)}
                  className="w-full rounded-xl border-2 border-input bg-card px-4 py-3 text-xl text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none dark:border-input dark:bg-card dark:text-foreground dark:placeholder:text-muted-foreground"
                  required
                  placeholder="Exemple: Ecran noir, bruit au demarrage, message d'erreur..."
                />
                {errors.message && <p className="mt-2 text-base text-destructive">{errors.message}</p>}
              </div>

              <div className="rounded-xl border-2 border-input p-4 dark:border-input">
                <label htmlFor="device_password" className="mb-2 block text-lg font-medium text-foreground dark:text-foreground">Mot de passe appareil</label>
                <input
                  id="device_password"
                  type="text"
                  value={data.device_password}
                  onChange={(e) => {
                    const value = e.target.value
                    setData('device_password', value)
                    if (value.trim() !== '' && data.no_device_password) {
                      setData('no_device_password', false)
                    }
                  }}
                  disabled={data.no_device_password}
                  className="h-14 w-full rounded-xl border-2 border-input bg-card px-4 text-xl text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none disabled:cursor-not-allowed disabled:opacity-70 dark:border-input dark:bg-card dark:text-foreground dark:placeholder:text-muted-foreground"
                  placeholder="Windows, session, BIOS..."
                />

                <label className="mt-3 flex items-center gap-2 text-base text-foreground dark:text-foreground">
                  <input
                    type="checkbox"
                    checked={data.no_device_password}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setData('no_device_password', checked)
                      if (checked) {
                        setData('device_password', '')
                      }
                    }}
                  />
                  Je n&apos;ai pas de mots de passe
                </label>

                {errors.device_password && <p className="mt-2 text-base text-destructive">{errors.device_password}</p>}
                {errors.no_device_password && <p className="mt-2 text-base text-destructive">{errors.no_device_password}</p>}
              </div>
            </section>

            <div className="sticky bottom-4 z-10 rounded-2xl border border-border bg-background/95 p-4 backdrop-blur dark:border-border dark:bg-background/95">
              <button
                type="submit"
                disabled={processing}
                className="h-16 w-full rounded-2xl bg-primary text-2xl font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
              >
                {processing ? 'Envoi en cours...' : 'Envoyer ma demande'}
              </button>
              <p className="mt-3 text-center text-base text-muted-foreground dark:text-muted-foreground">Besoin d'aide ? Demandez a un membre de l'equipe.</p>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}



