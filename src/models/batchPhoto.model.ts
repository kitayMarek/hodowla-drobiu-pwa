export interface BatchPhoto {
  id?: number;
  batchId: number;
  photoDate: string;        // ISO 'YYYY-MM-DD'
  description?: string;
  imageData: Blob;          // JPEG (zdjęcie) lub oryginalny blob wideo
  thumbData: Blob;          // miniatura 220×220 JPEG (kadr z wideo lub miniatura zdjęcia)
  fileName?: string;
  mediaType?: 'image' | 'video';  // domyślnie 'image' dla wstecznej zgodności
  createdAt: string;
}
