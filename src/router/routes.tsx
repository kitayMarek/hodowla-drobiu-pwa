import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { BatchListPage } from '@/pages/batches/BatchListPage';
import { BatchFormPage } from '@/pages/batches/BatchFormPage';
import { BatchDetailPage } from '@/pages/batches/BatchDetailPage';
import { BirdTransferPage } from '@/pages/batches/BirdTransferPage';
import { BatchPhotosPage } from '@/pages/batches/BatchPhotosPage';
import { DailyEntryListPage } from '@/pages/daily/DailyEntryListPage';
import { DailyEntryFormPage } from '@/pages/daily/DailyEntryFormPage';
import { FeedPage }             from '@/pages/feed/FeedPage';
import { FeedRecipePage }       from '@/pages/feed/FeedRecipePage';
import { FeedIngredientsPage }  from '@/pages/feed/FeedIngredientsPage';
import { HousingPage } from '@/pages/housing/HousingPage';
import { HealthPage } from '@/pages/health/HealthPage';
import { WeighingListPage } from '@/pages/weighings/WeighingListPage';
import { SlaughterPage } from '@/pages/slaughter/SlaughterPage';
import { CarcassWarehousePage } from '@/pages/slaughter/CarcassWarehousePage';
import { SalesPage } from '@/pages/sales/SalesPage';
import { UnifiedSalesPage } from '@/pages/sales/UnifiedSalesPage';
import { UnifiedSaleFormPage } from '@/pages/sales/UnifiedSaleFormPage';
import { SaleDocumentPage } from '@/pages/sales/SaleDocumentPage';
import { Navigate } from 'react-router-dom';
import { FinancePage } from '@/pages/finance/FinancePage';
import { InvestmentPage } from '@/pages/investments/InvestmentPage';
import { ReportsPage } from '@/pages/reports/ReportsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { HatcheryListPage } from '@/pages/hatchery/HatcheryListPage';
import { HatcheryFormPage } from '@/pages/hatchery/HatcheryFormPage';
import { HatcheryDetailPage } from '@/pages/hatchery/HatcheryDetailPage';
import { CashFlowPage } from '@/pages/cashflow/CashFlowPage';
import { QuickEntryPage } from '@/pages/quick/QuickEntryPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ComingSoonPage } from '@/pages/ComingSoonPage';
import { DairyDashboardPage } from '@/pages/dairy/DairyDashboardPage';
import { MilkReceptionPage } from '@/pages/dairy/MilkReceptionPage';
import { MilkReceptionFormPage } from '@/pages/dairy/MilkReceptionFormPage';
import { MilkAllocationPage } from '@/pages/dairy/MilkAllocationPage';
import { ProductionBatchListPage } from '@/pages/dairy/ProductionBatchListPage';
import { ProductionBatchDetailPage } from '@/pages/dairy/ProductionBatchDetailPage';
import { SuppliersPage } from '@/pages/dairy/SuppliersPage';
import { DairyProductsPage } from '@/pages/dairy/DairyProductsPage';
import { DairyBuyersPage } from '@/pages/dairy/DairyBuyersPage';
import { DairySalesPage } from '@/pages/dairy/DairySalesPage';
import { DairySaleFormPage } from '@/pages/dairy/DairySaleFormPage';
import { RhdRegisterPage } from '@/pages/dairy/RhdRegisterPage';
import { CheeseRecipePage } from '@/pages/dairy/CheeseRecipePage';
import { CheeseProductionStartPage } from '@/pages/dairy/CheeseProductionStartPage';
import { CheeseProductionRunnerPage } from '@/pages/dairy/CheeseProductionRunnerPage';
import { MyRecipesPage } from '@/pages/dairy/MyRecipesPage';
import { DojrzewalniaPage } from '@/pages/dairy/DojrzewalniaPage';
import { WProdukcjiPage } from '@/pages/dairy/WProdukcjiPage';
import { MetryczkaPage } from '@/pages/dairy/MetryczkaPage';
import { CheeseLabelPage } from '@/pages/dairy/CheeseLabelPage';

export const router = createBrowserRouter([
  // Strony autoryzacji – poza AppShell
  { path: '/logowanie',   element: <LoginPage /> },
  { path: '/rejestracja', element: <RegisterPage /> },

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

      // Zdjęcia
      { path: 'stada/:batchId/zdjecia', element: <BatchPhotosPage /> },

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

      // Przesunięcia ptaków
      { path: 'stada/:batchId/przesuniecia', element: <BirdTransferPage /> },

      // Ubój
      { path: 'stada/:batchId/uboj', element: <SlaughterPage /> },

      // Magazyn tuszek
      { path: 'magazyn-tuszek', element: <CarcassWarehousePage /> },

      // Pasza
      { path: 'pasze',             element: <FeedPage /> },
      { path: 'pasze/receptury',   element: <FeedRecipePage /> },
      { path: 'pasze/skladniki',   element: <FeedIngredientsPage /> },

      // Sprzedaż drób (stara strona — zamówienia, zakupy jaj, szczegółowe filtry)
      { path: 'sprzedaz-drob', element: <SalesPage /> },

      // Finanse
      { path: 'finanse', element: <FinancePage /> },

      // Inwestycje
      { path: 'inwestycje', element: <InvestmentPage /> },

      // Wylęgarnia
      { path: 'wyleglarnia', element: <HatcheryListPage /> },
      { path: 'wyleglarnia/nowy', element: <HatcheryFormPage /> },
      { path: 'wyleglarnia/:id', element: <HatcheryDetailPage /> },
      { path: 'wyleglarnia/:id/edytuj', element: <HatcheryFormPage /> },

      // Szybki wpis
      { path: 'szybki', element: <QuickEntryPage /> },

      // Sprzedaż — unified (główny punkt wejścia)
      { path: 'sprzedaz',             element: <UnifiedSalesPage /> },
      { path: 'sprzedaz/nowa',        element: <UnifiedSaleFormPage /> },
      { path: 'sprzedaz/:id',         element: <SaleDocumentPage /> },
      // Przekierowania z mleko/sprzedaz → unified
      { path: 'mleko/sprzedaz',       element: <Navigate to="/sprzedaz" replace /> },
      { path: 'mleko/sprzedaz/nowa',  element: <Navigate to="/sprzedaz/nowa" replace /> },

      // Dziennik kasowy
      { path: 'kasa', element: <CashFlowPage /> },

      // Raporty
      { path: 'raporty', element: <ReportsPage /> },

      // Ustawienia
      { path: 'ustawienia', element: <SettingsPage /> },

      // Przetwórstwo Mleka
      { path: 'mleko',                    element: <DairyDashboardPage /> },
      { path: 'mleko/przyjecia',          element: <MilkReceptionPage /> },
      { path: 'mleko/przyjecia/nowe',     element: <MilkReceptionFormPage /> },
      { path: 'mleko/rozlew/:id',         element: <MilkAllocationPage /> },
      { path: 'mleko/partie',             element: <ProductionBatchListPage /> },
      { path: 'mleko/partie/:id',         element: <ProductionBatchDetailPage /> },
      { path: 'mleko/partie/:id/produkcja', element: <CheeseProductionRunnerPage /> },
      { path: 'mleko/dostawcy',           element: <SuppliersPage /> },
      { path: 'mleko/produkty',           element: <DairyProductsPage /> },
      { path: 'mleko/nabywcy',            element: <DairyBuyersPage /> },
      { path: 'mleko/sprzedaz',           element: <DairySalesPage /> },
      { path: 'mleko/sprzedaz/nowa',      element: <DairySaleFormPage /> },
      { path: 'mleko/rhd',               element: <RhdRegisterPage /> },
      { path: 'mleko/przepisy',          element: <CheeseRecipePage /> },
      { path: 'mleko/warzenie',          element: <CheeseProductionStartPage /> },
      { path: 'mleko/moje-przepisy',     element: <MyRecipesPage /> },
      { path: 'mleko/dojrzewalnia',      element: <DojrzewalniaPage /> },
      { path: 'mleko/w-produkcji',       element: <WProdukcjiPage /> },
      { path: 'mleko/partie/:id/metryczka', element: <MetryczkaPage /> },
      { path: 'mleko/partie/:id/etykieta',  element: <CheeseLabelPage /> },

      // Placeholdery – moduły w przygotowaniu
      { path: 'mleko-old',    element: <ComingSoonPage module="🧀 Przetwórstwo mleka" /> },
      { path: 'kiszonki',     element: <ComingSoonPage module="🥬 Przetwory roślinne" /> },
      { path: 'agroturystyka', element: <ComingSoonPage module="🏡 Agroturystyka" /> },
    ],
  },
]);
