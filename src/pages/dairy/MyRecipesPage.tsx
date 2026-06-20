import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dairyService } from '@/services/dairy.service';
import type { UserRecipe } from '@/models/recipe.schema';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const STATUS_LABEL: Record<UserRecipe['status'], string> = {
  prywatny: '🔒 Prywatny',
  zgloszony: '⏳ Zgłoszony do publikacji',
  zatwierdzony: '✅ Zatwierdzony',
  odrzucony: '✖ Odrzucony',
};

/** Magazyn własnych przepisów + przepływ PUBLISH (zgłoszenie → moderacja Marka → eksport feedu). */
export function MyRecipesPage() {
  const [recipes, setRecipes] = useState<UserRecipe[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => dairyService.getUserRecipes().then(setRecipes);
  useEffect(() => { load(); }, []);

  const setStatus = async (ur: UserRecipe, status: UserRecipe['status']) => {
    if (!ur.id) return;
    setBusy(true);
    await dairyService.updateUserRecipeStatus(ur.id, status);
    await load();
    setBusy(false);
  };

  const exportFeed = async () => {
    setBusy(true);
    const feed = await dairyService.buildCommunityFeed();
    setBusy(false);
    const blob = new Blob([JSON.stringify(feed, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'przepisy-spolecznosci.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const approvedCount = (recipes ?? []).filter(r => r.status === 'zatwierdzony').length;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Link to="/mleko" className="text-gray-400 hover:text-gray-600 text-sm">← Mleczarnia</Link>
        <h1 className="text-xl font-bold text-gray-900">📒 Moje przepisy</h1>
      </div>
      <p className="text-sm text-gray-500">
        Przepisy zapisane z Twoich produkcji — z faktycznym czasem etapów i dodatkami. Możesz zgłosić je
        do publikacji w bazie serowarni; po zatwierdzeniu trafiają do feedu społeczności.
      </p>

      {approvedCount > 0 && (
        <div className="rounded-xl bg-brand-50 border border-brand-100 px-4 py-3 flex items-center justify-between gap-2">
          <span className="text-sm text-gray-600">
            {approvedCount} {approvedCount === 1 ? 'zatwierdzony przepis' : 'zatwierdzonych przepisów'} gotowych do publikacji.
          </span>
          <Button size="sm" loading={busy} onClick={exportFeed}>⬇ Eksportuj feed</Button>
        </div>
      )}

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
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800">🧀 {ur.recipe.nazwa}</p>
                  <p className="text-xs text-gray-400">{ur.recipe.rodzina} · {ur.recipe.kroki.length} kroków</p>
                  {ur.recipe.uwagi && <p className="text-xs text-amber-700 mt-1">{ur.recipe.uwagi}</p>}
                </div>
                <span className="shrink-0 text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                  {STATUS_LABEL[ur.status]}
                </span>
              </div>

              {/* Akcje wg statusu */}
              <div className="flex flex-wrap gap-2 mt-3">
                {ur.status === 'prywatny' && (
                  <Button size="sm" variant="outline" loading={busy} onClick={() => setStatus(ur, 'zgloszony')}>
                    📤 Zgłoś do publikacji
                  </Button>
                )}
                {ur.status === 'zgloszony' && (
                  <>
                    <span className="text-xs text-gray-400 self-center mr-1">Moderacja:</span>
                    <Button size="sm" loading={busy} onClick={() => setStatus(ur, 'zatwierdzony')}>✓ Zatwierdź</Button>
                    <Button size="sm" variant="outline" loading={busy} onClick={() => setStatus(ur, 'odrzucony')}>✖ Odrzuć</Button>
                  </>
                )}
                {(ur.status === 'zatwierdzony' || ur.status === 'odrzucony') && (
                  <Button size="sm" variant="outline" loading={busy} onClick={() => setStatus(ur, 'prywatny')}>
                    ↩︎ Cofnij do prywatnych
                  </Button>
                )}
              </div>

              <p className="text-xs text-gray-300 mt-2">{new Date(ur.createdAt).toLocaleDateString('pl-PL')}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
