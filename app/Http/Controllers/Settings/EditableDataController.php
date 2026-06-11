<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Speciality;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Inertia\Inertia;

class EditableDataController extends Controller
{
    public function edit()
    {
        $user = Auth::user();
        $isAdmin = $user && $user->agent && $user->agent->is_admin;

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

        return Inertia::render('settings/editable-data', [
            'categories' => $categories,
            'specialities' => $specialities,
            'canManage' => $isAdmin,
        ]);
    }

    public function storeCategory(Request $request)
    {
        $this->authorizeAdmin();

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
        $this->authorizeAdmin();

        $category->manyTickets()->detach();
        $category->delete();

        return back()->with('success', 'Categorie supprimee.');
    }

    public function storeSpeciality(Request $request)
    {
        $this->authorizeAdmin();

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
        $this->authorizeAdmin();

        $speciality->delete();

        return back()->with('success', 'Specialite supprimee.');
    }

    private function authorizeAdmin(): void
    {
        $user = Auth::user();
        $isAdmin = $user && $user->agent && $user->agent->is_admin;

        if (!$isAdmin) {
            abort(403, 'Acces reserve aux administrateurs.');
        }
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
