<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Speciality;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;

class AppSettingsController extends Controller
{
    public function edit()
    {
        $categories = Category::query()
            ->withCount('tickets')
            ->orderBy('name')
            ->get()
            ->map(fn (Category $category) => [
                'id' => $category->id,
                'name' => $category->name,
                'slug' => $category->slug,
                'tickets_count' => (int) ($category->tickets_count ?? 0),
            ])
            ->values();

        $specialities = Speciality::query()
            ->withCount('agents')
            ->orderBy('name')
            ->get()
            ->map(fn (Speciality $speciality) => [
                'id' => $speciality->id,
                'name' => $speciality->name,
                'agents_count' => (int) ($speciality->agents_count ?? 0),
            ])
            ->values();

        return Inertia::render('AppSettings/Index', [
            'categories' => $categories,
            'specialities' => $specialities,
            'modules' => [
                [
                    'title' => 'Etiquettes tickets',
                    'description' => 'Mise en page, dimensions et champs visibles pour l\'impression.',
                    'href' => '/settings/ticket-label',
                    'status' => 'Disponible',
                ],
                [
                    'title' => 'Modeles de suivi tickets',
                    'description' => 'Modeles d\'evenements predefinis pour accelerer les suivis.',
                    'href' => '/settings/ticket-timeline-templates',
                    'status' => 'Disponible',
                ],
                [
                    'title' => 'Listes d\'actions tickets',
                    'description' => 'Checklists reutilisables pour homogeniser les interventions.',
                    'href' => '/settings/ticket-action-lists',
                    'status' => 'Disponible',
                ],
                [
                    'title' => 'Regles dashboard',
                    'description' => 'Seuils et priorites qui pilotent les insights.',
                    'href' => '/settings/dashboard-insights',
                    'status' => 'Disponible',
                ],
            ],
        ]);
    }

    public function storeCategory(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120', 'unique:categories,name'],
        ]);

        $slug = $this->buildUniqueCategorySlug($validated['name']);

        Category::create([
            'name' => $validated['name'],
            'slug' => $slug,
            'is_visible' => true,
        ]);

        return back()->with('success', 'Categorie ajoutee.');
    }

    public function destroyCategory(Category $category)
    {
        $category->manyTickets()->detach();
        $category->delete();

        return back()->with('success', 'Categorie supprimee.');
    }

    public function storeSpeciality(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120', 'unique:specialities,name'],
        ]);

        Speciality::create([
            'name' => $validated['name'],
        ]);

        return back()->with('success', 'Specialite ajoutee.');
    }

    public function destroySpeciality(Speciality $speciality)
    {
        $speciality->delete();

        return back()->with('success', 'Specialite supprimee.');
    }

    private function buildUniqueCategorySlug(string $name): string
    {
        $base = Str::slug($name);
        $base = $base !== '' ? $base : Str::lower(Str::random(8));
        $candidate = Str::limit($base, 120, '');
        $suffix = 2;

        while (Category::query()->where('slug', $candidate)->exists()) {
            $candidate = Str::limit($base, 110, '') . '-' . $suffix;
            $suffix++;
        }

        return $candidate;
    }
}
