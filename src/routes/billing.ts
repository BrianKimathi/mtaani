import { Router } from 'express';
import { z } from 'zod';
import {
  getSystemSetting,
  listOrganizationsWithStats,
  countSwaps,
  upsertBill,
  listBills,
  getBill,
  updateBill
} from '../lib/db.js';
import { authMiddleware, requireOwner } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// Generate bills (Admin only)
router.post('/generate', async (req, res) => {
  if (req.user?.role !== 'SYSTEM_ADMIN') {
    res.status(403).json({ error: 'System Admin access required' });
    return;
  }
  
  try {
    const { month, year } = z.object({
      month: z.number().min(1).max(12),
      year: z.number().min(2020),
    }).parse(req.body);

    const systemSetting = await getSystemSetting('CHARGE_PER_SWAP');
    const chargePerSwap = systemSetting ? Number(systemSetting.value) : 5;

    // Get all orgs
    const orgs = await listOrganizationsWithStats();
    let generated = 0;

    for (const org of orgs) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1); // first day of next month

      const swapCount = await countSwaps({
        organizationId: org.id,
        swappedAtGte: startDate,
        swappedAtLte: endDate,
      });

      if (swapCount > 0) {
        const amount = swapCount * chargePerSwap;
        
        // due date is 5th of next month
        const dueDate = new Date(year, month, 5).toISOString();

        await upsertBill(org.id, month, year, {
          swapCount,
          amount,
          dueDate,
        });
        generated++;
      }
    }

    res.json({ message: `Successfully generated ${generated} bills for ${month}/${year}` });
  } catch (error) {
    res.status(400).json({ error: 'Failed to generate bills' });
  }
});

// List bills
router.get('/', async (req, res) => {
  try {
    const isAdmin = req.user?.role === 'SYSTEM_ADMIN';
    const queryOrgId = typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
    const orgId = isAdmin ? queryOrgId : req.user?.organizationId ?? undefined;

    if (!isAdmin && req.user?.role !== 'OWNER') {
      res.status(403).json({ error: 'Owner access required' });
      return;
    }

    const bills = await listBills({ organizationId: orgId });
    res.json({ bills });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
});

// Pay a bill
router.post('/:id/pay', requireOwner, async (req, res) => {
  try {
    const { mpesaPhone } = z.object({ mpesaPhone: z.string().min(10) }).parse(req.body);
    
    const bill = await getBill(req.params.id as string);
    if (!bill || bill.organizationId !== req.user?.organizationId) {
      res.status(404).json({ error: 'Bill not found' });
      return;
    }

    if (bill.status === 'PAID') {
      res.status(400).json({ error: 'Bill is already paid' });
      return;
    }

    // MOCK MPESA PAYMENT - In real life, trigger STK Push, wait for callback
    const receipt = 'MP' + Math.random().toString(36).substring(2, 10).toUpperCase();

    const updated = await updateBill(bill.id, {
      status: 'PAID',
      paidAt: new Date().toISOString(),
      mpesaReceipt: receipt,
    });

    res.json({ message: 'Payment successful', bill: updated });
  } catch (error) {
    res.status(400).json({ error: 'Failed to process payment' });
  }
});

export default router;
