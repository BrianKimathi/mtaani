import type admin from 'firebase-admin';

/** Build Firebase service account from individual env vars (Vercel key/value). */
export function serviceAccountFromEnv(): admin.ServiceAccount | null {
  const projectId = process.env.FIREBASE_SA_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_SA_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_SA_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    return null;
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

  return {
    projectId,
    privateKey,
    clientEmail,
  } as admin.ServiceAccount;
}

export const FIREBASE_SA_ENV_KEYS = [
  'FIREBASE_SA_TYPE',
  'FIREBASE_SA_PROJECT_ID',
  'FIREBASE_SA_PRIVATE_KEY_ID',
  'FIREBASE_SA_PRIVATE_KEY',
  'FIREBASE_SA_CLIENT_EMAIL',
  'FIREBASE_SA_CLIENT_ID',
  'FIREBASE_SA_AUTH_URI',
  'FIREBASE_SA_TOKEN_URI',
  'FIREBASE_SA_AUTH_PROVIDER_X509_CERT_URL',
  'FIREBASE_SA_CLIENT_X509_CERT_URL',
  'FIREBASE_SA_UNIVERSE_DOMAIN',
] as const;
