import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { supabase } from '@/lib/supabase';
import { activityService } from '@/services/activity.service';
import { cacheGet, cacheSet } from '@/lib/sessionCache';
import { useAuth } from '@/contexts/AuthContext';
import type { Activity } from '@/models/activity.model';

const ActivitiesContext = createContext<Activity[]>([]);

export function ActivitiesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // Offline (Dexie)
  const dexie = useLiveQuery(
    () => !user ? db.activities.orderBy('sortOrder').toArray() : Promise.resolve([] as Activity[]),
    [!!user]
  ) ?? [];

  // Online (Supabase) — jeden kanał na całą aplikację
  const [sb, setSb] = useState<Activity[]>(() =>
    user ? (cacheGet<Activity[]>(`activities_${user.id}`) ?? []) : []
  );

  useEffect(() => {
    if (!user) { setSb([]); return; }

    const refresh = () =>
      activityService.getAll().then(data => {
        setSb(data);
        cacheSet(`activities_${user.id}`, data);
      });

    refresh();

    const ch = supabase
      .channel(`activities-ctx-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, refresh)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  return (
    <ActivitiesContext.Provider value={user ? sb : dexie}>
      {children}
    </ActivitiesContext.Provider>
  );
}

/** Zwraca listę wszystkich działalności użytkownika. Bezpieczne do użycia w wielu komponentach. */
export function useActivitiesContext(): Activity[] {
  return useContext(ActivitiesContext);
}
