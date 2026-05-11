export interface RecipeIngredient {
  nazwa:   string;
  procent: number;   // 0–100
  em:      number;   // Energia metaboliczna MJ/kg
  bialko:  number;   // Białko ogólne %
  ca:      number;   // Wapń %
  p:       number;   // Fosfor %
  wlokno:  number;   // Włókno surowe %
  cenaKg:  number;   // Cena za kg (PLN)
  na:      number;   // Sód %
  k:       number;   // Potas %
  mg:      number;   // Magnez %
  mn:      number;   // Mangan mg/kg
  zn:      number;   // Cynk mg/kg
  se:      number;   // Selen mg/kg
  fe:      number;   // Żelazo mg/kg
  i:       number;   // Jod mg/kg
}

export interface FeedRecipe {
  id?:         number;
  name:        string;
  birdType:    string;    // 'kury-nioski-lekkie' | 'kury-nioski-ciezkie' | 'brojlery' | 'kaczki' | 'gesi' | 'indyki'
  period:      string;    // np. 'Niesienie (powyżej 45%)'
  ingredients: RecipeIngredient[];
  costPerKg?:  number;   // obliczony przy zapisie
  notes?:      string;
  isPublic:    boolean;
  authorName?: string;   // do wyświetlania w Społeczności
  createdAt:   string;
}
