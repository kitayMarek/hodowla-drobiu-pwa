import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export function exportToCSV(data: object[], filename: string): void {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dane');
  XLSX.writeFile(wb, `${filename}.csv`, { bookType: 'csv' });
}

export function exportToExcel(
  sheets: Array<{ name: string; data: object[] }>,
  filename: string
): void {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.data);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  XLSX.writeFile(wb, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

export function flattenForExport<T extends object>(
  items: T[],
  labelMap: Partial<Record<keyof T, string>>
): object[] {
  return items.map(item => {
    const row: Record<string, unknown> = {};
    for (const [key, label] of Object.entries(labelMap)) {
      row[label as string] = (item as Record<string, unknown>)[key];
    }
    return row;
  });
}
