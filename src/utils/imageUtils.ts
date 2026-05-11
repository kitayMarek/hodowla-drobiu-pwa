/**
 * Kompresuje obraz do JPEG o maks. szerokości/wysokości i zwraca Blob.
 */
export async function compressImage(
  file: File,
  maxSize: number,
  quality = 0.82
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;
      const scale = Math.min(1, maxSize / Math.max(w, h));
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load error')); };
    img.src = url;
  });
}

/** Tworzy miniaturę kwadratową (crop do środka). */
export async function makeThumbnail(file: File, size = 220): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;
      const side   = Math.min(w, h);
      const sx     = (w - side) / 2;
      const sy     = (h - side) / 2;
      const canvas = document.createElement('canvas');
      canvas.width  = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Thumb toBlob failed'));
      }, 'image/jpeg', 0.75);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load error')); };
    img.src = url;
  });
}

/** Generuje miniaturę kwadratową z pierwszej klatki pliku wideo. */
export async function generateVideoThumbnail(file: File, size = 220): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url   = URL.createObjectURL(file);
    video.muted       = true;
    video.playsInline = true;
    video.preload     = 'metadata';

    video.onloadeddata = () => {
      // Odsuń się od klatki 0 żeby uniknąć czarnego ekranu
      video.currentTime = Math.min(0.5, video.duration * 0.1);
    };

    video.onseeked = () => {
      const { videoWidth: w, videoHeight: h } = video;
      const side   = Math.min(w, h);
      const sx     = (w - side) / 2;
      const sy     = (h - side) / 2;
      const canvas = document.createElement('canvas');
      canvas.width  = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, sx, sy, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Video thumb toBlob failed'));
      }, 'image/jpeg', 0.75);
    };

    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Błąd ładowania wideo')); };
    video.src = url;
  });
}

/** Tworzy tymczasowy object URL z Bloba i zwraca razem z funkcją cleanup. */
export function blobToObjectUrl(blob: Blob): { url: string; revoke: () => void } {
  const url = URL.createObjectURL(blob);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}
