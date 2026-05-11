import { db } from '@/db/database';
import type { BatchPhoto } from '@/models/batchPhoto.model';
import { compressImage, makeThumbnail, generateVideoThumbnail } from '@/utils/imageUtils';

export const batchPhotoService = {
  async getByBatch(batchId: number): Promise<BatchPhoto[]> {
    return db.batchPhotos
      .where('batchId').equals(batchId)
      .sortBy('photoDate');
  },

  async getById(id: number): Promise<BatchPhoto | undefined> {
    return db.batchPhotos.get(id);
  },

  /** Przyjmuje surowy plik z <input type="file">, kompresuje i zapisuje. */
  async createFromFile(
    batchId: number,
    file: File,
    photoDate: string,
    description?: string
  ): Promise<number> {
    const [imageData, thumbData] = await Promise.all([
      compressImage(file, 1920, 0.82),
      makeThumbnail(file, 220),
    ]);
    return db.batchPhotos.add({
      batchId,
      photoDate,
      description: description?.trim() || undefined,
      imageData,
      thumbData,
      fileName: file.name,
      createdAt: new Date().toISOString(),
    });
  },

  /**
   * Przyjmuje zdjęcie LUB filmik z <input type="file">.
   * Zdjęcia są kompresowane; wideo trafia surowe (przeglądarki nie oferują kompresji wideo).
   * Dla obu typów generowana jest miniatura 220×220.
   */
  async createMediaFromFile(
    batchId:     number,
    file:        File,
    photoDate:   string,
    description?: string
  ): Promise<number> {
    const isVideo = file.type.startsWith('video/');

    if (isVideo) {
      const MAX_VIDEO_MB = 200;
      if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
        throw new Error(`Plik wideo jest zbyt duży (maks. ${MAX_VIDEO_MB} MB).`);
      }
      const thumbData = await generateVideoThumbnail(file, 220);
      return db.batchPhotos.add({
        batchId,
        photoDate,
        description: description?.trim() || undefined,
        imageData:   file,          // Blob — surowe wideo
        thumbData,
        fileName:    file.name,
        mediaType:   'video',
        createdAt:   new Date().toISOString(),
      });
    }

    // Obraz — kompresja jak dotychczas
    return this.createFromFile(batchId, file, photoDate, description);
  },

  async updateDescription(id: number, description: string): Promise<void> {
    await db.batchPhotos.update(id, { description: description.trim() || undefined });
  },

  async delete(id: number): Promise<void> {
    await db.batchPhotos.delete(id);
  },

  async deleteByBatch(batchId: number): Promise<void> {
    await db.batchPhotos.where('batchId').equals(batchId).delete();
  },

  async countByBatch(batchId: number): Promise<number> {
    return db.batchPhotos.where('batchId').equals(batchId).count();
  },
};
