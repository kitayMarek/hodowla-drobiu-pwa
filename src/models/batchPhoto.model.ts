export interface BatchPhoto {
  id?: number;
  batchId: number;
  photoDate: string;       // ISO 'YYYY-MM-DD'
  description?: string;
  imageData: Blob;         // skompresowany JPEG przechowywany w IndexedDB
  thumbData: Blob;         // miniatura 200×200 do szybkiego renderowania galerii
  fileName?: string;
  createdAt: string;
}
