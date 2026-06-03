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

      <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 md:px-10 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto max-w-3xl">
          <header className="mb-6 flex items-start justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl dark:text-white">Demande de support</h1>
              <p className="mt-3 text-lg text-slate-700 dark:text-slate-300">Remplissez ce formulaire. Nous vous recontactons rapidement.</p>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'}
              title={isDark ? 'Mode clair' : 'Mode sombre'}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
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
            <section className="mb-6 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-6 dark:border-emerald-700 dark:bg-emerald-900/30">
              <h2 className="text-2xl font-semibold text-emerald-900 dark:text-emerald-100">Merci, votre demande est envoyee.</h2>
              {ticketId && (
                <p className="mt-2 text-lg text-emerald-900 dark:text-emerald-100">
                  Numero de suivi: <span className="font-bold">#{ticketId}</span>
                </p>
              )}
              <button
                type="button"
                onClick={resetForNextClient}
                className="mt-4 rounded-xl bg-emerald-700 px-6 py-4 text-lg font-semibold text-white hover:bg-emerald-800"
              >
                Nouvelle demande
              </button>
            </section>
          )}

          <form onSubmit={submit} className="space-y-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Vos informations</h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="first_name" className="mb-2 block text-lg font-medium text-slate-800 dark:text-slate-200">Prenom</label>
                  <input
                    id="first_name"
                    type="text"
                    value={data.first_name}
                    onChange={(e) => setData('first_name', e.target.value)}
                    className="h-14 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-xl text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
                    required
                    autoComplete="given-name"
                  />
                  {errors.first_name && <p className="mt-2 text-base text-red-700">{errors.first_name}</p>}
                </div>

                <div>
                  <label htmlFor="last_name" className="mb-2 block text-lg font-medium text-slate-800 dark:text-slate-200">Nom</label>
                  <input
                    id="last_name"
                    type="text"
                    value={data.last_name}
                    onChange={(e) => setData('last_name', e.target.value)}
                    className="h-14 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-xl text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
                    required
                    autoComplete="family-name"
                  />
                  {errors.last_name && <p className="mt-2 text-base text-red-700">{errors.last_name}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="phone" className="mb-2 block text-lg font-medium text-slate-800 dark:text-slate-200">Telephone</label>
                  <input
                    id="phone"
                    type="tel"
                    value={data.phone}
                    onChange={(e) => setData('phone', e.target.value)}
                    className="h-14 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-xl text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
                    autoComplete="tel"
                    placeholder="Ex: 06 12 34 56 78"
                  />
                  {errors.phone && <p className="mt-2 text-base text-red-700">{errors.phone}</p>}
                </div>

                <div>
                  <label htmlFor="email" className="mb-2 block text-lg font-medium text-slate-800 dark:text-slate-200">Email (optionnel)</label>
                  <input
                    id="email"
                    type="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    className="h-14 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-xl text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
                    autoComplete="email"
                    placeholder="Ex: client@email.com"
                  />
                  {errors.email && <p className="mt-2 text-base text-red-700">{errors.email}</p>}
                </div>
              </div>

              <details className="rounded-xl border border-slate-300 p-4 dark:border-slate-600">
                <summary className="cursor-pointer text-lg font-medium text-slate-800 dark:text-slate-200">Adresse (optionnel)</summary>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label htmlFor="address" className="mb-2 block text-lg font-medium text-slate-800 dark:text-slate-200">Adresse</label>
                    <input
                      id="address"
                      type="text"
                      value={data.address}
                      onChange={(e) => setData('address', e.target.value)}
                      className="h-14 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-xl text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
                      autoComplete="street-address"
                    />
                  </div>
                  <div>
                    <label htmlFor="postal_code" className="mb-2 block text-lg font-medium text-slate-800 dark:text-slate-200">Code postal</label>
                    <input
                      id="postal_code"
                      type="text"
                      value={data.postal_code}
                      onChange={(e) => setData('postal_code', e.target.value)}
                      className="h-14 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-xl text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
                      autoComplete="postal-code"
                    />
                  </div>
                  <div>
                    <label htmlFor="city" className="mb-2 block text-lg font-medium text-slate-800 dark:text-slate-200">Ville</label>
                    <input
                      id="city"
                      type="text"
                      value={data.city}
                      onChange={(e) => setData('city', e.target.value)}
                      className="h-14 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-xl text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
                      autoComplete="address-level2"
                    />
                  </div>
                </div>
              </details>
            </section>

            <section className="space-y-4 border-t border-slate-200 pt-6 dark:border-slate-700">
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Votre demande</h2>

              <div>
                <label htmlFor="title" className="mb-2 block text-lg font-medium text-slate-800 dark:text-slate-200">Sujet</label>
                <input
                  id="title"
                  type="text"
                  value={data.title}
                  onChange={(e) => setData('title', e.target.value)}
                  className="h-14 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-xl text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
                  required
                  placeholder="Ex: Mon ordinateur ne demarre plus"
                />
                {errors.title && <p className="mt-2 text-base text-red-700">{errors.title}</p>}
              </div>

              <div>
                <label htmlFor="category_id" className="mb-2 block text-lg font-medium text-slate-800 dark:text-slate-200">Type de demande (optionnel)</label>
                <select
                  id="category_id"
                  value={data.category_id}
                  onChange={(e) => setData('category_id', e.target.value)}
                  className="h-14 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-xl text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">Choisir</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
                {errors.category_id && <p className="mt-2 text-base text-red-700">{errors.category_id}</p>}
              </div>

              <div>
                <label htmlFor="message" className="mb-2 block text-lg font-medium text-slate-800 dark:text-slate-200">Expliquez le probleme</label>
                <textarea
                  id="message"
                  rows={6}
                  value={data.message}
                  onChange={(e) => setData('message', e.target.value)}
                  className="w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-xl text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
                  required
                  placeholder="Exemple: Ecran noir, bruit au demarrage, message d'erreur..."
                />
                {errors.message && <p className="mt-2 text-base text-red-700">{errors.message}</p>}
              </div>
            </section>

            <div className="border-t border-slate-200 pt-6 dark:border-slate-700">
              <button
                type="submit"
                disabled={processing}
                className="h-16 w-full rounded-2xl bg-blue-700 text-2xl font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-400"
              >
                {processing ? 'Envoi en cours...' : 'Envoyer ma demande'}
              </button>
              <p className="mt-3 text-center text-base text-slate-600 dark:text-slate-300">Besoin d'aide ? Demandez a un membre de l'equipe.</p>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
