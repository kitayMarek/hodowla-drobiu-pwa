import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { TopBar } from './TopBar';
import { DemoBanner } from '@/components/ui/DemoBanner';
import { InstallBanner } from '@/components/ui/InstallBanner';
import { BackupReminderModal } from '@/components/ui/BackupReminderModal';
import { SetupWizardPage } from '@/pages/setup/SetupWizardPage';
import { useAuth } from '@/contexts/AuthContext';
import { shouldShowReminder } from '@/services/backupReminder';
import { activityService } from '@/services/activity.service';
import { ActivitiesProvider } from '@/contexts/ActivitiesContext';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showBackup,  setShowBackup]  = useState(false);
  const [needsSetup,  setNeedsSetup]  = useState<boolean | null>(null);
  const { user, loading } = useAuth();

  // Sprawdź czy nowy użytkownik potrzebuje kreatora (tylko zalogowani)
  useEffect(() => {
    if (loading) return;
    if (!user) { setNeedsSetup(false); return; }
    activityService.isSetupNeeded().then(needed => setNeedsSetup(needed));
  }, [user, loading]);

  // Sprawdź potrzebę backupu 4 s po zalogowaniu (nie blokuje renderowania)
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => {
      if (shouldShowReminder()) setShowBackup(true);
    }, 4000);
    return () => clearTimeout(t);
  }, [user]);

  if (loading || needsSetup === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
      </div>
    );
  }

  // Nowy użytkownik – pokaż kreator wyboru działalności
  if (needsSetup) {
    return <SetupWizardPage onComplete={() => setNeedsSetup(false)} />;
  }

  return (
    <ActivitiesProvider>
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Baner demo – widoczny gdy niezalogowany */}
      {!user && <DemoBanner />}

      {/* Baner instalacji PWA – tylko mobile */}
      <InstallBanner />

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <div className="hidden md:flex md:w-56 md:flex-col md:fixed md:inset-y-0" style={{ top: !user ? '40px' : '0' }}>
          <Sidebar />
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-56 bg-white shadow-xl">
              <Sidebar onNavClick={() => setSidebarOpen(false)} />
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 md:ml-56 flex flex-col min-h-screen">
          <TopBar onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 p-4 pb-20 md:pb-6 max-w-5xl w-full mx-auto">
            <Outlet />
          </main>
        </div>

        {/* Mobile bottom navigation */}
        <div className="md:hidden">
          <BottomNav />
        </div>
      </div>

      {/* Backup reminder modal */}
      <BackupReminderModal open={showBackup} onClose={() => setShowBackup(false)} />
    </div>
    </ActivitiesProvider>
  );
}
