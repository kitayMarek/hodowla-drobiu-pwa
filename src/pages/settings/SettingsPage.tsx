import React, { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { settingsService } from '@/services/settings.service';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/contexts/AuthContext';
import { exportToJson, importFromLocalDexie, importFromJson, clearAllSupabaseData } from '@/services/migration.service';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { pl } from '@/i18n/pl';

type MigStatus = { type: 'idle' } | { type: 'busy'; msg: string } | { type: 'ok'; msg: string } | { type: 'err'; msg: string };

export function SettingsPage() {
  const settings = useSettings();
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);

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
    ]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4 max-w-lg">
      <h1 className="text-xl font-bold text-gray-900">{pl.settings.title}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card title="Dane fermy">
          <div className="space-y-3">
            <Input label={pl.settings.farmName} {...register('farm_name')} />
            <Input label={pl.settings.ownerName} {...register('owner_name')} />
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
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              Zaloguj się, aby importować dane lub migrować je do chmury.
            </p>
          )}
        </div>
      </Card>

      {/* Info section */}
      <Card title="O aplikacji" padding="md">
        <div className="space-y-2 text-sm text-gray-600">
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
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
            Roadmapa: v2 Kalkulator receptur · v3 Lęgi · v4 Gęsi i indyki
          </div>
        </div>
      </Card>
    </div>
  );
}
