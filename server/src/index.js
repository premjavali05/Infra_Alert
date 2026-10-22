import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { pool, query } from './db.js';
import authRoutes from './routes/auth.js';
import complaintRoutes from './routes/complaints.js';
import locationRoutes from './routes/location.js';
import { getMediaStorageProvider } from './lib/media.js';

dotenv.config();
const app = express();
const port = Number(process.env.PORT || 4000);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const clientDist = path.resolve(root, 'client/dist');
const uploadDir = path.resolve(here, '../uploads');

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(session({
  name: 'infra.sid',
  secret: process.env.SESSION_SECRET || 'local-development-only-change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 12 }
}));
app.use('/uploads', express.static(uploadDir, { fallthrough: false, maxAge: '1d' }));

app.get('/api/health', async (_req, res) => {
  try {
    const result = await query('SELECT NOW() AS database_time');
    res.json({ ok: true, database: 'connected', databaseTime: result.rows[0].database_time });
  } catch (err) {
    res.status(503).json({ ok: false, database: 'unavailable', error: 'Cannot connect to PostgreSQL. Check server/.env and make sure PostgreSQL is running.' });
  }
});
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/location', locationRoutes);

// Safe diagnostic endpoint: reports provider selection only, never credentials.
app.get('/api/integrations/status', (_req, res) => {
  const provider = String(process.env.GEOCODING_PROVIDER || '').toLowerCase()
    || (process.env.LOCATIONIQ_API_KEY ? 'locationiq' : process.env.GEOCODING_API_KEY ? 'gomaps' : 'nominatim');
  res.json({
    imageStorage: getMediaStorageProvider(),
    geocoding: provider,
    cloudinaryConfigured: getMediaStorageProvider() === 'cloudinary',
    reverseGeocodingConfigured: provider === 'nominatim'
      || (provider === 'gomaps' && Boolean(process.env.GEOCODING_API_KEY))
      || (provider === 'locationiq' && Boolean(process.env.LOCATIONIQ_API_KEY)),
    directionsConfigured: Boolean(process.env.LOCATIONIQ_API_KEY)
  });
});

// Serve the Vite build in production; in development Vite serves the client on port 5173.
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => err && next(err));
});

app.use((err, _req, res, _next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'The upload exceeds the 8 MB file-size limit.' });
  if (err?.code === 'CLOUDINARY_UPLOAD_FAILED') return res.status(502).json({ error: err.message });
  if (err?.message?.startsWith('Upload a JPG')) return res.status(400).json({ error: err.message });
  if (err?.code === '23505') return res.status(409).json({ error: 'That identifier already exists.' });
  console.error('[api]', err?.stack || err);
  if (res.headersSent) return;
  const databaseUnavailable = ['ECONNREFUSED', 'ENOTFOUND', '28P01', '3D000'].includes(err?.code);
  res.status(databaseUnavailable ? 503 : 500).json({
    error: databaseUnavailable ? 'PostgreSQL connection failed. Check your DATABASE_URL and make sure the database exists.' : 'Something went wrong. Check the server terminal for details.'
  });
});

// Small additive migration for existing local installations. This preserves existing
// rows and lets reports store the browser's estimated GPS accuracy for new complaints.
try {
  await query('ALTER TABLE save_location ADD COLUMN IF NOT EXISTS accuracy_m NUMERIC(8, 2)');
  console.log('[db] Location accuracy column is ready.');
} catch (error) {
  console.warn('[db] Could not add the optional location accuracy column:', error.message);
}

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Infra-Alert API: http://127.0.0.1:${port}`);
  console.log(`Health check:    http://127.0.0.1:${port}/api/health`);
});

async function shutdown() {
  server.close(() => {});
  await pool.end().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
