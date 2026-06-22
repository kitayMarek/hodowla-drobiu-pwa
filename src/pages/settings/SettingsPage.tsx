import React, { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { AskLLM } from '@/components/AskLLM';
import { settingsService } from '@/services/settings.service';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/contexts/AuthContext';
import { exportToJson, importFromLocalDexie, importFromJson, clearAllSupabaseData } from '@/services/migration.service';
import { clearDemoData, isDemoSeeded } from '@/services/demoData.service';
import { activityService } from '@/services/activity.service';
import { useActivitiesManaged } from '@/hooks/useTableData';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { pl } from '@/i18n/pl';
import { ACTIVITY_COLORS, ACTIVITY_ICONS } from '@/models/activity.model';
import type { ActivityColor } from '@/models/activity.model';

type MigStatus = { type: 'idle' } | { type: 'busy'; msg: string } | { type: 'ok'; msg: string } | { type: 'err'; msg: string };

export function SettingsPage() {
  const settings = useSettings();
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);

  // ── Działalności ────────────────────────────────────────────
  const { activities, refresh: refreshActivities } = useActivitiesManaged();
  const [showAddActivity,  setShowAddActivity]  = useState(false);
  const [newActName,       setNewActName]       = useState('');
  const [newActIcon,       setNewActIcon]       = useState('🏭');
  const [newActColor,      setNewActColor]      = useState<ActivityColor>('blue');
  const [actSaving,        setActSaving]        = useState(false);
  const [actError,         setActError]         = useState('');
  const [deleteActTarget,  setDeleteActTarget]  = useState<number | null>(null);

  const handleAddActivity = async () => {
    if (!newActName.trim()) return;
    setActSaving(true);
    setActError('');
    try {
      await activityService.create({ key: '', name: newActName.trim(), icon: newActIcon, color: newActColor });
      setNewActName(''); setNewActIcon('🏭'); setNewActColor('blue');
      setShowAddActivity(false);
      refreshActivities();
    } catch (e) {
      setActError(e instanceof Error ? e.message : JSON.stringify(e));
    } finally {
      setActSaving(false);
    }
  };

  const handleToggleActivity = async (id: number, isActive: boolean) => {
    await activityService.setActive(id, !isActive);
    refreshActivities();
  };

  const handleDeleteActivity = async (id: number) => {
    await activityService.delete(id);
    refreshActivities();
    setDeleteActTarget(null);
  };

  // ── Data management state ───────────────────────────────────
  const [migStatus, setMigStatus] = useState<MigStatus>({ type: 'idle' });
  const [exportStatus, setExportStatus] = useState<MigStatus>({ type: 'idle' });
  const [importStatus, setImportStatus] = useState<MigStatus>({ type: 'idle' });
  const [clearStatus, setClearStatus] = useState<MigStatus>({ type: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClearData = async () => {
    const confirmed = window.confirm(
      'UWAGA! Ta operacja usunie WSZYSTKIE Twoje dane z chmury (stada, wpisy, paszę, finanse…).\n\nTej operacji nie można cofnąć.\n\nCzy na pewno chcesz kontynuować?'
    );
    if (!confirmed) return;
    setClearStatus({ type: 'busy', msg: 'Usuwam dane…' });
    try {
      await clearAllSupabaseData();
      setClearStatus({ type: 'ok', msg: '✓ Dane usunięte. Możesz teraz zaimportować backup.' });
    } catch (e) {
      setClearStatus({ type: 'err', msg: (e as Error).message });
    }
  };

  const handleMigrateFromDexie = async () => {
    setMigStatus({ type: 'busy', msg: 'Trwa migracja danych z tego urządzenia…' });
    try {
      const { imported, errors } = await importFromLocalDexie();
      if (errors === 0) {
        setMigStatus({ type: 'ok', msg: `✓ Zmigrowano ${imported} rekordów. Odśwież stronę.` });
      } else {
        setMigStatus({ type: 'ok', msg: `✓ Zmigrowano ${imported} rekordów, ${errors} błędów (szczegóły w konsoli).` });
      }
    } catch (e) {
      setMigStatus({ type: 'err', msg: (e as Error).message });
    }
  };

  const handleExport = async () => {
    setExportStatus({ type: 'busy', msg: 'Przygotowuję plik…' });
    try {
      await exportToJson();
      setExportStatus({ type: 'ok', msg: '✓ Plik pobrany.' });
      setTimeout(() => setExportStatus({ type: 'idle' }), 3000);
    } catch (e) {
      setExportStatus({ type: 'err', msg: (e as Error).message });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus({ type: 'busy', msg: 'Importuję dane z pliku…' });
    try {
      const { imported, errors } = await importFromJson(file);
      if (errors === 0) {
        setImportStatus({ type: 'ok', msg: `✓ Zaimportowano ${imported} rekordów. Odśwież stronę.` });
      } else {
        setImportStatus({ type: 'ok', msg: `✓ Zaimportowano ${imported} rekordów, ${errors} błędów (szczegóły w konsoli).` });
      }
    } catch (e) {
      setImportStatus({ type: 'err', msg: (e as Error).message });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    values: {
      farm_name: String(settings['farm_name'] ?? 'Moja Ferma'),
      owner_name: String(settings['owner_name'] ?? ''),
      fcr_target_brojler: String(settings['fcr_target_brojler'] ?? '1.7'),
      fcr_target_kaczka: String(settings['fcr_target_kaczka'] ?? '2.2'),
      fcr_target_nioska: String(settings['fcr_target_nioska'] ?? '2.0'),
      mortality_alert_percent: String(settings['mortality_alert_percent'] ?? '5'),
      ammonia_alert_ppm: String(settings['ammonia_alert_ppm'] ?? '20'),
      temp_alert_celsius: String(settings['temp_alert_celsius'] ?? '35'),
      rhd_limit_pln: String(settings['rhd_limit_pln'] ?? '100000'),
      rhd_producer_name: String(settings['rhd_producer_name'] ?? ''),
      rhd_producer_address: String(settings['rhd_producer_address'] ?? ''),
      rhd_reg_number: String(settings['rhd_reg_number'] ?? ''),
      rhd_vet_number: String(settings['rhd_vet_number'] ?? ''),
      rhd_storage_default: String(settings['rhd_storage_default'] ?? 'Przechowywać w temp. 4–8°C'),
    },
  });

  const onSubmit = async (data: Record<string, string>) => {
    await Promise.all([
      settingsService.set('farm_name', data.farm_name),
      settingsService.set('owner_name', data.owner_name),
      settingsService.set('fcr_target_brojler', parseFloat(data.fcr_target_brojler)),
      settingsService.set('fcr_target_kaczka', parseFloat(data.fcr_target_kaczka)),
      settingsService.set('fcr_target_nioska', parseFloat(data.fcr_target_nioska)),
      settingsService.set('mortality_alert_percent', parseFloat(data.mortality_alert_percent)),
      settingsService.set('ammonia_alert_ppm', parseFloat(data.ammonia_alert_ppm)),
      settingsService.set('temp_alert_celsius', parseFloat(data.temp_alert_celsius)),
      settingsService.set('rhd_limit_pln', parseFloat(data.rhd_limit_pln)),
      settingsService.set('rhd_producer_name', data.rhd_producer_name),
      settingsService.set('rhd_producer_address', data.rhd_producer_address),
      settingsService.set('rhd_reg_number', data.rhd_reg_number),
      settingsService.set('rhd_vet_number', data.rhd_vet_number),
      settingsService.set('rhd_storage_default', data.rhd_storage_default),
    ]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4 max-w-lg">
      <h1 className="text-xl font-bold text-gray-900">{pl.settings.title}</h1>

      <div><AskLLM defaultQuery="Fermly aplikacja gospodarstwo rolne drób RHD jak zacząć" /></div>

      {/* ── Tryb aplikacji ───────────────────────────────────────────── */}
      {(() => {
        const hasAnyUserActivity = activities.some(a => a.isActive && !a.isSystem);
        const isFinanceMode = !hasAnyUserActivity && activities.length > 0;

        const switchToFinance = async () => {
          for (const act of activities.filter(a => !a.isSystem && a.isActive)) {
            if (act.id != null) await activityService.setActive(act.id, false);
          }
          refreshActivities();
        };
        const switchToFarm = async () => {
          for (const act of activities.filter(a => !a.isSystem && !a.isActive)) {
            if (act.id != null) await activityService.setActive(act.id, true);
          }
          refreshActivities();
        };

        return (
          <Card title="⚙️ Tryb aplikacji">
            <div className="flex gap-2">
              <button
                onClick={switchToFarm}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 text-sm font-medium transition-colors ${
                  !isFinanceMode ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl">🏡</span>
                <span>Działalność / ferma</span>
                {!isFinanceMode && <span className="text-[10px] text-brand-500 font-normal">aktywny</span>}
              </button>
              <button
                onClick={switchToFinance}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 text-sm font-medium transition-colors ${
                  isFinanceMode ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl">💳</span>
                <span>Tylko finanse</span>
                {isFinanceMode && <span className="text-[10px] text-blue-500 font-normal">aktywny</span>}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {isFinanceMode
                ? 'Tryb finansowy — moduły produkcyjne są ukryte. Przełącz na "Działalność" aby je przywrócić.'
                : 'Tryb działalności — widoczne są wszystkie aktywne moduły produkcyjne.'}
            </p>
          </Card>
        );
      })()}

      {/* ── Działalności ─────────────────────────────────────────────── */}
      <Card title="🏭 Działalności">
        <div className="space-y-2">
          {activities.map(act => (
            <div key={act.id} className={`flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 ${!act.isActive ? 'opacity-50' : ''}`}>
              <span className="text-xl select-none">{act.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800">{act.name}</div>
                {act.isSystem && <div className="text-xs text-gray-400">systemowa</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Toggle aktywności */}
                {!act.isSystem && (
                  <button
                    onClick={() => act.id != null && handleToggleActivity(act.id, act.isActive)}
                    className={`text-xs px-2 py-1 rounded-lg border font-medium transition-colors ${
                      act.isActive
                        ? 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
                        : 'border-gray-200 text-gray-400 bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    {act.isActive ? 'Aktywna' : 'Ukryta'}
                  </button>
                )}
                {/* Usuń – tylko nieaktywne, niesystemowe */}
                {!act.isSystem && !act.isActive && (
                  <button
                    onClick={() => act.id != null && setDeleteActTarget(act.id)}
                    className="text-xs text-gray-300 hover:text-red-400"
                  >🗑️</button>
                )}
              </div>
            </div>
          ))}

          {/* Dodaj nową */}
          {showAddActivity ? (
            <div className="pt-2 space-y-2 border-t border-gray-100">
              {actError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">⚠ {actError}</div>
              )}
              <input
                value={newActName}
                onChange={e => setNewActName(e.target.value)}
                placeholder="Nazwa działalności (np. Trak)"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {/* Ikona */}
              <div>
                <div className="text-xs text-gray-500 mb-1">Ikona</div>
                <div className="flex flex-wrap gap-1.5">
                  {ACTIVITY_ICONS.map(ico => (
                    <button
                      key={ico}
                      onClick={() => setNewActIcon(ico)}
                      className={`text-lg p-1 rounded-lg border transition-colors ${newActIcon === ico ? 'border-brand-400 bg-brand-50' : 'border-gray-100 hover:border-gray-300'}`}
                    >
                      {ico}
                    </button>
                  ))}
                </div>
              </div>
              {/* Kolor */}
              <div>
                <div className="text-xs text-gray-500 mb-1">Kolor</div>
                <div className="flex flex-wrap gap-2">
                  {ACTIVITY_COLORS.map(c => (
                    <button
                      key={c.value}
                      onClick={() => setNewActColor(c.value)}
                      className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                        newActColor === c.value ? 'ring-2 ring-offset-1 ring-brand-400' : ''
                      } ${
                        c.value === 'blue'   ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : c.value === 'green'  ? 'bg-green-100 text-green-700 border-green-200'
                        : c.value === 'yellow' ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                        : c.value === 'orange' ? 'bg-orange-100 text-orange-700 border-orange-200'
                        : c.value === 'red'    ? 'bg-red-100 text-red-700 border-red-200'
                        : 'bg-gray-100 text-gray-700 border-gray-200'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" loading={actSaving} onClick={handleAddActivity} className="flex-1">
                  Dodaj działalność
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setShowAddActivity(false); setActError(''); }}>
                  Anuluj
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddActivity(true)}
              className="mt-1 text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              + Dodaj nową działalność
            </button>
          )}
        </div>

        {/* Confirm delete */}
        {deleteActTarget != null && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
            <p className="text-sm text-red-700">Trwale usunąć tę działalność? Istniejące transakcje nie zostaną usunięte.</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleDeleteActivity(deleteActTarget)} className="bg-red-600 hover:bg-red-700 text-white flex-1">
                Usuń
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDeleteActTarget(null)}>
                Anuluj
              </Button>
            </div>
          </div>
        )}
      </Card>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card title="Dane fermy">
          <div className="space-y-3">
            <Input label={pl.settings.farmName} {...register('farm_name')} />
            <Input label={pl.settings.ownerName} {...register('owner_name')} />
          </div>
        </Card>

        <Card title="Dane do etykiet RHD">
          <div className="space-y-3">
            <Input label="Producent (imię i nazwisko)" {...register('rhd_producer_name')} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adres gospodarstwa</label>
              <textarea rows={2} {...register('rhd_producer_address')}
                placeholder="ul. Przykładowa 1, 11-000 Miejscowość"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <Input label="Nr rejestracyjny RHD" placeholder="np. RHD/WM/001/2024" {...register('rhd_reg_number')} />
            <div>
              <Input label="Nr weterynaryjny (produkty odzwierzęce)" placeholder="np. WIW-RHD-14-0023/2024" {...register('rhd_vet_number')} />
              <p className="text-xs text-gray-400 mt-1">Nadawany przez PIW dla sera/masła/jaj — wymagany na etykiecie, inny niż nr RHD.</p>
            </div>
            <Input label="Domyślne przechowywanie" {...register('rhd_storage_default')} />
          </div>
        </Card>

        <Card title="Cele KPI">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Input label="FCR Brojler" type="number" step="0.1" {...register('fcr_target_brojler')} />
              <Input label="FCR Kaczka" type="number" step="0.1" {...register('fcr_target_kaczka')} />
              <Input label="FCR Nioska" type="number" step="0.1" {...register('fcr_target_nioska')} />
            </div>
          </div>
        </Card>

        <Card title="Alerty">
          <div className="space-y-3">
            <Input
              label={pl.settings.mortalityAlert}
              type="number"
              step="0.5"
              suffix="%"
              {...register('mortality_alert_percent')}
              hint="Powiadomienie gdy upadki przekroczą ten próg"
            />
            <Input
              label={pl.settings.ammoniaAlert}
              type="number"
              suffix="ppm"
              {...register('ammonia_alert_ppm')}
              hint="Bezpieczny poziom: poniżej 20 ppm"
            />
            <Input
              label={pl.settings.tempAlert}
              type="number"
              step="0.5"
              suffix="°C"
              {...register('temp_alert_celsius')}
            />
          </div>
        </Card>

        <Card title="📋 RHD — Rolniczy Handel Detaliczny">
          <div className="space-y-3">
            <Input
              label="Roczny limit sprzedaży RHD (zł)"
              type="number"
              step="1000"
              min="0"
              {...register('rhd_limit_pln')}
              hint="Aktualny limit wynosi 100 000 zł/rok (zmień jeśli przepisy się zmienią)"
            />
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" loading={isSubmitting} className="flex-1">
            Zapisz ustawienia
          </Button>
          {saved && <span className="text-sm text-green-600 font-medium">✓ Zapisano</span>}
        </div>
      </form>

      {/* Data management */}
      <Card title="Dane i backup" padding="md">
        <div className="space-y-4">

          {/* Export */}
          <div className="flex flex-col gap-2">
            <div>
              <p className="text-sm font-medium text-gray-700">Eksport kopii zapasowej</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Pobierz wszystkie dane jako plik JSON — przydatny jako backup lub do pracy lokalnej.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={handleExport}
                loading={exportStatus.type === 'busy'}
                disabled={exportStatus.type === 'busy'}
              >
                ⬇ Pobierz backup JSON
              </Button>
              {exportStatus.type !== 'idle' && (
                <span className={`text-xs ${exportStatus.type === 'err' ? 'text-red-600' : 'text-green-600'}`}>
                  {exportStatus.msg}
                </span>
              )}
            </div>
          </div>

          {user && (
            <>
              <hr className="border-gray-100" />

              {/* Clear all data */}
              <div className="flex flex-col gap-2">
                <div>
                  <p className="text-sm font-medium text-red-700">Wyczyść dane w chmurze</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Usuwa WSZYSTKIE dane z Twojego konta Supabase. Użyj przed ponownym importem, jeśli poprzedni import się powiódł nieprawidłowo.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="danger"
                    onClick={handleClearData}
                    loading={clearStatus.type === 'busy'}
                    disabled={clearStatus.type === 'busy'}
                  >
                    🗑 Wyczyść wszystkie dane
                  </Button>
                  {clearStatus.type !== 'idle' && (
                    <span className={`text-xs ${clearStatus.type === 'err' ? 'text-red-600' : 'text-green-600'}`}>
                      {clearStatus.msg}
                    </span>
                  )}
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Import from file */}
              <div className="flex flex-col gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-700">Import z pliku JSON</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Wgraj wcześniej pobrany backup. Działa tylko gdy konto jest puste.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={handleImportFile}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    loading={importStatus.type === 'busy'}
                    disabled={importStatus.type === 'busy'}
                  >
                    ⬆ Wybierz plik JSON
                  </Button>
                  {importStatus.type !== 'idle' && (
                    <span className={`text-xs ${importStatus.type === 'err' ? 'text-red-600' : 'text-green-600'}`}>
                      {importStatus.msg}
                    </span>
                  )}
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Migrate from local Dexie */}
              <div className="flex flex-col gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-700">Migracja z tego urządzenia</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Jednorazowe przeniesienie danych z przeglądarki (demo / localhost) do Twojego konta w chmurze.
                    Działa tylko gdy konto jest jeszcze puste.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleMigrateFromDexie}
                    loading={migStatus.type === 'busy'}
                    disabled={migStatus.type === 'busy'}
                  >
                    ☁ Migruj dane do chmury
                  </Button>
                  {migStatus.type !== 'idle' && (
                    <span className={`text-xs ${migStatus.type === 'err' ? 'text-red-600' : 'text-green-600'}`}>
                      {migStatus.msg}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}

          {!user && (
            <>
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                Zaloguj się, aby importować dane lub migrować je do chmury.
              </p>

              {isDemoSeeded() && (
                <>
                  <hr className="border-gray-100" />
                  <div className="flex flex-col gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Dane przykładowe</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Usuwa przykładowe dane demo z przeglądarki. Możesz potem zacząć od zera lub się zalogować.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        if (window.confirm('Usunąć wszystkie dane demo?')) {
                          await clearDemoData();
                          window.location.reload();
                        }
                      }}
                    >
                      🗑 Wyczyść dane demo
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Info section */}
      <Card title="O aplikacji" padding="md">
        <div className="space-y-2 text-sm text-gray-600">
          {/* Logo */}
          <div className="flex justify-center pb-2">
            <img
              src="/fermly-logo.jpg"
              alt="Fermly.pl"
              className="h-10 w-auto object-contain"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          </div>

          <div className="flex justify-between">
            <span>Wersja</span>
            <span className="font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span>Tryb</span>
            <span className="font-medium">{user ? 'Chmura (Supabase)' : 'Demo (przeglądarka)'}</span>
          </div>
          <div className="flex justify-between">
            <span>Baza danych</span>
            <span className="font-medium">{user ? 'PostgreSQL' : 'IndexedDB (lokalnie)'}</span>
          </div>

          {/* Contact */}
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Kontakt / wsparcie</span>
              <a
                href="mailto:marek@fermly.pl"
                className="font-medium text-brand-600 hover:text-brand-700"
              >
                marek@fermly.pl
              </a>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Strona</span>
              <a
                href="https://fermly.pl"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand-600 hover:text-brand-700"
              >
                fermly.pl
              </a>
            </div>
          </div>

          <div className="pt-2 text-xs text-gray-400">
            Roadmapa: v2 Kalkulator receptur · v3 Lęgi · v4 Gęsi i indyki
          </div>
        </div>
      </Card>
    </div>
  );
}
