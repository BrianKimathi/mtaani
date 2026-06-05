export const FULL_SWAP_PRICE = 550;
export const PRICE_PER_PERCENT = 5.5;
export const COMPANY_RATE = 0.6;
export const STATION_RATE = 0.4;
export const MIN_INCOMING_PCT = 1;
export const MAX_PCT = 100;

export interface SwapAmounts {
  netPercent: number;
  totalCharged: number;
  companyShare: number;
  stationShare: number;
}

export function calculateSwapAmounts(
  incomingPct: number,
  outgoingPct: number
): SwapAmounts {
  const netPercent = Math.max(0, Math.min(100, outgoingPct - incomingPct));
  const totalCharged = round2(netPercent * PRICE_PER_PERCENT);
  const companyShare = round2(totalCharged * COMPANY_RATE);
  const stationShare = round2(totalCharged * STATION_RATE);
  return { netPercent, totalCharged, companyShare, stationShare };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function validateSwapInput(
  incomingPct: number,
  outgoingPct: number
): string | null {
  if (incomingPct < MIN_INCOMING_PCT) {
    return `Incoming battery must be at least ${MIN_INCOMING_PCT}% (vehicle must have power while riding in).`;
  }
  if (incomingPct > MAX_PCT || outgoingPct > MAX_PCT) {
    return 'Battery percentage cannot exceed 100%.';
  }
  if (outgoingPct <= incomingPct) {
    return 'Outgoing charge level must be higher than incoming level.';
  }
  return null;
}
