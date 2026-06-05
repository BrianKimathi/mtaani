import path from 'path';
import { randomBytes } from 'crypto';
import { storageBucket, STORAGE_ROOT } from './firebase.js';

export async function uploadSwapImage(
  buffer: Buffer,
  mimetype: string,
  originalName: string
): Promise<{ imageUrl: string; filename: string; storagePath: string }> {
  const ext = path.extname(originalName) || '.jpg';
  const filename = `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`;
  // Isolated folder — does not touch other app files in the bucket
  const storagePath = `${STORAGE_ROOT}/swaps/${filename}`;
  const file = storageBucket.file(storagePath);

  await file.save(buffer, {
    metadata: {
      contentType: mimetype,
      cacheControl: 'public, max-age=31536000',
    },
    resumable: false,
  });

  await file.makePublic();

  const imageUrl = `https://storage.googleapis.com/${storageBucket.name}/${encodeURI(storagePath)}`;
  return { imageUrl, filename, storagePath };
}

export function uploadsUrl(filename: string): string {
  if (filename.startsWith('http')) return filename;
  const base = process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
  return `${base}/uploads/${filename}`;
}
