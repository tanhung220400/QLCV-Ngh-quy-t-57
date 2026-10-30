// Mọi ngày giờ hiển thị và tính toán theo giờ Việt Nam (UTC+7, không đổi giờ mùa hè).
export const TZ = "Asia/Ho_Chi_Minh";
const OFFSET_MS = 7 * 3600 * 1000;

/** 'YYYY-MM-DD' theo giờ VN */
export function vnDate(d: Date | string | number = new Date()): string {
  const t = new Date(d).getTime() + OFFSET_MS;
  return new Date(t).toISOString().slice(0, 10);
}

/** Giờ phút theo VN 'HH:mm' */
export function vnTime(d: Date | string | number): string {
  const t = new Date(d).getTime() + OFFSET_MS;
  return new Date(t).toISOString().slice(11, 16);
}

/** Tạo Date từ ngày 'YYYY-MM-DD' và giờ 'HH:mm' theo giờ VN */
export function fromVN(date: string, time = "23:59"): Date {
  return new Date(`${date}T${time}:00+07:00`);
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const s = vnDate(d);
  return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "";
  return `${vnTime(d)} ${fmtDate(d)}`;
}

export function fmtDue(han: Date | string, coGio: boolean): string {
  return coGio ? fmtDateTime(han) : fmtDate(han);
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekday(date: string): number {
  return new Date(date + "T00:00:00Z").getUTCDay(); // 0 = CN
}

export function isWorkingDay(date: string, holidays: Set<string>): boolean {
  const w = weekday(date);
  return w !== 0 && w !== 6 && !holidays.has(date);
}

/**
 * Số ngày làm việc còn lại từ hôm nay đến hạn (không tính hôm nay, có tính ngày hạn).
 * Âm nếu đã quá hạn (đếm số ngày làm việc đã qua hạn).
 */
export function workingDaysUntil(due: Date | string, holidays: Set<string>, now: Date = new Date()): number {
  const today = vnDate(now);
  const dueDay = vnDate(due);
  if (dueDay === today) return 0;
  let n = 0;
  if (dueDay > today) {
    let d = today;
    while (d < dueDay) {
      d = addDays(d, 1);
      if (isWorkingDay(d, holidays)) n++;
    }
    return n;
  }
  let d = dueDay;
  while (d < today) {
    d = addDays(d, 1);
    if (isWorkingDay(d, holidays)) n--;
  }
  return n;
}

/** Cộng n ngày làm việc vào một ngày */
export function addWorkingDays(date: string, n: number, holidays: Set<string>): string {
  let d = date;
  let left = n;
  while (left > 0) {
    d = addDays(d, 1);
    if (isWorkingDay(d, holidays)) left--;
  }
  return d;
}

export function monthKey(d: Date | string = new Date()): string {
  return vnDate(d).slice(0, 7);
}

export function quarterOf(month: number): number {
  return Math.floor((month - 1) / 3) + 1;
}
