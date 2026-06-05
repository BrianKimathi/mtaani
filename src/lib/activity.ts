import type { Request } from 'express';
import type { ActivityType } from './types.js';
import { createActivity } from './db.js';

export async function logActivity(
  req: Request,
  params: {
    organizationId: string;
    userId?: string;
    substationId?: string | null;
    type: ActivityType;
    description: string;
    metadata?: unknown;
  }
) {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    undefined;

  try {
    await createActivity({
      organizationId: params.organizationId,
      userId: params.userId,
      substationId: params.substationId ?? null,
      type: params.type,
      description: params.description,
      metadata: params.metadata ?? undefined,
      ipAddress: ip,
    });
  } catch (e) {
    console.error('Activity log failed:', e);
  }
}
