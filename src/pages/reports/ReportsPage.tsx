import React from 'react';
import { useExport } from '@/hooks/useExport';
import { useBatches } from '@/hooks/useBatch';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { pl } from '@/i18n/pl';

interface ReportCard {
  title: string;
  description: string;
  icon: string;
  action: () => void;
  badge?: string;
}

export function ReportsPage() {
  const { exportDailyEggs, exportWeeklyFeed } = useExport();
  const batches = useBatches();
  const { exportBatchToExcel } = useExport();

  const reports: ReportCard[] = [
    {
      title: pl.reports.dailyEggs,
      description: 'Zestawienie dziennej produkcji jaj dla wszystkich stad.',
      icon: '🥚',
      action: exportDailyEggs,
    },
    {
      title: pl.reports.weeklyFeed,
      description: 'Tygodniowe zużycie paszy z podziałem na rodzaj paszy.',
      icon: '🌾',
      action: exportWeeklyFeed,
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Raporty i eksport</h1>

      {/* General reports */}
      <Card title="Raporty ogólne" padding="none">
        {reports.map((r, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
            <span className="text-2xl">{r.icon}</span>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">{r.title}</div>
              <div className="text-xs text-gray-500">{r.description}</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={r.action}>
                CSV
              </Button>
            </div>
          </div>
        ))}
      </Card>

      {/* Per-batch reports */}
      <Card title="Raport partii (pełny)" padding="none">
        <div className="px-4 py-3 border-b border-gray-50">
          <p className="text-xs text-gray-500">Eksport wszystkich danych partii do pliku Excel (wiele arkuszy).</p>
        </div>
        {batches.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-400">Brak stad do eksportu.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {batches.map(batch => (
              <div key={batch.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{batch.name}</div>
                  <div className="text-xs text-gray-400">
                    {batch.species} · {batch.initialCount.toLocaleString('pl-PL')} szt.
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => exportBatchToExcel(batch.id!, batch.name)}
                >
                  Excel
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Future reports placeholder */}
      <div className="bg-gray-50 rounded-xl px-4 py-4">
        <div className="text-sm font-semibold text-gray-600 mb-2">Planowane raporty (v2+)</div>
        <div className="space-y-1">
          {[
            pl.reports.mortality,
            pl.reports.fcr,
            pl.reports.growth,
            pl.reports.profitability,
            'Raport roczny – zestawienie wszystkich partii',
          ].map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-gray-400">
              <Badge color="gray">Wkrótce</Badge>
              {r}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
