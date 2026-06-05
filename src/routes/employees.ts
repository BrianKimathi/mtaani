import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  createEmployee,
  findSubstation,
  getUserById,
  getUserWithRelations,
  listEmployees,
  updateUser,
} from '../lib/db.js';
import { authMiddleware, requireOwner } from '../middleware/auth.js';
import { logActivity } from '../lib/activity.js';
import { assertEmailAvailable } from '../lib/emailUnique.js';

const router = Router();
router.use(authMiddleware, requireOwner);

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  substationId: z.string().optional().nullable(),
});

router.get('/', async (req, res) => {
  const { substationId, unassigned } = req.query;
  const employees = await listEmployees(req.user!.organizationId, {
    ...(typeof substationId === 'string' && { substationId }),
    ...(unassigned === 'true' && { unassigned: true }),
  });
  res.json({ employees });
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { name, email, password, phone, substationId } = parsed.data;

  if (substationId) {
    const substation = await findSubstation(req.user!.organizationId, substationId);
    if (!substation) {
      res.status(404).json({ error: 'Substation not found' });
      return;
    }
  }

  const emailCheck = await assertEmailAvailable(email, 'employee');
  if (!emailCheck.ok) {
    res.status(409).json({ error: emailCheck.message, code: 'EMAIL_TAKEN' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const employee = await createEmployee({
      organizationId: req.user!.organizationId,
      substationId: substationId ?? null,
      name,
      email,
      passwordHash,
      phone,
    });

    await logActivity(req, {
      organizationId: req.user!.organizationId,
      userId: req.user!.userId,
      substationId: substationId ?? null,
      type: 'EMPLOYEE_CREATED',
      description: `Created employee ${name} (${email})`,
      metadata: { employeeId: employee.id, substationId },
    });

    res.status(201).json({
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        substationId: employee.substationId,
        status: employee.status,
      },
      message: substationId
        ? 'Employee created and assigned. Share credentials with them.'
        : 'Employee created without substation. Assign a substation when ready.',
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'EMAIL_TAKEN') {
      res.status(409).json({
        error: 'This email is already registered on the platform. Use a unique email for each employee.',
        code: 'EMAIL_TAKEN',
      });
      return;
    }
    throw e;
  }
});

router.patch('/:id', async (req, res) => {
  const { status, substationId, name, phone } = req.body;
  const before = await getUserById(req.params.id as string);
  if (!before || before.organizationId !== req.user!.organizationId || before.role !== 'EMPLOYEE') {
    res.status(404).json({ error: 'Employee not found' });
    return;
  }

  const patch: Parameters<typeof updateUser>[1] = {};
  if (status) patch.status = status;
  if (name) patch.name = name;
  if (phone !== undefined) patch.phone = phone;

  if (substationId !== undefined) {
    if (substationId === null || substationId === '') {
      patch.substationId = null;
    } else {
      const sub = await findSubstation(req.user!.organizationId, substationId);
      if (!sub) {
        res.status(404).json({ error: 'Substation not found' });
        return;
      }
      patch.substationId = substationId;
    }
  }

  const employee = await updateUser(before.id, patch);
  if (!employee) {
    res.status(404).json({ error: 'Employee not found' });
    return;
  }

  const withSub = await getUserWithRelations(employee.id);

  if (substationId !== undefined && substationId !== before.substationId) {
    await logActivity(req, {
      organizationId: req.user!.organizationId,
      userId: req.user!.userId,
      substationId: employee.substationId,
      type: substationId ? 'EMPLOYEE_ASSIGNED' : 'EMPLOYEE_UNASSIGNED',
      description: substationId
        ? `Assigned ${employee.name} to ${withSub?.substation?.name ?? 'substation'}`
        : `Unassigned ${employee.name} from substation`,
      metadata: { employeeId: employee.id, from: before.substationId, to: employee.substationId },
    });
  }
  if (status && status !== before.status) {
    await logActivity(req, {
      organizationId: req.user!.organizationId,
      userId: req.user!.userId,
      type: 'EMPLOYEE_STATUS_CHANGED',
      description: `Changed ${employee.name} status to ${status}`,
      metadata: { employeeId: employee.id, from: before.status, to: status },
    });
  }

  res.json({ employee: withSub });
});

router.post('/:id/reset-password', async (req, res) => {
  const { password } = req.body as { password?: string };
  if (!password || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }
  const emp = await getUserById(req.params.id as string);
  if (!emp || emp.organizationId !== req.user!.organizationId || emp.role !== 'EMPLOYEE') {
    res.status(404).json({ error: 'Employee not found' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await updateUser(emp.id, { passwordHash });
  await logActivity(req, {
    organizationId: req.user!.organizationId,
    userId: req.user!.userId,
    type: 'EMPLOYEE_PASSWORD_RESET',
    description: `Reset password for ${emp.name}`,
    metadata: { employeeId: emp.id },
  });
  res.json({ message: 'Password updated' });
});

export default router;
