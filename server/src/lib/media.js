import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
dotenv.config();

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
const cloudConfigured = Boolean(cloudName && apiKey && apiSecret);
const uploadDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');
if (cloudConfigured) {
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
}

export function getMediaStorageProvider() {
  return cloudConfigured ? 'cloudinary' : 'local';
}

export async function storeUpload(file) {
  if (!file) throw new Error('Please select a photo or document to upload.');
  if (cloudConfigured) {
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        resource_type: file.mimetype === 'application/pdf' ? 'raw' : 'image',
        folder: 'infra-alert',
        use_filename: true,
        unique_filename: true
      });
      await fs.unlink(file.path).catch(() => {});
      return result.secure_url;
    } catch (err) {
      // Do not silently claim a cloud upload succeeded when Cloudinary is configured.
      // This prevents local-only URLs from being stored while the user expects Cloudinary.
      await fs.unlink(file.path).catch(() => {});
      console.error('[media] Cloudinary upload failed:', err.message);
      const cloudError = new Error('Cloudinary upload failed. Check the Cloudinary credentials in server/.env and try again.');
      cloudError.code = 'CLOUDINARY_UPLOAD_FAILED';
      throw cloudError;
    }
  }
  return `/uploads/${encodeURIComponent(file.filename)}`;
}

export async function removeLocalUpload(file) {
  if (file?.path) await fs.unlink(file.path).catch(() => {});
}


/**
 * Fetches uploaded evidence as bytes suitable for PDFKit.
 * Local uploads are read from the app uploads directory. Cloudinary-hosted images
 * are transformed to JPEG so formats such as WebP/GIF can be included in PDFs.
 * Arbitrary remote hosts are deliberately rejected to avoid SSRF via stored URLs.
 */
export async function loadImageForPdf(mediaUrl) {
  if (!mediaUrl || typeof mediaUrl !== 'string') return null;

  if (mediaUrl.startsWith('/uploads/')) {
    try {
      const parsed = new URL(mediaUrl, 'http://infra-alert.local');
      const pathname = decodeURIComponent(parsed.pathname);
      const fileName = path.basename(pathname);
      if (!fileName || fileName === '.' || fileName === '..') return null;
      const resolvedPath = path.resolve(uploadDir, fileName);
      if (!resolvedPath.startsWith(`${uploadDir}${path.sep}`)) return null;
      const bytes = await fs.readFile(resolvedPath);
      if (bytes.length > 8 * 1024 * 1024) return null;
      return bytes;
    } catch {
      return null;
    }
  }

  let url;
  try { url = new URL(mediaUrl); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return null;
  if (!url.pathname.includes('/image/upload/')) return null;

  // Force a PDFKit-compatible output for uploaded Cloudinary images.
  url.pathname = url.pathname.replace('/image/upload/', '/image/upload/f_jpg,q_auto:good/');
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('image/jpeg') && !contentType.includes('image/png')) return null;
    const length = Number(response.headers.get('content-length') || 0);
    if (length > 8 * 1024 * 1024) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 8 * 1024 * 1024) return null;
    return bytes;
  } catch (error) {
    console.warn('[pdf] Could not retrieve Cloudinary image for PDF:', error.message);
    return null;
  }
}
