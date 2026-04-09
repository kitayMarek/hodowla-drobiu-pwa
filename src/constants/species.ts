export type Species = 'brojler' | 'nioska' | 'kaczka' | 'indyk' | 'ges';

export const SPECIES_LABELS: Record<Species, string> = {
  brojler: 'Brojler kurzy',
  nioska: 'Nioska',
  kaczka: 'Kaczka mięsna',
  indyk: 'Indyk',
  ges: 'Gęś',
};

export const SPECIES_EMOJI: Record<Species, string> = {
  brojler: '🐔',
  nioska: '🥚',
  kaczka: '🦆',
  indyk: '🦃',
  ges: '🪿',
};

// Gatunki aktualnie obsługiwane w v1
export const ACTIVE_SPECIES: Species[] = ['brojler', 'nioska', 'kaczka'];

// Gatunek produkuje jaja jako główny produkt
export function isLayerSpecies(species: Species): boolean {
  return species === 'nioska';
}

// Gatunek przeznaczony do uboju mięsnego
export function isMeatSpecies(species: Species): boolean {
  return species !== 'nioska';
}
