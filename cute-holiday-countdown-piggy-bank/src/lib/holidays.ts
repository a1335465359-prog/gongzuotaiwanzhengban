/**
 * 2026 年中国大陆法定节假日及调休
 * 数据来源：国务院办公厅 2025-11-04 发布的《2026 年部分节假日安排的通知》
 *
 * holidays: 放假区间 [start, end]（含当日）
 * workdays: 因调休而需要上班的周末（YYYY-MM-DD）
 */
export interface RegionHoliday {
  region: "CN";
  year: number;
  holidays: Holiday[];
  workdays: string[]; // 调休上班日
}

export interface Holiday {
  name: string;
  emoji: string;
  start: string;
  end: string;
  days: number;
}

export const CN_2026: RegionHoliday = {
  region: "CN",
  year: 2026,
  holidays: [
    { name: "元旦", emoji: "🎇", start: "2026-01-01", end: "2026-01-03", days: 3 },
    { name: "春节", emoji: "🧧", start: "2026-02-15", end: "2026-02-23", days: 9 },
    { name: "清明节", emoji: "🌿", start: "2026-04-04", end: "2026-04-06", days: 3 },
    { name: "劳动节", emoji: "🎈", start: "2026-05-01", end: "2026-05-05", days: 5 },
    { name: "端午节", emoji: "🐉", start: "2026-06-19", end: "2026-06-21", days: 3 },
    { name: "中秋节", emoji: "🥮", start: "2026-09-25", end: "2026-09-27", days: 3 },
    { name: "国庆节", emoji: "🏮", start: "2026-10-01", end: "2026-10-07", days: 7 },
  ],
  workdays: [
    "2026-01-04", // 元旦调休
    "2026-02-14", // 春节调休
    "2026-02-28", // 春节调休
    "2026-05-09", // 劳动节调休
    "2026-09-20", // 国庆调休
    "2026-10-10", // 国庆调休
  ],
};

const DAY = 86400000;

export function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** 某天是否是法定假期（含调休周末转工作日前先确认 holiday） */
export function isHoliday(ms: number, region: RegionHoliday = CN_2026): Holiday | null {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  const t = d.getTime();
  for (const h of region.holidays) {
    if (t >= parseDay(h.start) && t <= parseDay(h.end)) return h;
  }
  return null;
}

/** 某天是否是调休上班日（补班） */
export function isMakeupWorkday(ms: number, region: RegionHoliday = CN_2026): boolean {
  return region.workdays.includes(dayKey(ms));
}

export interface DayKind {
  kind: "work" | "holiday" | "rest";
  holiday?: Holiday | null;
  isMakeup?: boolean;
}

/** 判断这一天是否要上班，支持周末 + 调休 + 法定节假日 + 自定义工作日 */
export function dayKind(ms: number, workweek: number[], region: RegionHoliday = CN_2026): DayKind {
  const dow = new Date(ms).getDay();
  const hol = isHoliday(ms, region);
  if (hol) return { kind: "holiday", holiday: hol };
  const makeup = isMakeupWorkday(ms, region);
  if (makeup) return { kind: "work", isMakeup: true };
  if (workweek.includes(dow)) return { kind: "work" };
  return { kind: "rest" };
}

export interface HolidayStatus {
  h: Holiday;
  state: "upcoming" | "active";
  ms: number;
  days: number;
}

export function upcomingHolidays(now: number, count = 4, region: RegionHoliday = CN_2026): HolidayStatus[] {
  const out: HolidayStatus[] = [];
  for (const h of region.holidays) {
    const s = parseDay(h.start);
    const e = parseDay(h.end) + DAY;
    if (now >= e) continue;
    if (now >= s) out.push({ h, state: "active", ms: e - now, days: Math.ceil((e - now) / DAY) });
    else out.push({ h, state: "upcoming", ms: s - now, days: Math.ceil((s - now) / DAY) });
    if (out.length >= count) break;
  }
  return out;
}

export function fmtDay(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}月${d}日`;
}
