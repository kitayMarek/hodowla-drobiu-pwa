import { db } from '@/db/database';
import type { BatchPhoto } from '@/models/batchPhoto.model';
import { compressImage, makeThumbnail } from '@/utils/imageUtils';

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
