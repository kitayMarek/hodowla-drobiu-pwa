import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { exportToJson } from '@/services/migration.service';
import { snoozeReminder, getDaysSinceBackup, SNOOZE_DAYS } from '@/services/backupReminder';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function BackupReminderModal({ open, onClose }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [done, setDone]               = useState(false);

  const days = getDaysSinceBackup();

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await exportToJson();
      setDone(true);
      setTimeout(onClose, 1800);
    } finally {
      setDownloading(false);
    }
  };

  const handleSnooze = () => {
    snoozeReminder();
    onClose();
  };

  const urgencyMsg = days === null
    ? 'Nie masz jeszcze żadnej kopii zapasowej danych.'
    : `Twoje dane nie były archiwizowane od ${days} dni.`;

  return (
    <Modal open={open} onClose={handleSnooze} title="Kopia zapasowa" size="sm">
      <div className="space-y-5">

        {/* Icon + message */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0 text-2xl">
            💾
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-800">{urgencyMsg}</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Pobierz plik JSON ze wszystkimi danymi fermy — stadami, paszą, finansami
              i historią wpisów. Zajmuje kilka sekund i możesz go zaimportować w każdej chwili.
            </p>
          </div>
        </div>

        {/* Success message */}
        {done && (
          <p className="text-sm text-green-600 font-medium text-center py-1">
            ✓ Backup pobrany! Możesz zamknąć to okno.
          </p>
        )}

        {/* Actions */}
        {!done && (
          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={handleDownload}
              loading={downloading}
              disabled={downloading}
            >
              ⬇ Pobierz backup JSON
            </Button>
            <button
              onClick={handleSnooze}
              className="w-full text-xs text-gray-400 hover:text-gray-600 py-2 transition-colors"
            >
              Przypomnij za {SNOOZE_DAYS} dni
            </button>
          </div>
        )}

        {/* Footer */}
        <p className="text-xs text-gray-400 text-center border-t border-gray-50 pt-3">
          Pytania? <a href="mailto:marek@fermly.pl" className="hover:text-brand-600">marek@fermly.pl</a>
        </p>
      </div>
    </Modal>
  );
}
