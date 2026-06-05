import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import {
  countSwaps,
  createSwap,
  findSubstation,
  getSwap,
  listSwaps,
  upsertBattery,
  upsertVehicle,
} from '../lib/db.js';
import { authMiddleware, resolveSubstationId } from '../middleware/auth.js';
import { calculateSwapAmounts, validateSwapInput } from '../lib/swapMath.js';
import { analyzeBatteryImage } from '../lib/ocr.js';
import { uploadSwapImage } from '../lib/storage.js';
import { logActivity } from '../lib/activity.js';

const router = Router();
router.use(authMiddleware);

const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only images allowed'));
      return;
    }
    cb(null, true);
  },
});

const diskUpload = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, `${unique}${path.extname(file.originalname) || '.jpg'}`);
  },
});
const localUpload = multer({
  storage: diskUpload,
  limits: { fileSize: 8 * 1024 * 1024 },
});

/** Fast upload → Firebase Storage */
router.post('/upload', memoryUpload.single('image'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Image required' });
    return;
  }
  try {
    const { imageUrl, filename } = await uploadSwapImage(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );
    res.json({ imageUrl, filename });
  } catch (e) {
    console.error('Storage upload failed:', e);
    res.status(500).json({ error: 'Image upload failed' });
  }
});

router.post('/analyze-image', localUpload.single('image'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Image required' });
    return;
  }
  const mode = (req.body.mode as string) === 'outgoing' ? 'outgoing' : 'incoming';
  try {
    const result = await analyzeBatteryImage(req.file.path, mode);
    const buffer = fs.readFileSync(req.file.path);
    const uploaded = await uploadSwapImage(buffer, req.file.mimetype, req.file.originalname);
    fs.unlink(req.file.path, () => {});
    res.json({
      ...result,
      imageUrl: uploaded.imageUrl,
      filename: uploaded.filename,
    });
  } catch (e) {
    res.status(500).json({ error: 'OCR failed', details: String(e) });
  }
});

const swapSchema = z.object({
  substationId: z.string().optional(),
  tukTukReg: z.string().min(3).max(20),
  incomingBarcode: z.string().min(3),
  incomingPct: z.coerce.number().int(),
  outgoingBarcode: z.string().min(3),
  outgoingPct: z.coerce.number().int(),
  incomingImageUrl: z.string().optional(),
  outgoingImageUrl: z.string().optional(),
  plateNumber: z.string().optional(),
  ocrIncoming: z.any().optional(),
  ocrOutgoing: z.any().optional(),
  notes: z.string().optional(),
});

router.post('/', async (req, res) => {
  const parsed = swapSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;
  const substationId = resolveSubstationId(req, data.substationId);
  if (!substationId) {
    res.status(400).json({ error: 'Substation is required' });
    return;
  }

  const substation = await findSubstation(req.user!.organizationId, substationId);
  if (!substation || substation.status !== 'ACTIVE') {
    res.status(404).json({ error: 'Substation not found or inactive' });
    return;
  }

  const validationError = validateSwapInput(data.incomingPct, data.outgoingPct);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const amounts = calculateSwapAmounts(data.incomingPct, data.outgoingPct);
  const reg = data.tukTukReg.toUpperCase().replace(/\s+/g, ' ').trim();

  const vehicle = await upsertVehicle(reg);
  await Promise.all([upsertBattery(data.incomingBarcode), upsertBattery(data.outgoingBarcode)]);

  const swap = await createSwap({
    organizationId: req.user!.organizationId,
    substationId,
    employeeId: req.user!.userId,
    vehicleId: vehicle.id,
    tukTukReg: reg,
    incomingBarcode: data.incomingBarcode.toUpperCase(),
    incomingPct: data.incomingPct,
    outgoingBarcode: data.outgoingBarcode.toUpperCase(),
    outgoingPct: data.outgoingPct,
    netPercent: amounts.netPercent,
    totalCharged: amounts.totalCharged,
    companyShare: amounts.companyShare,
    stationShare: amounts.stationShare,
    incomingImageUrl: data.incomingImageUrl,
    outgoingImageUrl: data.outgoingImageUrl,
    plateNumber: data.plateNumber?.toUpperCase(),
    ocrIncoming: data.ocrIncoming ?? undefined,
    ocrOutgoing: data.ocrOutgoing ?? undefined,
    notes: data.notes,
    swappedAt: new Date().toISOString(),
  });

  const enriched = await getSwap(swap.id, req.user!.organizationId);

  await logActivity(req, {
    organizationId: req.user!.organizationId,
    userId: req.user!.userId,
    substationId,
    type: 'SWAP_CREATED',
    description: `Swap recorded: ${reg} — ${formatKes(amounts.totalCharged)}`,
    metadata: {
      swapId: swap.id,
      tukTukReg: reg,
      totalCharged: amounts.totalCharged,
      performedBy: req.user!.name,
      role: req.user!.role,
    },
  });

  res.status(201).json({ swap: enriched });
});

function formatKes(n: number) {
  return `KES ${n.toFixed(2)}`;
}

router.get('/', async (req, res) => {
  const { substationId, from, to, page = '1', limit = '50' } = req.query;
  const resolvedSub = resolveSubstationId(
    req,
    typeof substationId === 'string' ? substationId : null
  );

  const filters = {
    organizationId: req.user!.organizationId,
    ...(resolvedSub && { substationId: resolvedSub }),
    ...(from && { swappedAtGte: new Date(from as string) }),
    ...(to && { swappedAtLte: new Date(to as string) }),
  };

  const pageNum = Math.max(1, parseInt(page as string, 10));
  const take = Math.min(100, parseInt(limit as string, 10));
  const skip = (pageNum - 1) * take;

  const [swaps, total] = await Promise.all([
    listSwaps(filters, { skip, take }),
    countSwaps(filters),
  ]);

  res.json({ swaps, total, page: pageNum, pages: Math.ceil(total / take) });
});

router.get('/:id', async (req, res) => {
  const substationFilter =
    req.user!.role === 'EMPLOYEE' ? req.user!.substationId : undefined;
  const swap = await getSwap(req.params.id as string, req.user!.organizationId, substationFilter);
  if (!swap) {
    res.status(404).json({ error: 'Swap not found' });
    return;
  }
  res.json({ swap });
});

export default router;
