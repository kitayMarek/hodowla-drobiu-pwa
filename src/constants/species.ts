export type Species = 'brojler' | 'nioska' | 'kaczka' | 'indyk' | 'ges' | 'bydlo';

export const SPECIES_LABELS: Record<Species, string> = {
  brojler: 'Brojler kurzy',
  nioska: 'Nioska',
  kaczka: 'Kaczka mięsna',
  indyk: 'Indyk',
  ges: 'Gęś',
  bydlo: 'Bydło',
};

export const SPECIES_EMOJI: Record<Species, string> = {
  brojler: '🐔',
  nioska: '🥚',
  kaczka: '🦆',
  indyk: '🦃',
  ges: '🪿',
  bydlo: '🐄',
};

// Gatunki wybierane w formularzu stada (wszystkie obsługiwane produkcyjnie).
export const ACTIVE_SPECIES: Species[] = ['brojler', 'nioska', 'kaczka', 'indyk', 'ges', 'bydlo'];

// Gatunki drobiu — tylko one mają sens w wylęgarni i przy jajach wylęgowych (bez bydła).
export const POULTRY_SPECIES: Species[] = ['brojler', 'nioska', 'kaczka', 'indyk', 'ges'];

// Gatunek produkuje jaja jako główny produkt
export function isLayerSpecies(species: Species): boolean {
  return species === 'nioska';
}

// Gatunek przeznaczony do uboju mięsnego (bydło = mięsne, nie nieśne)
export function isMeatSpecies(species: Species): boolean {
  return species !== 'nioska';
}
