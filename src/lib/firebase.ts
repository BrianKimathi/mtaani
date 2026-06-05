import '../loadEnv.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { serviceAccountFromEnv } from './serviceAccountFromEnv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const RTDB_ROOT = process.env.FIREBASE_RTD_ROOT ?? 'bekye_swap';
export const STORAGE_ROOT = process.env.FIREBASE_STORAGE_ROOT ?? 'bekye_swap';

function parseServiceAccountJson(raw: string): admin.ServiceAccount {
  const trimmed = raw.trim();
  const json =
    trimmed.startsWith('{') ? trimmed : Buffer.from(trimmed, 'base64').toString('utf8');
  return JSON.parse(json) as admin.ServiceAccount;
}

function resolveServiceAccountPath(): string | undefined {
  if (process.env.VERCEL) return undefined;

  const configured = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }

  const candidates = [
    path.resolve(process.cwd(), 'service.json'),
    path.resolve(process.cwd(), 'backend/service.json'),
    path.resolve(__dirname, '../../../service.json'),
  ];
  return candidates.find((p) => {
    try {
      readFileSync(p);
      return true;
    } catch {
      return false;
    }
  });
}

function loadServiceAccount(): admin.ServiceAccount {
  // 1) Individual key/value env vars (preferred for Vercel)
  const fromKeys = serviceAccountFromEnv();
  if (fromKeys) return fromKeys;

  // 2) Single-line JSON (optional)
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (fromEnv) {
    try {
      return parseServiceAccountJson(fromEnv);
    } catch (e) {
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT_JSON is invalid: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  // 3) Local file only (not on Vercel)
  const filePath = resolveServiceAccountPath();
  if (filePath) {
    try {
      return JSON.parse(readFileSync(filePath, 'utf8')) as admin.ServiceAccount;
    } catch (e) {
      throw new Error(
        `Could not read service account file (${filePath}): ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  throw new Error(
    'Firebase credentials missing. Set FIREBASE_SA_PROJECT_ID, FIREBASE_SA_CLIENT_EMAIL, FIREBASE_SA_PRIVATE_KEY (and related FIREBASE_SA_* vars) in Vercel/env. Run: npm run env:sync-sa'
  );
}

function initApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.app();

  const serviceAccount = loadServiceAccount();
  const projectId =
    process.env.FIREBASE_PROJECT_ID ??
    serviceAccount.projectId ??
    (serviceAccount as admin.ServiceAccount & { project_id?: string }).project_id ??
    'kile-kitabu';

  const databaseURL =
    process.env.FIREBASE_DATABASE_URL ??
    `https://${projectId}-default-rtdb.firebaseio.com`;

  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ?? `${projectId}.appspot.com`;

  return admin.initializeApp({
    projectId,
    databaseURL,
    storageBucket,
    credential: admin.credential.cert(serviceAccount),
  });
}

export const firebaseApp = initApp();
export const rtdb = admin.database();
export const storageBucket = admin.storage().bucket();

export function rtdbRef(subpath = ''): admin.database.Reference {
  const base = subpath ? `${RTDB_ROOT}/${subpath}` : RTDB_ROOT;
  return rtdb.ref(base);
}
