import type { AIImage } from './ai/types';

/**
 * Reduce la foto a ≤1024 px de lado y la recodifica a JPEG 0.8 antes de enviarla:
 * una foto de móvil de 4 MB se queda en ~150 KB, que es lo que marca la latencia real.
 */
export async function fileToAIImage(file: File, maxSide = 1024): Promise<{ image: AIImage; previewUrl: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  return { image: { mimeType: 'image/jpeg', base64: dataUrl.split(',')[1]! }, previewUrl: dataUrl };
}
