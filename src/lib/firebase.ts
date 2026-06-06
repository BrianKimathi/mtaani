import '../loadEnv.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { serviceAccountFromEnv } from './serviceAccountFromEnv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const RTDB_ROOT = process.env.FIREBASE_RTD_ROOT ?? 'bekye_swap';
export const STORAGE_ROOT = process.env.FIREBASE_STORAGE_ROOT ?? 'bekye_swap';

let initialized = false;

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
  const fromKeys = serviceAccountFromEnv();
  if (fromKeys) return fromKeys;

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
    'Firebase credentials missing. On Vercel set FIREBASE_SA_PROJECT_ID, FIREBASE_SA_CLIENT_EMAIL, FIREBASE_SA_PRIVATE_KEY (run: npm run env:sync-sa locally).'
  );
}

function ensureInit(): void {
  if (initialized) return;

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

  admin.initializeApp({
    projectId,
    databaseURL,
    storageBucket,
    credential: admin.credential.cert(serviceAccount),
  });

  initialized = true;
}

export function getRtdb(): admin.database.Database {
  ensureInit();
  return admin.database();
}

export function getStorageBucket() {
  ensureInit();
  return admin.storage().bucket();
}

export function rtdbRef(subpath = ''): admin.database.Reference {
  const base = subpath ? `${RTDB_ROOT}/${subpath}` : RTDB_ROOT;
  return getRtdb().ref(base);
}

/** Lets mobile sign into Firebase Auth after backend login (RTDB access). */
export async function createFirebaseCustomToken(uid: string): Promise<string> {
  ensureInit();
  return admin.auth().createCustomToken(uid);
}
