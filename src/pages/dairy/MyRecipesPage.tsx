import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dairyService } from '@/services/dairy.service';
import type { UserRecipe } from '@/models/recipe.schema';
import { Card } from '@/components/ui/Card';

const STATUS_LABEL: Record<UserRecipe['status'], string> = {
  prywatny: '🔒 Prywatny',
  zgloszony: '⏳ Zgłoszony',
  zatwierdzony: '✅ Opublikowany',
  odrzucony: '✖ Odrzucony',
};

/** Magazyn własnych przepisów usera (fork z produkcji, Etap 3 L2). */
export function MyRecipesPage() {
  const [recipes, setRecipes] = useState<UserRecipe[] | null>(null);

  useEffect(() => { dairyService.getUserRecipes().then(setRecipes); }, []);

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Link to="/mleko" className="text-gray-400 hover:text-gray-600 text-sm">← Mleczarnia</Link>
        <h1 className="text-xl font-bold text-gray-900">📒 Moje przepisy</h1>
      </div>
      <p className="text-sm text-gray-500">
        Przepisy zapisane z Twoich produkcji — z faktycznym czasem etapów i dodatkami. Możesz ich użyć przy kolejnej partii.
      </p>

      {!recipes && <p className="text-sm text-gray-400">Ładowanie…</p>}

      {recipes && recipes.length === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-3">📒</div>
          <p className="text-gray-500 text-sm">Brak własnych przepisów.</p>
          <p className="text-gray-400 text-xs mt-1">Zrób ser w oknie produkcji i kliknij „Zapisz jako mój przepis".</p>
        </div>
      )}

      {recipes && recipes.length > 0 && (
        <div className="space-y-2">
          {recipes.map(ur => (
            <Card key={ur.id} padding="md">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-800">🧀 {ur.recipe.nazwa}</p>
                  <p className="text-xs text-gray-400">{ur.recipe.rodzina} · {ur.recipe.kroki.length} kroków</p>
                  {ur.recipe.uwagi && <p className="text-xs text-amber-700 mt-1">{ur.recipe.uwagi}</p>}
                </div>
                <span className="shrink-0 text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                  {STATUS_LABEL[ur.status]}
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-2">
                {new Date(ur.createdAt).toLocaleDateString('pl-PL')}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
