import { Router } from 'express';
import { countActivities, listActivities, listEmployeesWithStats } from '../lib/db.js';
import { authMiddleware, requireOwner } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware, requireOwner);

router.get('/', async (req, res) => {
  const { substationId, userId, limit = '50', page = '1' } = req.query;
  const take = Math.min(100, parseInt(limit as string, 10));
  const skip = (Math.max(1, parseInt(page as string, 10)) - 1) * take;

  const [activities, total] = await Promise.all([
    listActivities(
      req.user!.organizationId,
      {
        ...(typeof substationId === 'string' && { substationId }),
        ...(typeof userId === 'string' && { userId }),
      },
      { skip, take }
    ),
    countActivities(req.user!.organizationId, {
      ...(typeof substationId === 'string' && { substationId }),
      ...(typeof userId === 'string' && { userId }),
    }),
  ]);

  res.json({ activities, total, page: Number(page), pages: Math.ceil(total / take) });
});

router.get('/staff-summary', async (req, res) => {
  const [employees, recentByStaff] = await Promise.all([
    listEmployeesWithStats(req.user!.organizationId),
    listActivities(req.user!.organizationId, { employeeRole: true }, { take: 20 }),
  ]);
  res.json({ employees, recentByStaff });
});

export default router;
