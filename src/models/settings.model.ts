export interface AppSettings {
  id?: number;
  key: SettingsKey;
  value: string;             // JSON-serializowana wartość
  updatedAt: string;
}

export type SettingsKey =
  | 'farm_name'
  | 'owner_name'
  | 'currency'
  | 'default_species'
  | 'fcr_target_brojler'
  | 'fcr_target_kaczka'
  | 'fcr_target_nioska'
  | 'mortality_alert_percent'
  | 'ammonia_alert_ppm'
  | 'temp_alert_celsius';

export const SETTINGS_DEFAULTS: Record<SettingsKey, string> = {
  farm_name: '"Moja Ferma"',
  owner_name: '""',
  currency: '"PLN"',
  default_species: '"brojler"',
  fcr_target_brojler: '1.7',
  fcr_target_kaczka: '2.2',
  fcr_target_nioska: '2.0',
  mortality_alert_percent: '5',
  ammonia_alert_ppm: '20',
  temp_alert_celsius: '35',
};
