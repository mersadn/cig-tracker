/* ---------------------------------------------------------------------
 * Jalali (Persian / Shamsi) calendar conversion
 * Pure JS port of the standard Borkowski/Pournader algorithm
 * (same algorithm used by the widely-used "jalaali-js" library).
 * Runs fully offline - no external service or font is required.
 * ------------------------------------------------------------------- */

const Jalali = (() => {
  function div(a, b) { return ~~(a / b); }
  function mod(a, b) { return a - ~~(a / b) * b; }

  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
    1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178,
  ];

  function jalCal(jy) {
    const bl = breaks.length;
    const gy = jy + 621;
    let leapJ = -14;
    let jp = breaks[0];
    if (jy < jp || jy >= breaks[bl - 1]) {
      throw new Error('Invalid Jalaali year ' + jy);
    }
    let jump = 0;
    for (let i = 1; i < bl; i += 1) {
      const jm = breaks[i];
      jump = jm - jp;
      if (jy < jm) break;
      leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
      jp = jm;
    }
    let n = jy - jp;
    leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    const march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    let leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
    return { leap, gy, march };
  }

  function g2d(gy, gm, gd) {
    let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
      + div(153 * mod(gm + 9, 12) + 2, 5)
      + gd - 34840408;
    d = d - div(div(gy + div(gm - 8, 6) + 100100, 100) * 3, 4) + 752;
    return d;
  }

  function d2g(jdn) {
    let j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308;
    const gd = div(mod(i, 153), 5) + 1;
    const gm = mod(div(i, 153), 12) + 1;
    const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy, gm, gd };
  }

  function j2d(jy, jm, jd) {
    const r = jalCal(jy);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  }

  function d2j(jdn) {
    const gy = d2g(jdn).gy;
    let jy = gy - 621;
    const r = jalCal(jy);
    const jdn1f = g2d(gy, 3, r.march);
    let k = jdn - jdn1f;
    if (k >= 0) {
      if (k <= 185) {
        return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
      }
      k -= 186;
    } else {
      jy -= 1;
      k += 179;
      if (r.leap === 1) k += 1;
    }
    return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
  }

  function toJalali(gy, gm, gd) {
    return d2j(g2d(gy, gm, gd));
  }

  function toGregorian(jy, jm, jd) {
    return d2g(j2d(jy, jm, jd));
  }

  const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  // indexed by JS Date#getDay() (0 = Sunday ... 6 = Saturday)
  const WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

  const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  function toPersianDigits(input) {
    return String(input).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[d]);
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  // Returns { jy, jm, jd, key } for a given JS Date, key = 'YYYY-MM-DD' (jalali, latin digits, sortable)
  function fromDate(date) {
    const { jy, jm, jd } = toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const key = `${jy}-${pad2(jm)}-${pad2(jd)}`;
    return { jy, jm, jd, key, weekday: WEEKDAYS[date.getDay()] };
  }

  function formatDate(date, { persianDigits = true } = {}) {
    const { jy, jm, jd, weekday } = fromDate(date);
    const s = `${weekday} ${jd} ${MONTHS[jm - 1]} ${jy}`;
    return persianDigits ? toPersianDigits(s) : s;
  }

  function formatDateShort(date, { persianDigits = true } = {}) {
    const { jy, jm, jd } = fromDate(date);
    const s = `${jd} ${MONTHS[jm - 1]} ${jy}`;
    return persianDigits ? toPersianDigits(s) : s;
  }

  function formatTime(date, { persianDigits = true } = {}) {
    const s = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    return persianDigits ? toPersianDigits(s) : s;
  }

  function formatDateTime(date, opts) {
    return `${formatDate(date, opts)} - ساعت ${formatTime(date, opts)}`;
  }

  function dayKey(date) {
    return fromDate(date).key;
  }

  return {
    toJalali, toGregorian, fromDate, formatDate, formatDateShort,
    formatTime, formatDateTime, dayKey, toPersianDigits, MONTHS, WEEKDAYS,
  };
})();
