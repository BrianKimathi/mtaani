import { emailExists } from './db.js';

/** Emails are globally unique — one account per address across all businesses */
export async function assertEmailAvailable(
  email: string,
  context: 'register' | 'employee'
): Promise<{ ok: true } | { ok: false; message: string }> {
  const exists = await emailExists(email);
  if (!exists) return { ok: true };

  if (context === 'register') {
    return {
      ok: false,
      message:
        'This email is already registered. Sign in or use a different email to register a new business.',
    };
  }

  return {
    ok: false,
    message: `This email is already in use on the platform (registered to another business or staff account). Each employee must have a unique email — try jane.westlands@company.com instead of a shared address.`,
  };
}
