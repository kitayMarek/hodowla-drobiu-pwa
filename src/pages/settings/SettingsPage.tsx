import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { settingsService } from '@/services/settings.service';
import { useSettings } from '@/hooks/useSettings';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { pl } from '@/i18n/pl';

export function SettingsPage() {
  const settings = useSettings();
  const [saved, setSaved] = useState(false);

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

      {/* Info section */}
      <Card title="O aplikacji" padding="md">
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Wersja</span>
            <span className="font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span>Tryb</span>
            <span className="font-medium">Offline-first PWA</span>
          </div>
          <div className="flex justify-between">
            <span>Baza danych</span>
            <span className="font-medium">IndexedDB (lokalnie)</span>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
            Roadmapa: v2 Kalkulator receptur · v3 Lęgi · v4 Chmura · v5 Gęsi i indyki
          </div>
        </div>
      </Card>
    </div>
  );
}
