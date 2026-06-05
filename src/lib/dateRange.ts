export function parseDateRange(query: Record<string, unknown>) {
  const fromStr = query.from as string | undefined;
  const toStr = query.to as string | undefined;

  if (fromStr) {
    const from = new Date(fromStr);
    if (isNaN(from.getTime())) {
      throw new Error('Invalid start date');
    }
    from.setHours(0, 0, 0, 0);

    let to: Date;
    let label: string;

    if (toStr) {
      to = new Date(toStr);
      if (isNaN(to.getTime())) {
        throw new Error('Invalid end date');
      }
      to.setHours(23, 59, 59, 999);
      if (fromStr === toStr) {
        label = from.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });
      } else {
        label = `${from.toLocaleDateString('en-KE')} — ${to.toLocaleDateString('en-KE')}`;
      }
    } else {
      to = new Date(from);
      to.setHours(23, 59, 59, 999);
      label = from.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    return { from, to, label };
  }

  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  return { from, to, label: 'Today' };
}

export function todayIsoDate(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
