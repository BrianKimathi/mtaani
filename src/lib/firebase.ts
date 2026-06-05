import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Isolated namespace — never touches users, payments, subscriptions, etc. */
export const RTDB_ROOT = process.env.FIREBASE_RTD_ROOT ?? 'bekye_swap';
export const STORAGE_ROOT = process.env.FIREBASE_STORAGE_ROOT ?? 'bekye_swap';

function resolveServiceAccountPath(): string | undefined {
  const configured = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }
  // Repo root service.json (when running from backend/)
  const candidates = [
    path.resolve(process.cwd(), 'service.json'),
    path.resolve(process.cwd(), '../service.json'),
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

function loadServiceAccount(): admin.ServiceAccount | undefined {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) return JSON.parse(json) as admin.ServiceAccount;

  const filePath = resolveServiceAccountPath();
  if (filePath) return JSON.parse(readFileSync(filePath, 'utf8')) as admin.ServiceAccount;

  return undefined;
}

function initApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.app();

  const serviceAccount = loadServiceAccount();
  const projectId =
    process.env.FIREBASE_PROJECT_ID ??
    (serviceAccount as { project_id?: string } | undefined)?.project_id ??
    'kile-kitabu';

  const databaseURL =
    process.env.FIREBASE_DATABASE_URL ??
    `https://${projectId}-default-rtdb.firebaseio.com`;

  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ?? `${projectId}.appspot.com`;

  const options = { projectId, databaseURL, storageBucket };

  if (serviceAccount) {
    return admin.initializeApp({
      ...options,
      credential: admin.credential.cert(serviceAccount),
    });
  }

  return admin.initializeApp(options);
}

export const firebaseApp = initApp();
export const rtdb = admin.database();
export const storageBucket = admin.storage().bucket();

/** All Bekye data lives under /bekye_swap/ — separate from kile-kitabu app keys */
export function rtdbRef(subpath = ''): admin.database.Reference {
  const base = subpath ? `${RTDB_ROOT}/${subpath}` : RTDB_ROOT;
  return rtdb.ref(base);
}
