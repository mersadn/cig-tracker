/* ---------------------------------------------------------------------
 * سیگارشمار - app logic
 * ------------------------------------------------------------------- */

const PER_PACK = 20;

const els = {
  stockNumber: document.getElementById('stockNumber'),
  packTicks: document.getElementById('packTicks'),
  statsBody: document.getElementById('statsBody'),
  statsEmpty: document.getElementById('statsEmpty'),
  statsToggleBtn: document.getElementById('statsToggleBtn'),
  historyList: document.getElementById('historyList'),
  historyEmpty: document.getElementById('historyEmpty'),
  storageBadge: document.getElementById('storageBadge'),
  modalBackdrop: document.getElementById('modalBackdrop'),
  modalTitle: document.getElementById('modalTitle'),
  modalBody: document.getElementById('modalBody'),
  modalActions: document.getElementById('modalActions'),
  toast: document.getElementById('toast'),
};

let entries = [];
let statsExpanded = false;
const STATS_DEFAULT_LIMIT = 10;

/* ---------- helpers ---------- */

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => els.toast.classList.remove('show'), 1800);
}

function fmtToman(n) {
  const s = Math.round(n).toLocaleString('en-US');
  return Jalali.toPersianDigits(s) + ' تومان';
}

function pd(n) { return Jalali.toPersianDigits(n); }

function closeModal() {
  els.modalBackdrop.classList.remove('open');
  els.modalBody.innerHTML = '';
  els.modalActions.innerHTML = '';
}

function openModal(title, bodyHtml, buttons) {
  els.modalTitle.textContent = title;
  els.modalBody.innerHTML = bodyHtml;
  els.modalActions.innerHTML = '';
  buttons.forEach((b) => {
    const btn = document.createElement('button');
    btn.className = 'btn ' + (b.cls || 'secondary');
    btn.textContent = b.label;
    btn.addEventListener('click', b.onClick);
    els.modalActions.appendChild(btn);
  });
  els.modalBackdrop.classList.add('open');
}

els.modalBackdrop.addEventListener('click', (e) => {
  if (e.target === els.modalBackdrop) closeModal();
});

/* ---------- data ---------- */

async function loadEntries() {
  entries = await DB.getAllEntries();
}

function computeStock() {
  let stock = 0;
  for (const e of entries) {
    if (e.type === 'purchase') stock += e.qty;
    else if (e.type === 'smoke' || e.type === 'lend') stock -= e.qty;
  }
  return stock;
}

async function recordEntry(type, extra = {}) {
  const now = new Date();
  const entry = {
    type,
    qty: type === 'purchase' ? PER_PACK : 1,
    timestamp: now.getTime(),
    dayKey: Jalali.dayKey(now),
    ...extra,
  };
  await DB.addEntry(entry);
  await loadEntries();
  renderAll();
}

/* ---------- rendering ---------- */

function renderStock() {
  const stock = computeStock();
  els.stockNumber.textContent = pd(Math.max(stock, 0));
  if (stock < 0) {
    els.stockNumber.textContent = pd(stock);
  }

  els.packTicks.innerHTML = '';
  const filled = Math.max(0, Math.min(PER_PACK, stock));
  for (let i = 0; i < PER_PACK; i += 1) {
    const t = document.createElement('div');
    t.className = 'tick' + (i < filled ? ' filled' : '');
    els.packTicks.appendChild(t);
  }
}

const TYPE_LABEL = {
  purchase: 'خرید پاکت',
  smoke: 'یک نخ کشیدم',
  borrow_smoke: 'نخ قرضی کشیدم',
  lend: 'قرض دادم',
};
const TYPE_ICON = {
  purchase: '📦',
  smoke: '🔥',
  borrow_smoke: '🤝',
  lend: '🎁',
};

function renderHistory() {
  els.historyList.innerHTML = '';
  els.historyEmpty.style.display = entries.length ? 'none' : 'block';

  entries.slice(0, 60).forEach((e) => {
    const li = document.createElement('li');
    const date = new Date(e.timestamp);
    const sub = Jalali.formatDateTime(date) + (e.price ? ' • ' + fmtToman(e.price) : '');
    li.innerHTML = `
      <div class="h-icon">${TYPE_ICON[e.type] || '•'}</div>
      <div class="h-body">
        <div class="h-title">${TYPE_LABEL[e.type] || e.type}</div>
        <div class="h-sub">${sub}</div>
      </div>
      <button class="h-edit" title="ویرایش" aria-label="ویرایش">✏️</button>
      <button class="h-del" title="حذف" aria-label="حذف">✕</button>
    `;
    li.querySelector('.h-edit').addEventListener('click', () => openEditModal(e));
    li.querySelector('.h-del').addEventListener('click', () => confirmDelete(e.id));
    els.historyList.appendChild(li);
  });
}

function confirmDelete(id) {
  openModal('حذف رویداد', '<p>این رویداد حذف شود؟ موجودی سیگار بر همین اساس دوباره محاسبه می‌شود.</p>', [
    { label: 'انصراف', cls: 'secondary', onClick: closeModal },
    {
      label: 'حذف شود',
      cls: 'danger',
      onClick: async () => {
        await DB.deleteEntry(id);
        await loadEntries();
        renderAll();
        closeModal();
        toast('حذف شد');
      },
    },
  ]);
}

function openEditModal(entry) {
  const date = new Date(entry.timestamp);
  const { jy, jm, jd } = Jalali.fromDate(date);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');

  const typeOptionsHtml = Object.keys(TYPE_LABEL).map((t) => (
    `<option value="${t}" ${t === entry.type ? 'selected' : ''}>${TYPE_LABEL[t]}</option>`
  )).join('');

  const monthOptionsHtml = Jalali.MONTHS.map((m, i) => (
    `<option value="${i + 1}" ${i + 1 === jm ? 'selected' : ''}>${m}</option>`
  )).join('');

  openModal('ویرایش رویداد', `
    <label for="editType">نوع رویداد</label>
    <select id="editType" class="edit-select">${typeOptionsHtml}</select>

    <div id="editPriceWrap" style="display:${entry.type === 'purchase' ? 'block' : 'none'}">
      <label for="editPrice">قیمت پاکت (تومان)</label>
      <input id="editPrice" type="number" inputmode="numeric" value="${entry.price || ''}">
    </div>

    <label>تاریخ (شمسی)</label>
    <div class="edit-date-row">
      <input id="editDay" type="number" min="1" max="31" value="${jd}" placeholder="روز">
      <select id="editMonth" class="edit-select">${monthOptionsHtml}</select>
      <input id="editYear" type="number" value="${jy}" placeholder="سال">
    </div>

    <label for="editTime">ساعت</label>
    <input id="editTime" type="time" value="${hh}:${mm}">
  `, [
    { label: 'انصراف', cls: 'secondary', onClick: closeModal },
    {
      label: 'ذخیره تغییرات',
      cls: 'primary',
      onClick: async () => {
        const type = document.getElementById('editType').value;
        const priceVal = document.getElementById('editPrice').value;
        const day = Number(document.getElementById('editDay').value);
        const month = Number(document.getElementById('editMonth').value);
        const year = Number(document.getElementById('editYear').value);
        const timeVal = document.getElementById('editTime').value || '00:00';
        const [th, tm] = timeVal.split(':').map(Number);

        let newDate;
        try {
          const g = Jalali.toGregorian(year, month, day);
          newDate = new Date(g.gy, g.gm - 1, g.gd, th, tm);
        } catch (err) {
          toast('تاریخ نامعتبر است');
          return;
        }

        const updated = {
          ...entry,
          type,
          qty: type === 'purchase' ? PER_PACK : 1,
          price: type === 'purchase' ? (priceVal ? Number(priceVal) : null) : undefined,
          timestamp: newDate.getTime(),
          dayKey: Jalali.dayKey(newDate),
        };
        if (type !== 'purchase') delete updated.price;

        await DB.updateEntry(updated);
        await loadEntries();
        renderAll();
        closeModal();
        toast('تغییرات ذخیره شد');
      },
    },
  ]);

  document.getElementById('editType').addEventListener('change', (ev) => {
    document.getElementById('editPriceWrap').style.display = ev.target.value === 'purchase' ? 'block' : 'none';
  });
}

function renderStats() {
  const byDay = {};
  for (const e of entries) {
    if (!byDay[e.dayKey]) byDay[e.dayKey] = { smoked: 0, packs: 0, lent: 0, sample: e.timestamp };
    const d = byDay[e.dayKey];
    if (e.type === 'smoke' || e.type === 'borrow_smoke') d.smoked += e.qty;
    else if (e.type === 'purchase') d.packs += 1;
    else if (e.type === 'lend') d.lent += e.qty;
    d.sample = Math.max(d.sample, e.timestamp);
  }

  const days = Object.keys(byDay).map((k) => ({ key: k, ...byDay[k] }));
  days.sort((a, b) => b.sample - a.sample);

  els.statsBody.innerHTML = '';
  els.statsEmpty.style.display = days.length ? 'none' : 'block';

  const displayDays = statsExpanded ? days : days.slice(0, STATS_DEFAULT_LIMIT);

  if (days.length > STATS_DEFAULT_LIMIT) {
    els.statsToggleBtn.style.display = 'block';
    els.statsToggleBtn.textContent = statsExpanded
      ? 'نمایش کمتر'
      : `نمایش همه (${pd(days.length)} روز)`;
  } else {
    els.statsToggleBtn.style.display = 'none';
  }

  let maxKey = null; let minKey = null;
  if (days.length > 1) {
    const smokedDays = days.filter((d) => d.smoked > 0);
    if (smokedDays.length > 1) {
      maxKey = smokedDays.reduce((a, b) => (b.smoked > a.smoked ? b : a)).key;
      minKey = smokedDays.reduce((a, b) => (b.smoked < a.smoked ? b : a)).key;
      if (maxKey === minKey) { maxKey = null; minKey = null; }
    }
  }

  displayDays.forEach((d) => {
    const tr = document.createElement('tr');
    if (d.key === maxKey) tr.className = 'day-max';
    if (d.key === minKey) tr.className = 'day-min';
    const dayLabel = Jalali.formatDateShort(new Date(d.sample));
    let badge = '';
    if (d.key === maxKey) badge = '<span class="badge-max">بیشترین</span>';
    if (d.key === minKey) badge = '<span class="badge-min">کمترین</span>';
    tr.innerHTML = `
      <td>${dayLabel}${badge}</td>
      <td>${pd(d.smoked)}</td>
      <td>${pd(d.packs)}</td>
      <td>${pd(d.lent)}</td>
    `;
    els.statsBody.appendChild(tr);
  });
}

function renderAll() {
  renderStock();
  renderHistory();
  renderStats();
}

els.statsToggleBtn.addEventListener('click', () => {
  statsExpanded = !statsExpanded;
  renderStats();
});

/* ---------- actions ---------- */

function openPurchaseModal() {
  openModal('خرید پاکت سیگار', `
    <p class="muted">با ثبت این مورد، ۲۰ نخ به موجودی شما اضافه می‌شود.</p>
    <label for="priceInput">قیمت پاکت (تومان)</label>
    <input id="priceInput" type="number" inputmode="numeric" placeholder="مثلاً ۱۵۰۰۰۰">
  `, [
    { label: 'انصراف', cls: 'secondary', onClick: closeModal },
    {
      label: 'ثبت خرید',
      cls: 'primary',
      onClick: async () => {
        const val = document.getElementById('priceInput').value;
        const price = val ? Number(val) : null;
        await recordEntry('purchase', { price });
        closeModal();
        toast('پاکت ثبت شد • ۲۰ نخ اضافه شد');
      },
    },
  ]);
  setTimeout(() => document.getElementById('priceInput')?.focus(), 50);
}

async function quickAction(type) {
  const labels = {
    smoke: 'یک نخ سیگار ثبت شد',
    borrow_smoke: 'نخ قرضی ثبت شد',
    lend: 'قرض دادن ثبت شد',
  };
  await recordEntry(type);
  toast(labels[type] || 'ثبت شد');
}

document.querySelectorAll('.action-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    if (action === 'purchase') openPurchaseModal();
    else quickAction(action);
  });
});

/* ---------- backup / restore ---------- */

function backupFileName() {
  const now = new Date();
  const { jy, jm, jd } = Jalali.fromDate(now);
  const pad = (n) => String(n).padStart(2, '0');
  return `sigarshomar-backup-${jy}-${pad(jm)}-${pad(jd)}.json`;
}

async function buildBackupPayload() {
  const [allEntries, allSettings] = await Promise.all([
    DB.getAllEntries(),
    DB.getAllSettings(),
  ]);
  return {
    app: 'cigtrack',
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: allEntries,
    settings: allSettings,
  };
}

async function runBackup() {
  let payload;
  try {
    payload = await buildBackupPayload();
  } catch (err) {
    toast('خطا در آماده‌سازی فایل پشتیبان');
    return;
  }
  const json = JSON.stringify(payload, null, 2);
  const fileName = backupFileName();

  // Prefer the native "save as" picker so the user chooses exactly where
  // the file goes. Falls back to a normal download (which lands in the
  // browser/OS default Downloads location) where the picker isn't supported.
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      toast('فایل پشتیبان ذخیره شد ✔');
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return; // user cancelled the picker
      // fall through to download fallback below
    }
  }

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('فایل پشتیبان در پوشه دانلودها ذخیره شد ✔');
}

function pickRestoreFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || data.app !== 'cigtrack' || !Array.isArray(data.entries)) {
        toast('این فایل، فایل پشتیبان معتبر سیگارشمار نیست');
        return;
      }
      confirmRestore(data);
    } catch (err) {
      toast('خواندن فایل با خطا مواجه شد');
    }
  });
  input.click();
}

function confirmRestore(data) {
  const count = data.entries.length;
  openModal('بازیابی از فایل پشتیبان', `
    <p>این فایل شامل <b>${pd(count)}</b> رویداد است.</p>
    <p class="muted">با ادامه، تمام اطلاعات فعلی برنامه پاک و با اطلاعات این فایل جایگزین می‌شود. این کار قابل بازگشت نیست.</p>
  `, [
    { label: 'انصراف', cls: 'secondary', onClick: closeModal },
    {
      label: 'بازیابی و جایگزینی',
      cls: 'danger',
      onClick: async () => {
        try {
          await DB.restoreAll(data.entries, data.settings || []);
          await loadEntries();
          renderAll();
          closeModal();
          toast('اطلاعات با موفقیت بازیابی شد ✔');
        } catch (err) {
          toast('خطا در بازیابی اطلاعات');
        }
      },
    },
  ]);
}

/* ---------- settings modal ---------- */

document.getElementById('btnSettings').addEventListener('click', async () => {
  const persisted = navigator.storage && navigator.storage.persisted
    ? await navigator.storage.persisted() : false;
  openModal('تنظیمات', `
    <p>وضعیت ذخیره‌سازی دائمی: <b>${persisted ? 'فعال ✅' : 'غیرفعال'}</b></p>
    <p class="muted">تمام اطلاعات به‌صورت محلی روی همین گوشی و در حافظه مرورگر/برنامه ذخیره می‌شود و آفلاین کار می‌کند. رفرش کردن یا بستن برنامه چیزی را پاک نمی‌کند.</p>
    <p class="muted">برای اطمینان کامل (مثلاً پاک شدن کش مرورگر یا تعویض گوشی)، از بخش زیر یک فایل پشتیبان بگیرید و همان را برای بازگردانی اطلاعات استفاده کنید.</p>
  `, [
    { label: 'بستن', cls: 'secondary', onClick: closeModal },
    { label: 'بازیابی از فایل پشتیبان', cls: 'secondary', onClick: pickRestoreFile },
    { label: 'پشتیبان‌گیری (ذخیره فایل)', cls: 'primary', onClick: runBackup },
    {
      label: 'پاک کردن کامل اطلاعات',
      cls: 'danger',
      onClick: () => {
        openModal('پاک کردن کامل اطلاعات', '<p>همه رویدادهای ثبت‌شده برای همیشه حذف می‌شوند. این کار قابل بازگشت نیست.</p>', [
          { label: 'انصراف', cls: 'secondary', onClick: closeModal },
          {
            label: 'بله، همه را پاک کن',
            cls: 'danger',
            onClick: async () => {
              await DB.clearAllEntries();
              await loadEntries();
              renderAll();
              closeModal();
              toast('همه اطلاعات پاک شد');
            },
          },
        ]);
      },
    },
  ]);
});

/* ---------- first run ---------- */

async function maybeShowFirstRun() {
  const done = await DB.getSetting('firstRunDone', false);
  if (done) {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {});
    }
    return;
  }

  openModal('خوش آمدید 👋', `
    <p>این برنامه کاملاً <b>آفلاین</b> است و تمام اطلاعات شما فقط روی همین گوشی، داخل حافظهٔ خودِ برنامه ذخیره می‌شود؛ چیزی به سرور فرستاده نمی‌شود.</p>
    <p>همین یک‌ بار اجازه می‌خواهیم که این حافظه «دائمی» شود تا مرورگر آن را در شرایط کمبود فضا پاک نکند. از دفعهٔ بعد دیگر چیزی پرسیده نمی‌شود و اطلاعات با رفرش کردن از بین نمی‌رود.</p>
  `, [
    {
      label: 'شروع کن',
      cls: 'primary',
      onClick: async () => {
        if (navigator.storage && navigator.storage.persist) {
          try { await navigator.storage.persist(); } catch (e) { /* ignore */ }
        }
        await DB.setSetting('firstRunDone', true);
        closeModal();
        toast('همه‌چیز آماده است ✔');
      },
    },
  ]);
}

/* ---------- service worker ---------- */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

/* ---------- boot ---------- */

(async function init() {
  await loadEntries();
  renderAll();
  await maybeShowFirstRun();
})();
