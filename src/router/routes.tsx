import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { BatchListPage } from '@/pages/batches/BatchListPage';
import { BatchFormPage } from '@/pages/batches/BatchFormPage';
import { BatchDetailPage } from '@/pages/batches/BatchDetailPage';
import { DailyEntryListPage } from '@/pages/daily/DailyEntryListPage';
import { DailyEntryFormPage } from '@/pages/daily/DailyEntryFormPage';
import { FeedPage } from '@/pages/feed/FeedPage';
import { HousingPage } from '@/pages/housing/HousingPage';
import { HealthPage } from '@/pages/health/HealthPage';
import { WeighingListPage } from '@/pages/weighings/WeighingListPage';
import { SlaughterPage } from '@/pages/slaughter/SlaughterPage';
import { SalesPage } from '@/pages/sales/SalesPage';
import { FinancePage } from '@/pages/finance/FinancePage';
import { ReportsPage } from '@/pages/reports/ReportsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },

      // Stada
      { path: 'stada', element: <BatchListPage /> },
      { path: 'stada/nowe', element: <BatchFormPage /> },
      { path: 'stada/:batchId', element: <BatchDetailPage /> },
      { path: 'stada/:batchId/edytuj', element: <BatchFormPage /> },

      // Dziennik
      { path: 'stada/:batchId/dziennik', element: <DailyEntryListPage /> },
      { path: 'stada/:batchId/dziennik/nowy', element: <DailyEntryFormPage /> },
      { path: 'stada/:batchId/dziennik/:entryId', element: <DailyEntryFormPage /> },

      // Warunki utrzymania
      { path: 'stada/:batchId/warunki', element: <HousingPage /> },

      // Zdrowie
      { path: 'stada/:batchId/zdrowie', element: <HealthPage /> },

      // Ważenia
      { path: 'stada/:batchId/wazenia', element: <WeighingListPage /> },

      // Ubój
      { path: 'stada/:batchId/uboj', element: <SlaughterPage /> },

      // Pasza
      { path: 'pasze', element: <FeedPage /> },

      // Sprzedaż
      { path: 'sprzedaz', element: <SalesPage /> },

      // Finanse
      { path: 'finanse', element: <FinancePage /> },

      // Raporty
      { path: 'raporty', element: <ReportsPage /> },

      // Ustawienia
      { path: 'ustawienia', element: <SettingsPage /> },
    ],
  },
]);
