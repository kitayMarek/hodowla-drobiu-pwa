export type ActivityColor = 'blue' | 'green' | 'yellow' | 'orange' | 'red' | 'gray';

export interface Activity {
  id?: number;
  key:       string;         // wartość scope w transakcjach, np. 'drob', 'trak'
  name:      string;         // wyświetlana nazwa, np. 'Drób', 'Trak'
  icon:      string;         // emoji
  color:     ActivityColor;
  isSystem:  boolean;        // true = nie można usunąć (drob, osobiste)
  isActive:  boolean;        // false = ukryta przez użytkownika
  sortOrder: number;
  createdAt: string;
}

/** Domyślne działalności – wstawiane przy pierwszym uruchomieniu */
export const DEFAULT_ACTIVITIES: Omit<Activity, 'id' | 'createdAt'>[] = [
  { key: 'drob',          name: 'Drób',         icon: '🐔', color: 'blue',   isSystem: true,  isActive: true, sortOrder: 0  },
  { key: 'sery',          name: 'Sery',          icon: '🧀', color: 'yellow', isSystem: false, isActive: true, sortOrder: 10 },
  { key: 'agroturystyka', name: 'Agroturystyka', icon: '🏡', color: 'green',  isSystem: false, isActive: true, sortOrder: 20 },
  { key: 'osobiste',      name: 'Osobiste',      icon: '🏠', color: 'gray',   isSystem: true,  isActive: true, sortOrder: 99 },
];

/** Dostępne kolory dla nowych działalności */
export const ACTIVITY_COLORS: { value: ActivityColor; label: string }[] = [
  { value: 'blue',   label: 'Niebieski' },
  { value: 'green',  label: 'Zielony'   },
  { value: 'yellow', label: 'Żółty'     },
  { value: 'orange', label: 'Pomarańczowy' },
  { value: 'red',    label: 'Czerwony'  },
  { value: 'gray',   label: 'Szary'     },
];

/** Dostępne ikony do wyboru */
export const ACTIVITY_ICONS = [
  '🐔','🐷','🐄','🐑','🐐','🐟','🌾','🌿','🍃','🧀','🥛','🍷','🏡',
  '🏗️','🏭','🪚','⛏️','🌲','🪵','🚜','🚛','⚙️','🔧','🌻','🍓','🫙',
];
