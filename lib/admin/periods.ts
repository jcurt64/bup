/**
 * Périodes globales du dashboard admin et helpers d'arithmétique
 * temporelle pour les agrégations.
 *
 * Toutes les fonctions acceptent un `now` injectable pour pouvoir être
 * testées de manière déterministe (sinon `new Date()` rendrait les tests
 * dépendants de l'horloge).
 */

export const PERIOD_KEYS = ["today", "7d", "30d", "quarter", "12m", "all"] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

export type DateRange = { start: Date; end: Date };

const DAY_MS = 86_400_000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function startOfQuarter(d: Date): Date {
  const x = new Date(d);
  const month = x.getUTCMonth();
  const qStart = Math.floor(month / 3) * 3;
  return new Date(Date.UTC(x.getUTCFullYear(), qStart, 1, 0, 0, 0, 0));
}

export function rangeFor(period: PeriodKey, now: Date = new Date()): DateRange {
  switch (period) {
    case "today":
      return { start: startOfDay(now), end: now };
    case "7d":
      return { start: new Date(startOfDay(now).getTime() - 7 * DAY_MS), end: now };
    case "30d":
      return { start: new Date(startOfDay(now).getTime() - 30 * DAY_MS), end: now };
    case "quarter":
      return { start: startOfQuarter(now), end: now };
    case "12m": {
      const x = new Date(now);
      x.setUTCFullYear(x.getUTCFullYear() - 1);
      return { start: startOfDay(x), end: now };
    }
    case "all":
      return { start: new Date(0), end: now };
  }
}

export function previousRangeOf(cur: DateRange): DateRange {
  const span = cur.end.getTime() - cur.start.getTime();
  return { start: new Date(cur.start.getTime() - span), end: new Date(cur.start.getTime()) };
}

export type Bucket = { start: Date; end: Date; label: string };

export function bucketize(range: DateRange): Bucket[] {
  const span = range.end.getTime() - range.start.getTime();
  const days = Math.ceil(span / DAY_MS);

  if (days <= 30) {
    const buckets: Bucket[] = [];
    let cursor = startOfDay(range.start);
    const last = startOfDay(range.end);
    while (cursor.getTime() <= last.getTime()) {
      const next = new Date(cursor.getTime() + DAY_MS);
      buckets.push({
        start: new Date(cursor),
        end: next,
        label: cursor.toISOString().slice(0, 10),
      });
      cursor = next;
    }
    return buckets;
  }

  if (days <= 100) {
    const buckets: Bucket[] = [];
    const cursor = mondayOf(startOfDay(range.start));
    while (cursor.getTime() < range.end.getTime()) {
      const next = new Date(cursor.getTime() + 7 * DAY_MS);
      buckets.push({
        start: new Date(cursor),
        end: new Date(Math.min(next.getTime(), range.end.getTime())),
        label: `W${isoWeek(cursor)}`,
      });
      cursor.setTime(next.getTime());
    }
    return buckets;
  }

  const buckets: Bucket[] = [];
  const cursor = new Date(
    Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth(), 1),
  );
  const lastMonth = new Date(
    Date.UTC(range.end.getUTCFullYear(), range.end.getUTCMonth(), 1),
  );
  while (cursor.getTime() <= lastMonth.getTime()) {
    const next = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
    );
    buckets.push({
      start: new Date(cursor),
      end: next,
      label: `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`,
    });
    cursor.setTime(next.getTime());
  }
  return buckets;
}

function mondayOf(d: Date): Date {
  const x = new Date(d);
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() - (day - 1));
  return startOfDay(x);
}

function isoWeek(d: Date): number {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / (7 * DAY_MS));
}
