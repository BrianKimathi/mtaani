import { Router } from 'express';
import { z } from 'zod';
import {
  aggregateSwaps,
  createSubstation,
  findSubstation,
  getSubstation,
  getSubstationEmployees,
  listActivities,
  listSubstations,
  listSwaps,
  updateSubstation,
} from '../lib/db.js';
import { authMiddleware, requireOwner, resolveSubstationId } from '../middleware/auth.js';
import { logActivity } from '../lib/activity.js';
import { dailySwapSeries } from '../lib/chartData.js';

const router = Router();
router.use(authMiddleware);

const createSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20).regex(/^[A-Za-z0-9_-]+$/),
  location: z.string().optional(),
});

router.get('/', async (req, res) => {
  const orgId = req.user!.organizationId;
  const substations =
    req.user!.role === 'EMPLOYEE' && req.user!.substationId
      ? await listSubstations(orgId, { id: req.user!.substationId })
      : await listSubstations(orgId);
  res.json({ substations });
});

router.post('/', requireOwner, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { name, code, location } = parsed.data;
  try {
    const substation = await createSubstation({
      organizationId: req.user!.organizationId,
      name,
      code,
      location,
    });
    await logActivity(req, {
      organizationId: req.user!.organizationId,
      userId: req.user!.userId,
      substationId: substation.id,
      type: 'SUBSTATION_CREATED',
      description: `Created substation ${name} (${code.toUpperCase()})`,
      metadata: { substationId: substation.id },
    });
    res.status(201).json({ substation });
  } catch (e) {
    if (e instanceof Error && e.message === 'DUPLICATE_CODE') {
      res.status(409).json({ error: 'Substation code already exists' });
      return;
    }
    throw e;
  }
});

router.get('/:id', async (req, res) => {
  const id = req.params.id as string;
  if (req.user!.role === 'EMPLOYEE' && req.user!.substationId !== id) {
    res.status(403).json({ error: 'Access denied to this substation' });
    return;
  }
  const substation = await findSubstation(req.user!.organizationId, id);
  if (!substation) {
    res.status(404).json({ error: 'Substation not found' });
    return;
  }
  const employees = await getSubstationEmployees(id);
  res.json({ substation: { ...substation, employees } });
});

router.patch('/:id', requireOwner, async (req, res) => {
  const { name, location, status } = req.body;
  const updated = await updateSubstation(req.user!.organizationId, req.params.id as string, {
    ...(name && { name }),
    ...(location !== undefined && { location }),
    ...(status && { status }),
  });
  if (!updated) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ substation: updated });
});

router.get('/:id/stats', async (req, res) => {
  const substationId = resolveSubstationId(req, req.params.id as string);
  if (!substationId) {
    res.status(400).json({ error: 'Substation required' });
    return;
  }
  if (req.user!.role === 'EMPLOYEE' && req.user!.substationId !== substationId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [today, week, allTime, substation, employees, recentSwaps, recentActivity, chartDaily] =
    await Promise.all([
      aggregateSwaps({ substationId, swappedAtGte: startOfDay }),
      aggregateSwaps({ substationId, swappedAtGte: weekAgo }),
      aggregateSwaps({ substationId }),
      getSubstation(substationId),
      getSubstationEmployees(substationId),
      listSwaps({ substationId }, { take: 10 }),
      listActivities(req.user!.organizationId, { substationId }, { take: 8 }),
      dailySwapSeries({ substationId }, 7),
    ]);

  res.json({
    substation,
    employeeCount: employees.length,
    employees,
    recentSwaps,
    recentActivity,
    chartDaily,
    today: {
      swaps: today.count,
      revenue: today.totalCharged,
      stationShare: today.stationShare,
      companyShare: today.companyShare,
      energyPercent: today.netPercent,
    },
    week: {
      swaps: week.count,
      revenue: week.totalCharged,
      stationShare: week.stationShare,
    },
    allTime: {
      swaps: allTime.count,
      revenue: allTime.totalCharged,
      stationShare: allTime.stationShare,
    },
  });
});

export default router;
