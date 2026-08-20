import { Head, useForm } from '@inertiajs/react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Props = {
  success?: boolean
  ticketId?: number | string | null
}

const kioskSectionClassName = 'rounded-3xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/15 p-5 shadow-sm md:p-6'
const kioskStepPillClassName = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/40 text-sm font-semibold text-foreground'

export default function KioskCreate({ success = false, ticketId = null }: Props) {
  const [isDark, setIsDark] = useState(false)
  const [showNoPasswordConfirm, setShowNoPasswordConfirm] = useState(false)
  const isSubmittingRef = useRef(false)

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

  const { data, setData, post, processing, errors, transform } = useForm({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    title: '',
    message: '',
    device_password: '',
    no_device_password: false,
    password_empty_confirmed: false,
  })

  useEffect(() => {
    const handleInertiaInvalid = (event: Event) => {
      if (!isSubmittingRef.current) {
        return
      }

      const detail = (event as CustomEvent<{ response?: { status?: number } }>).detail
      // 419 = TokenMismatchException (session/CSRF expired). Some hosting layers may surface this as 403.
      if (detail?.response?.status === 419 || detail?.response?.status === 403) {
        window.location.reload()
      }
    }

    document.addEventListener('inertia:invalid', handleInertiaInvalid)

    return () => {
      document.removeEventListener('inertia:invalid', handleInertiaInvalid)
    }
  }, [])

  // Restaurer le brouillon du localStorage au montage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kiosk_ticket_form_draft')
      if (saved) {
        setData(JSON.parse(saved))
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  // Sauvegarder le brouillon dans localStorage à chaque changement
  useEffect(() => {
    try {
      localStorage.setItem('kiosk_ticket_form_draft', JSON.stringify(data))
    } catch {
      // Ignore localStorage errors
    }
  }, [data])

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!data.device_password.trim()) {
      setShowNoPasswordConfirm(true)
      return
    }

    transform((values) => ({
      ...values,
      no_device_password: false,
      password_empty_confirmed: false,
    }))

    isSubmittingRef.current = true
    post('/kiosk/tickets', {
      onSuccess: () => {
        try {
          const draftKey = 'kiosk_ticket_form_draft'
          localStorage.removeItem(draftKey)
        } catch {
          // Ignore localStorage errors
        }
      },
      onFinish: () => {
        isSubmittingRef.current = false
      },
    })
  }

  const confirmNoPasswordAndSubmit = () => {
    setShowNoPasswordConfirm(false)

    transform((values) => ({
      ...values,
      no_device_password: true,
      password_empty_confirmed: true,
    }))

    isSubmittingRef.current = true
    post('/kiosk/tickets', {
      onFinish: () => {
        isSubmittingRef.current = false
      },
    })
  }

  const resetForNextClient = () => {
    window.location.href = '/kiosk/tickets/create'
  }

  return (
    <div>
      <Head title="Demande de support" />

      <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 md:px-10 dark:bg-background dark:text-foreground">
        <div className="mx-auto max-w-5xl space-y-6">
          <header className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-gradient-to-br from-background via-background to-muted/50 p-6 shadow-sm md:p-8">
            <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-0 h-28 w-28 rounded-full bg-secondary/20 blur-3xl" />
            <div className="relative grid gap-5 lg:grid-cols-[1.5fr_0.7fr] lg:items-start">
              <div>
                <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  Formulaire client simplifie
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">Demande de support</h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
                  Decrivez votre probleme simplement. L'equipe technique completera ensuite les informations avancees si necessaire.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-border bg-background/85 px-3 py-1 text-xs text-foreground">Rapide a remplir</span>
                  <span className="rounded-full border border-border bg-background/85 px-3 py-1 text-xs text-foreground">Lisible sur borne</span>
                  <span className="rounded-full border border-border bg-background/85 px-3 py-1 text-xs text-foreground">Transmission claire</span>
                </div>
              </div>

              <div className="rounded-3xl border border-border/70 bg-background/80 p-5 backdrop-blur">
                <p className="text-sm font-semibold text-foreground">Ce qu'il faut preparer</p>
                <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                  <div className="rounded-2xl border border-border/60 bg-muted/15 p-3">Un moyen de contact: telephone ou email.</div>
                  <div className="rounded-2xl border border-border/60 bg-muted/15 p-3">Un titre simple et une description du probleme.</div>
                  <div className="rounded-2xl border border-border/60 bg-muted/15 p-3">Le mot de passe de l'appareil si vous l'avez.</div>
                </div>
              </div>
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
                  <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" />
                </svg>
              )}
            </button>
          </header>

          {success && (
            <section role="status" aria-live="polite" className="rounded-[2rem] border border-secondary/45 bg-secondary/10 p-6 shadow-sm">
              <h2 className="text-2xl font-semibold text-foreground dark:text-foreground">Merci, votre demande est envoyee.</h2>
              {ticketId && (
                <p className="mt-2 text-lg text-foreground dark:text-foreground">
                  Numero de suivi: <span className="font-bold">#{ticketId}</span>
                </p>
              )}
              <Button
                type="button"
                onClick={resetForNextClient}
                className="mt-4 h-12 rounded-xl px-6 text-base"
              >
                Nouvelle demande
              </Button>
            </section>
          )}

          <Card className="rounded-[1.75rem] border-border/70 shadow-sm ring-1 ring-border">
            <CardContent className="p-6">
          <form onSubmit={submit} className="space-y-6">
            <section className={kioskSectionClassName}>
              <div className="mb-4 flex items-start gap-3">
                <span className={kioskStepPillClassName}>1</span>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Vos informations</h2>
                  <p className="text-sm text-muted-foreground">Ces informations nous permettent de vous recontacter rapidement.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="first_name" className="mb-2 block">Prenom</Label>
                  <Input
                    id="first_name"
                    type="text"
                    value={data.first_name}
                    onChange={(e) => setData('first_name', e.target.value)}
                    className="h-12 rounded-xl text-base"
                    required
                    autoComplete="given-name"
                  />
                  {errors.first_name && <p className="mt-2 text-sm text-destructive">{errors.first_name}</p>}
                </div>

                <div>
                  <Label htmlFor="last_name" className="mb-2 block">Nom</Label>
                  <Input
                    id="last_name"
                    type="text"
                    value={data.last_name}
                    onChange={(e) => setData('last_name', e.target.value)}
                    className="h-12 rounded-xl text-base"
                    required
                    autoComplete="family-name"
                  />
                  {errors.last_name && <p className="mt-2 text-sm text-destructive">{errors.last_name}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="phone" className="mb-2 block">Telephone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={data.phone}
                    onChange={(e) => setData('phone', e.target.value)}
                    className="h-12 rounded-xl text-base"
                    autoComplete="tel"
                    placeholder="Ex: 06 12 34 56 78"
                  />
                  {errors.phone && <p className="mt-2 text-sm text-destructive">{errors.phone}</p>}
                </div>

                <div>
                  <Label htmlFor="email" className="mb-2 block">Email (optionnel)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    className="h-12 rounded-xl text-base"
                    autoComplete="email"
                    placeholder="Ex: client@email.com"
                  />
                  {errors.email && <p className="mt-2 text-sm text-destructive">{errors.email}</p>}
                </div>
              </div>
            </section>

            <section className={kioskSectionClassName}>
              <div className="mb-4 flex items-start gap-3">
                <span className={kioskStepPillClassName}>2</span>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Votre demande</h2>
                  <p className="text-sm text-muted-foreground">Donnez un maximum de contexte utile avec vos mots.</p>
                </div>
              </div>

              <div>
                <Label htmlFor="title" className="mb-2 block">Sujet</Label>
                <Input
                  id="title"
                  type="text"
                  value={data.title}
                  onChange={(e) => setData('title', e.target.value)}
                  className="h-12 rounded-xl text-base"
                  required
                  placeholder="Ex: Mon ordinateur ne demarre plus"
                />
                {errors.title && <p className="mt-2 text-sm text-destructive">{errors.title}</p>}
              </div>

              <div>
                <Label htmlFor="message" className="mb-2 block">Expliquez le probleme</Label>
                <Textarea
                  id="message"
                  rows={5}
                  value={data.message}
                  onChange={(e) => setData('message', e.target.value)}
                  className="min-h-32 rounded-xl bg-transparent text-base"
                  required
                  placeholder="Exemple: Ecran noir, bruit au demarrage, message d'erreur..."
                />
                {errors.message && <p className="mt-2 text-sm text-destructive">{errors.message}</p>}
              </div>

              <div className="rounded-3xl border border-border/70 bg-muted/10 p-4">
                <Label htmlFor="device_password" className="mb-2 block">Mot de passe appareil</Label>
                <Input
                  id="device_password"
                  type="text"
                  value={data.device_password}
                  onChange={(e) => {
                    const value = e.target.value
                    setData('device_password', value)
                    if (value.trim() !== '') {
                      setData('no_device_password', false)
                      setData('password_empty_confirmed', false)
                    }
                  }}
                  className="h-12 rounded-xl text-base"
                  placeholder="Windows, session, BIOS..."
                />

                <p className="mt-3 text-sm text-muted-foreground">
                  Si vous laissez ce champ vide, une confirmation sera demandée avant l'envoi.
                </p>

                {errors.device_password && <p className="mt-2 text-sm text-destructive">{errors.device_password}</p>}
                {errors.no_device_password && <p className="mt-2 text-sm text-destructive">{errors.no_device_password}</p>}
              </div>
            </section>

            <div className="sticky bottom-4 z-10 rounded-3xl border border-border bg-background/95 p-4 backdrop-blur">
              <Button
                type="submit"
                disabled={processing}
                className="h-14 w-full rounded-2xl text-lg"
              >
                {processing ? 'Envoi en cours...' : 'Envoyer ma demande'}
              </Button>
              <p className="mt-3 text-center text-sm text-muted-foreground dark:text-muted-foreground">Besoin d'aide ? Demandez a un membre de l'equipe.</p>
            </div>
          </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={showNoPasswordConfirm} onOpenChange={setShowNoPasswordConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l'absence de mot de passe</DialogTitle>
            <DialogDescription>
              Le champ MDP est vide. Confirmez-vous ne pas avoir de mot de passe a fournir ?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowNoPasswordConfirm(false)}>
              Retour
            </Button>
            <Button type="button" onClick={confirmNoPasswordAndSubmit}>
              Confirmer et envoyer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
