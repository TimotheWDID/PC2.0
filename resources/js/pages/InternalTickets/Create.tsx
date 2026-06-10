import { Head, Link, useForm } from '@inertiajs/react'
import AppLayout from '@/layouts/app-layout'
import Heading from '@/components/heading'
import { type BreadcrumbItem } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type CategoryOption = {
  value: 'bug' | 'improvement'
  label: string
}

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Tickets internes', href: '/internal-tickets' },
  { title: 'Créer', href: '/internal-tickets/create' },
]

export default function CreateInternalTicket({
  categories,
  defaultCategory,
  defaultTitle,
  defaultDescription,
}: {
  categories: CategoryOption[]
  defaultCategory: 'bug' | 'improvement'
  defaultTitle: string
  defaultDescription: string
}) {
  const { data, setData, post, processing, errors } = useForm({
    title: defaultTitle,
    description: defaultDescription,
    category: defaultCategory,
  })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    post('/internal-tickets')
  }

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Nouveau ticket interne" />
      <div className="py-4 w-full">
        <Heading
          title="Nouveau ticket interne"
          description="Utilisez ce formulaire pour un bug ou une proposition d'amelioration interne, sans passer par les tickets de support classiques."
        />

        <Card>
          <CardHeader>
            <CardTitle>Créer un ticket interne</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="category">Categorie</Label>
                <Select value={data.category} onValueChange={(value: 'bug' | 'improvement') => setData('category', value)}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Selectionner une categorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && <div className="text-sm text-destructive">{errors.category}</div>}
              </div>

              <div>
                <Label htmlFor="title">Titre</Label>
                <Input id="title" value={data.title} onChange={(event) => setData('title', event.target.value)} required />
                {errors.title && <div className="text-sm text-destructive">{errors.title}</div>}
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={8}
                  value={data.description}
                  onChange={(event) => setData('description', event.target.value)}
                  placeholder="Décrivez le bug ou l'amélioration souhaitée."
                />
                {errors.description && <div className="text-sm text-destructive">{errors.description}</div>}
              </div>

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={processing}>Enregistrer</Button>
                <Button asChild type="button" variant="secondary">
                  <Link href="/internal-tickets">Annuler</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
