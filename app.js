/* Berry List — personal to-do + notes. Data lives in localStorage, optional GitHub Gist sync. */
(() => {
'use strict';

/* ---------------- constants ---------------- */
const KEY = 'berrylist:v1';
const SYNC_KEY = 'berrylist:sync';
const GIST_FILE = 'berry-list.json';
const DEF_CLASSES = ['MISC','CLUBS','work/intern','INFO 360','INFO 280','G H 101 A','INFO 201','UW'];
const DEF_TYPES = ['Homework','Discussion','Pre-Lecture Work','Project','Paper','Study','Quiz','Exam','Midterm','Final','Presentation','APPLICATION','other'];
const HOT_TYPES = ['Quiz','Exam','Midterm','Final'];
const STATUSES = [
  { k:'todo-finish', label:'TO FINISH (submitted tho)', g:'To-do' },
  { k:'cancelled',   label:'CANCELLED',                 g:'To-do' },
  { k:'not-started', label:'Not started',               g:'To-do' },
  { k:'stuck',       label:'STUCK',                     g:'In progress' },
  { k:'in-progress', label:'In progress',               g:'In progress' },
  { k:'done',        label:'Done',                      g:'Complete' },
];
const ROLL_STATUSES = ['in-progress','stuck'];
const ST_ORDER = { 'stuck':0,'in-progress':1,'not-started':2,'todo-finish':3,'done':4,'cancelled':5 };
const TEMPLATES = {
  checklist: { label:'Checklist',  hint:'groceries, packing, errands', name:'Groceries',   make:() => ({ items:[] }) },
  free:      { label:'Free write', hint:'thoughts, drafts, quick notes', name:'Thoughts',  make:() => ({ text:'' }) },
  links:     { label:'Links',      hint:'saved pages and resources',    name:'Saved links', make:() => ({ items:[] }) },
  budget:    { label:'Budget',     hint:'items with amounts + a total', name:'Spending',    make:() => ({ items:[] }) },
  recipe:    { label:'Recipe',     hint:'ingredients + steps',          name:'Recipe',      make:() => ({ source:'', ingredients:[], steps:'' }) },
};
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = matchMedia('(hover: none), (pointer: coarse)').matches;

/* ---------------- helpers ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const todayStr = () => ymd(new Date());
const fmtShort = s => { const d = parse(s); return `${MON[d.getMonth()]} ${d.getDate()}`; };
const fmtDay = s => { const d = parse(s); return `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const URL_RE = /https?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:!?)\]]/g;
const stLabel = k => (STATUSES.find(s => s.k === k) || STATUSES[2]).label;
const safeUrl = u => {
  u = (u || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (/^[\w-]+(\.[\w-]+)+/.test(u)) return 'https://' + u;
  return '';
};
const shortUrl = u => {
  try { const x = new URL(u); const p = x.pathname.length > 1 ? x.pathname : ''; return x.hostname.replace(/^www\./, '') + (p.length > 16 ? p.slice(0, 16) + '…' : p); }
  catch { return u; }
};
const tagColor = c => { let h = 0; for (const ch of c || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0; return 'c' + (h % 6); };
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
function linkify(s) {
  s = s || ''; let out = '', last = 0;
  for (const m of s.matchAll(URL_RE)) {
    out += esc(s.slice(last, m.index)) + `<a href="${esc(m[0])}" target="_blank" rel="noopener">${esc(shortUrl(m[0]))}</a>`;
    last = m.index + m[0].length;
  }
  return out + esc(s.slice(last));
}
const findLinks = s => [...new Set((s || '').match(URL_RE) || [])];

/* ---- time helpers (meetings) ---- */
const hm = (h, m) => `${pad(h)}:${pad(m)}`;
const h24 = (h, ap) => ap === 'pm' ? (h % 12) + 12 : ap === 'am' ? (h % 12) : h;
function parseTime(title) {
  const s = title || '';
  const deadline = idx => /\b(due|by|before|until)\s*(at\s*)?$/i.test(s.slice(Math.max(0, idx - 14), idx));
  const fin = (sh, sm, sa, eh, em, ea, match) => {
    if (sh > 12 || eh > 12) { /* already 24h */ }
    else if (sa || ea) {
      let S = sa ? h24(sh, sa) : null, E = ea ? h24(eh, ea) : null;
      if (S === null) { S = h24(sh, ea); if (S * 60 + sm > E * 60 + em) S = h24(sh, ea === 'pm' ? 'am' : 'pm'); }
      if (E === null) { E = h24(eh, sa); if (E * 60 + em <= S * 60 + sm) E += 12; }
      sh = S; eh = E;
    } else {
      sh = ((sh >= 1 && sh <= 7) || sh === 12) ? (sh % 12) + 12 : sh;
      eh = eh % 12; while (eh * 60 + em <= sh * 60 + sm) eh += 12;
    }
    if (eh > 23) eh = 23;
    return { start: hm(sh, sm), end: hm(eh, em), match };
  };
  // 7:30-9:30, 12-1pm, 10am - 11:30am
  for (const m of s.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|—|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?![\d:])/gi)) {
    if (!(m[2] || m[3] || m[5] || m[6])) continue;          // "10-12" alone is not a time
    const sh = +m[1], sm = +(m[2] || 0), eh = +m[4], em = +(m[5] || 0);
    if (sh > 23 || eh > 23 || sm > 59 || em > 59 || deadline(m.index)) continue;
    return fin(sh, sm, m[3] && m[3].toLowerCase(), eh, em, m[6] && m[6].toLowerCase(), m[0]);
  }
  // 800 - 900, 1330-1430
  for (const m of s.matchAll(/(?<![\d:/.-])(\d{3,4})\s*(am|pm)?\s*(?:-|–|—|to)\s*(\d{3,4})\s*(am|pm)?(?![\d:/.-])/gi)) {
    const a = m[1].padStart(4, '0'), b = m[3].padStart(4, '0');
    const sh = +a.slice(0, 2), sm = +a.slice(2), eh = +b.slice(0, 2), em = +b.slice(2);
    if (sh > 23 || eh > 23 || sm > 59 || em > 59 || deadline(m.index)) continue;
    return fin(sh, sm, m[2] && m[2].toLowerCase(), eh, em, m[4] && m[4].toLowerCase(), m[0]);
  }
  // 4:20 pm, 6pm
  const m1 = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (m1 && +m1[1] <= 12 && +(m1[2] || 0) < 60 && !deadline(m1.index)) return { start: hm(h24(+m1[1], m1[3].toLowerCase()), +(m1[2] || 0)), end: '', match: m1[0] };
  // 7:30 (no am/pm)
  const m2 = s.match(/\b(\d{1,2}):(\d{2})\b/);
  if (m2 && +m2[1] <= 23 && +m2[2] < 60 && !deadline(m2.index)) {
    let h = +m2[1]; if (h <= 12 && ((h >= 1 && h <= 7) || h === 12)) h = (h % 12) + 12;
    return { start: hm(h, +m2[2]), end: '', match: m2[0] };
  }
  return null;
}
const ampm = t => { const [h, m] = t.split(':').map(Number); return { n: `${h % 12 || 12}${m ? ':' + pad(m) : ''}`, ap: h >= 12 ? 'pm' : 'am' }; };
const fmtTime = t => { if (!t) return ''; const x = ampm(t); return `${x.n} ${x.ap}`; };
const fmtTimeShort = t => { if (!t) return ''; const x = ampm(t); return x.n + x.ap[0]; };
function timeRange(t) {
  if (!t.start) return 'time tbd';
  const a = ampm(t.start); if (!t.end) return `${a.n} ${a.ap}`;
  const b = ampm(t.end);
  return a.ap === b.ap ? `${a.n} – ${b.n} ${b.ap}` : `${a.n} ${a.ap} – ${b.n} ${b.ap}`;
}
const fmtDur = ms => { const m = Math.max(1, Math.ceil(ms / 60000)); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) + 'm' : ''}`; };
const dayDiff = (a, b) => Math.round((parse(a) - parse(b)) / 864e5);
const covers = (t, k) => !!t.date && (t.date === k || (!!t.endDate && t.date <= k && k <= t.endDate));
function normalizeTasks(list, force) {
  for (const t of list) {
    if (!t.kind || (force && t.kind === 'task' && !t.start)) {
      const p = parseTime(t.title);
      if (p) { t.kind = 'meeting'; t.start = p.start; t.end = p.end; } else t.kind = 'task';
    }
    if (t.start === undefined) t.start = '';
    if (t.end === undefined) t.end = '';
    t.isDue = !!t.isDue;
    t.endDate = (t.kind === 'meeting' || !t.date || !t.endDate || t.endDate <= t.date) ? '' : t.endDate;
  }
}

/* ---------------- state ---------------- */
function defaultLinks() {
  return [
    { k: 'resume',   label: 'Resume',   url: '' },
    { k: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/yue-ge-qu' },
    { k: 'canvas',   label: 'Canvas',   url: 'https://canvas.uw.edu' },
    { k: 'gmail',    label: 'Gmail',    url: 'https://mail.google.com' },
  ];
}
function defaults() {
  return { tasks: [], notes: [], classes: [...DEF_CLASSES], types: [...DEF_TYPES],
    links: defaultLinks(),
    view: innerWidth < 760 ? 'day' : 'month', classFilter: '', hideDone: false, updatedAt: 0 };
}
function load() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY));
    if (r && Array.isArray(r.tasks)) { const o = Object.assign(defaults(), r); normalizeTasks(o.tasks, !o.timeMig); o.timeMig = true; return o; }
  } catch {}
  const s = defaults(); s.tasks = seedTasks(); s.notes = seedNotes(); normalizeTasks(s.tasks); return s;
}
let S = load();
let saveTimer;
function save(silent) {
  S.updatedAt = Date.now();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {}
    if (!silent) schedulePush();
  }, 200);
}
function saveNow() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }

function seedTasks() {
  const T = (title, cls, type, status, date, due, x = {}) => ({ id: uid(), title, link: '', cls, type, status, date, due, notes: '', created: Date.now(), kind: 'task', start: '', end: '', isDue: false, ...x });
  const RED = { isDue: true };
  return [
    // earlier this month
    T('Module 5 Quiz','G H 101 A','Quiz','done','2026-11-01','2026-11-01'),
    T('Global Fund Assignment #5','G H 101 A','Homework','done','2026-11-01','2026-11-01'),
    T('PCT Bake Cookies','CLUBS','','done','2026-11-02',''),
    T('Artifact Presentation Slides','INFO 280','Presentation','done','2026-11-03','2026-11-04', RED),
    T('Reading Reflection 6','INFO 360','Homework','done','2026-11-04','2026-11-02'),
    T('Weekly Review 5: Transforming Data','INFO 201','Homework','done','2026-11-05',''),
    T('Group Project 2: Research','INFO 360','Project','done','2026-11-06','2026-11-06', RED),
    T('Module 6 Quiz','G H 101 A','Quiz','done','2026-11-07','2026-11-08'),
    T('vibecode website for portfolio','','','done','2026-11-07',''),
    // from your Notion table
    T('PCT Financial breakdown','CLUBS','','done','2026-11-08',''),
    T('PCT Active 1-1 emailing (1)','CLUBS','','done','2026-11-08',''),
    T('Big-Little Letters','CLUBS','','done','2026-11-08','', RED),
    T('PCT gr 2 innovation slides','CLUBS','','done','2026-11-08','2026-11-09'),
    T('Reading Reflection 7','INFO 360','','done','2026-11-08','2026-11-09'),
    T('due Introductions & Group Formation + Team Networking Comment','INFO 280','','done','2026-11-08','2026-11-09'),
    T('Costco Appl','work/intern','','not-started','2026-11-08','2026-11-03', RED),
    T('MIDTERM','G H 101 A','Midterm','not-started','2026-11-09','', RED),
    T('7:30-9:30 PCT Pledge QUIZ','CLUBS','','not-started','2026-11-09','', { kind: 'meeting', start: '19:30', end: '21:30' }),
    T('PCT Active 1-1 emailing','CLUBS','','not-started','2026-11-11',''),
    T('12:00-1:00pm PCT 1-1 w April','CLUBS','','not-started','2026-11-13','', { kind: 'meeting', start: '12:00', end: '13:00' }),
    T('STUDY FOR EXAM','INFO 201','','not-started','2026-11-14','', RED),
    T('Exam II','INFO 201','','not-started','2026-11-17','', RED),
    T('Informatics Appointment - In Person','UW','','not-started','2026-11-18','', { kind: 'meeting' }),
    T('4:20 pm INPERSON iSchool Advising','UW','','not-started','2026-11-20','', { kind: 'meeting', start: '16:20', end: '' }),
    T('FINAL','G H 101 A','','not-started','2026-12-07','', RED),
  ];
}
function seedNotes() {
  return [
    { id: uid(), name: 'Groceries', template: 'checklist', collapsed: false, data: { items: [
      { id: uid(), text: 'strawberries', done: false }, { id: uid(), text: 'grapes', done: false }, { id: uid(), text: 'oat milk', done: true } ] } },
    { id: uid(), name: 'Thoughts', template: 'free', collapsed: false, data: { text: '' } },
  ];
}

/* ---------------- rollover: in progress / stuck carry to today ---------------- */
function rollover() {
  const t = todayStr(); let n = 0;
  for (const x of S.tasks) {
    if (ROLL_STATUSES.includes(x.status) && x.kind !== 'meeting' && x.date && x.date < t && !(x.endDate && x.endDate >= t)) {
      x.rolledFrom = x.rolledFrom || x.date;
      x.date = t; x.endDate = ''; x.rolled = (x.rolled || 0) + 1; n++;
    }
  }
  if (n) { save(); toast(`${n} in-progress task${n > 1 ? 's' : ''} carried over to today`); }
  return n;
}
let lastDay = todayStr();
setInterval(() => {
  if (todayStr() !== lastDay) { lastDay = todayStr(); cursor = parse(lastDay); rollover(); renderAll(); }
}, 60000);

/* ---------------- calendar rendering ---------------- */
let cursor = parse(todayStr());
let navDir = 0;
const viewEl = $('#view');

const isMtg = t => t.kind === 'meeting';
const closedSt = s => s === 'done' || s === 'cancelled';
const dueOn = (t, k) => t.isDue && (!t.endDate || !k || t.endDate === k);   // red lands on the last day of a span
const ordKey = (t, k) => closedSt(t.status) ? 20 + ST_ORDER[t.status] : (dueOn(t, k) ? -1 : ST_ORDER[t.status]);
const todoSort = k => (a, b) => ordKey(a, k) - ordKey(b, k) || a.created - b.created;
const mtgSort = (a, b) => (a.start || '99:99').localeCompare(b.start || '99:99') || a.created - b.created;

function visible() {
  return S.tasks.filter(t =>
    (!S.classFilter || t.cls === S.classFilter) &&
    !(S.hideDone && (t.status === 'done' || t.status === 'cancelled')));
}
function byDate(list = visible()) {
  const m = {};
  for (const t of list) {
    (m[t.date || ''] ||= []).push(t);
    if (t.date && t.endDate && t.endDate > t.date && t.kind !== 'meeting') {
      let d = addDays(parse(t.date), 1); const end = parse(t.endDate);
      for (let n = 0; d <= end && n < 120; d = addDays(d, 1), n++) (m[ymd(d)] ||= []).push(t);
    }
  }
  return m;
}
// every day = meetings pinned on top (by time) + to-do list below (red/due first)
function split(list = [], k = '') {
  return { m: list.filter(isMtg).sort(mtgSort), d: list.filter(t => !isMtg(t)).sort(todoSort(k)) };
}
function cleanTitle(t) {
  const raw = t.title || 'Untitled';
  if (!isMtg(t) || !t.start) return raw;
  const p = parseTime(raw); if (!p) return raw;
  const c = raw.replace(p.match, ' ').replace(/^[\s\-–—:,|·]+|[\s\-–—:,|·]+$/g, '').replace(/\s+/g, ' ').trim();
  return c || raw;
}
const linkBtn = t => t.link ? ` <a class="c-link" href="${esc(t.link)}" target="_blank" rel="noopener" title="${esc(host(t.link))}">↗</a>` : '';

/* ---- to-do card ---- */
function card(t, mode, i = 0, day = '') {
  const full = mode !== 'mini';
  const dueNow = dueOn(t, day) && !closedSt(t.status);
  const multi = t.endDate && t.endDate > t.date;
  const sub = [];
  if (multi) sub.push(day ? `day ${dayDiff(day, t.date) + 1} of ${dayDiff(t.endDate, t.date) + 1}` : `${fmtShort(t.date)} → ${fmtShort(t.endDate)}`);
  if (t.due) sub.push('due ' + fmtShort(t.due));
  if (t.rolled && t.status !== 'done') sub.push('↻ carried over');
  const chips = (t.cls ? `<span class="tag ${tagColor(t.cls)}">${esc(t.cls)}</span>` : '') +
    (t.type ? `<span class="type ${HOT_TYPES.includes(t.type) ? 'hot' : ''}">${esc(t.type)}</span>` : '') +
    (full ? `<button class="st-pill" data-status-open="${t.id}" title="Change status">${esc(stLabel(t.status))}</button>` : '');
  return `<article class="card s-${t.status}${dueNow ? ' due' : ''}${multi ? ' span' : ''}" draggable="${!TOUCH}" data-id="${t.id}" style="--i:${i}">
    <button class="dot" data-toggle="${t.id}" aria-label="${esc(stLabel(t.status))}, tap to mark done" title="${esc(stLabel(t.status))}"></button>
    <div class="c-body">
      <div class="c-title">${dueNow ? '<span class="badge-due">DUE</span> ' : ''}${esc(t.title || 'Untitled')}${linkBtn(t)}</div>
      ${chips ? `<div class="c-meta">${chips}</div>` : ''}
      ${sub.length ? `<div class="c-sub">${sub.map(s => `<span>${s}</span>`).join('')}</div>` : ''}
      ${mode === 'day' && t.notes ? `<div class="c-notes">${linkify(t.notes)}</div>` : ''}
    </div>
    <button class="mv" data-move-open="${t.id}" aria-label="Move to another date">move</button>
  </article>`;
}

/* ---- meeting card with countdown bar ---- */
function mtgCard(t, mode, i = 0) {
  const mini = mode === 'mini';
  const time = mini ? (fmtTimeShort(t.start) || '–') : timeRange(t);
  return `<article class="mtg s-${t.status}${mini ? ' mini' : ''}" draggable="${!TOUCH}" data-id="${t.id}" data-mtg="${t.id}" style="--i:${i}">
    <div class="m-top">
      <button class="dot" data-toggle="${t.id}" aria-label="mark attended" title="${esc(stLabel(t.status))}"></button>
      <span class="m-time">${esc(time)}</span>
      <span class="m-title">${esc(cleanTitle(t))}${linkBtn(t)}</span>
      <button class="mv" data-move-open="${t.id}" aria-label="Move to another date">move</button>
    </div>
    <div class="m-bar"><i></i></div>
    <div class="m-sub"></div>
    ${mode === 'day' && t.notes ? `<div class="c-notes">${linkify(t.notes)}</div>` : ''}
  </article>`;
}
function mtgState(t, now = new Date()) {
  const today = todayStr();
  if (!t.date) return { pct: 0, label: '', cls: '' };
  if (t.date > today) {
    const n = Math.round((parse(t.date) - parse(today)) / 864e5);
    return { pct: 0, label: n === 1 ? 'tomorrow' : `in ${n} days`, cls: '' };
  }
  if (t.date < today) return { pct: 100, label: 'past', cls: 'past' };
  if (!t.start) return { pct: 0, label: 'time tbd', cls: '' };
  const d = parse(t.date), at = hmStr => { const [h, m] = hmStr.split(':').map(Number); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m); };
  const st = at(t.start);
  let en = t.end ? at(t.end) : new Date(st.getTime() + 3600000);
  if (en <= st) en = new Date(st.getTime() + 3600000);
  if (now < st) {
    let base = at('07:00'); if (base >= st) base = new Date(st.getTime() - 3600000);
    return { pct: Math.max(0, Math.min(1, (now - base) / (st - base))) * 100, label: `in ${fmtDur(st - now)}`, cls: '' };
  }
  if (now < en) return { pct: (now - st) / (en - st) * 100, label: `happening now · ${fmtDur(en - now)} left`, cls: 'live' };
  return { pct: 100, label: 'ended', cls: 'past' };
}
function updateMtgBars() {
  const now = new Date();
  $$('[data-mtg]').forEach(el => {
    const t = S.tasks.find(x => x.id === el.dataset.mtg); if (!t) return;
    const s = mtgState(t, now);
    $('.m-bar i', el).style.width = s.pct + '%';
    $('.m-sub', el).textContent = s.label;
    el.classList.toggle('live', s.cls === 'live');
    el.classList.toggle('past', s.cls === 'past');
  });
}

/* ---- month ---- */
function renderMonth() {
  const y = cursor.getFullYear(), m = cursor.getMonth();
  const first = new Date(y, m, 1), start = addDays(first, -first.getDay());
  const days = new Date(y, m + 1, 0).getDate();
  const cells = Math.ceil((first.getDay() + days) / 7) * 7;
  const map = byDate(), today = todayStr();
  $('#rangeLabel').innerHTML = `${MONTHS[m]} <em>${y}</em>`;
  let h = `<div class="cal month"><div class="dow">${DOW.map(d => `<div>${d}</div>`).join('')}</div><div class="grid">`;
  for (let i = 0; i < cells; i++) {
    const d = addDays(start, i), k = ymd(d);
    const { m: ms, d: ds } = split(map[k], k);
    h += `<div class="cell ${d.getMonth() !== m ? 'out' : ''} ${k === today ? 'today' : ''}" data-date="${k}">
      <div class="cell-head"><span class="num">${d.getDate() === 1 ? MON[d.getMonth()] + ' ' : ''}${d.getDate()}</span><button class="add" data-add="${k}" aria-label="Add task on ${fmtShort(k)}">+</button></div>
      <div class="stack">${ms.map((t, j) => mtgCard(t, 'mini', j)).join('')}${ms.length && ds.length ? '<div class="sep"></div>' : ''}${ds.map((t, j) => card(t, 'mini', j + ms.length, k)).join('')}</div></div>`;
  }
  viewEl.innerHTML = h + '</div></div>';
}

/* ---- week ---- */
function renderWeek() {
  const start = addDays(cursor, -cursor.getDay()), end = addDays(start, 6);
  const map = byDate(), today = todayStr();
  $('#rangeLabel').innerHTML = start.getMonth() === end.getMonth()
    ? `${MONTHS[start.getMonth()]} ${start.getDate()}–${end.getDate()}`
    : `${MON[start.getMonth()]} ${start.getDate()} – <em>${MON[end.getMonth()]} ${end.getDate()}</em>`;
  let h = '<div class="week">';
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i), k = ymd(d);
    const { m: ms, d: ds } = split(map[k], k);
    const done = ds.filter(t => t.status === 'done').length;
    h += `<div class="wcol ${k === today ? 'today' : ''}" data-date="${k}">
      <div class="whead"><div><div class="d">${DOW[i]}</div><div class="n">${d.getDate()}</div></div><span class="wp">${ds.length ? `${done}/${ds.length}` : ''}</span></div>
      <div class="sec-label first">Meetings</div>
      <div class="stack">${ms.length ? ms.map((t, j) => mtgCard(t, 'week', j)).join('') : '<div class="sec-empty">none</div>'}</div>
      <div class="sec-label">To do</div>
      <div class="stack">${ds.map((t, j) => card(t, 'week', j + ms.length, k)).join('')}</div>
      <div class="wadds"><button class="wadd" data-add="${k}">+ to do</button><button class="wadd" data-add-meeting="${k}">+ meeting</button></div></div>`;
  }
  viewEl.innerHTML = h + '</div>';
}

/* ---- day ---- */
function renderDay() {
  const k = ymd(cursor), list = visible().filter(t => covers(t, k));
  const { m: ms, d: ds } = split(list, k);
  const isToday = k === todayStr();
  $('#rangeLabel').innerHTML = `${isToday ? 'Today' : DAYS[cursor.getDay()]}, <em>${MON[cursor.getMonth()]} ${cursor.getDate()}</em>`;
  const open = ds.filter(t => !closedSt(t.status)).length;
  viewEl.innerHTML = `<div class="day" data-date="${k}">
    <div class="sec-label first">Meetings · ${ms.length}</div>
    <div class="stack">${ms.length ? ms.map((t, j) => mtgCard(t, 'day', j)).join('') : '<div class="sec-empty">no meetings</div>'}</div>
    <div class="sec-label">To do · ${open} left</div>
    <div class="stack">${ds.length ? ds.map((t, j) => card(t, 'day', j + ms.length, k)).join('') : `<div class="empty-day"><svg><use href="#i-berry"/></svg>Nothing on the list. Paste an assignment or add one.</div>`}</div>
    <div class="wadds" style="margin-top:14px"><button class="wadd" data-add="${k}">+ to do</button><button class="wadd" data-add-meeting="${k}">+ meeting</button></div></div>`;
}

/* ---- list ---- */
function renderList() {
  $('#rangeLabel').innerHTML = `All <em>tasks</em>`;
  const list = visible().sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (isMtg(b) - isMtg(a)) || todoSort('')(a, b));
  if (!list.length) { viewEl.innerHTML = '<div class="empty">No tasks yet.</div>'; return; }
  viewEl.innerHTML = `<div class="tablewrap"><table class="table"><thead><tr><th>Status</th><th>Name</th><th>Class</th><th>Type</th><th>Date</th><th>Due by</th><th></th></tr></thead><tbody>
    ${list.map((t, i) => `<tr class="row s-${t.status}" data-id="${t.id}" style="--i:${Math.min(i, 30)}">
      <td><span class="st s-${t.status}"><button class="dot" data-toggle="${t.id}" aria-label="toggle done"></button>${esc(stLabel(t.status))}</span></td>
      <td class="t-name">${t.isDue && !closedSt(t.status) ? '<span class="badge-due">DUE</span> ' : ''}${isMtg(t) ? `<span class="mono">${esc(t.start ? fmtTime(t.start) : 'meeting')}</span> ` : ''}${esc(cleanTitle(t))}${linkBtn(t)}</td>
      <td>${t.cls ? `<span class="tag ${tagColor(t.cls)}">${esc(t.cls)}</span>` : ''}</td>
      <td>${t.type ? `<span class="type ${HOT_TYPES.includes(t.type) ? 'hot' : ''}">${esc(t.type)}</span>` : ''}</td>
      <td class="mono">${t.date ? fmtShort(t.date) + (t.endDate && t.endDate > t.date ? ' → ' + fmtShort(t.endDate) : '') : '—'}</td>
      <td class="mono">${t.due ? fmtShort(t.due) : ''}</td>
      <td><button class="mv" data-move-open="${t.id}">move</button></td></tr>`).join('')}
  </tbody></table></div>`;
}

function renderTray() {
  const none = S.view === 'list' ? [] : visible().filter(t => !t.date);
  $('#tray').innerHTML = none.length
    ? `<div class="tray"><div class="kicker" style="margin-bottom:10px">No date · ${none.length}</div><div class="stack">${none.map((t, i) => isMtg(t) ? mtgCard(t, 'week', i) : card(t, 'week', i)).join('')}</div></div>` : '';
}

/* ---- status popover (change status / red flag without opening the task) ---- */
const statusPop = document.createElement('div');
statusPop.className = 'move-pop'; statusPop.id = 'statusPop'; statusPop.hidden = true;
document.body.appendChild(statusPop);
let statusId = null;
function openStatus(id, anchor) {
  closeMove();
  const t = S.tasks.find(x => x.id === id); if (!t) return;
  statusId = id;
  statusPop.innerHTML = `<div class="mp-title">Status</div>` +
    STATUSES.map(s => `<button data-status="${s.k}" class="${t.status === s.k ? 'cur' : ''}">${esc(s.label)}</button>`).join('') +
    (isMtg(t) ? '' : `<div class="mp-sep"></div><button data-flag="1" class="flag">${t.isDue ? '✓ ' : ''}Red: due this day</button>`);
  statusPop.hidden = false;
  const r = anchor.getBoundingClientRect(), w = statusPop.offsetWidth, h = statusPop.offsetHeight;
  let x = Math.max(8, Math.min(r.left, innerWidth - w - 8));
  let y = r.bottom + 6; if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 6);
  statusPop.style.left = x + 'px'; statusPop.style.top = y + 'px';
}
function closeStatus() { statusPop.hidden = true; statusId = null; }
statusPop.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !statusId) return;
  const t = S.tasks.find(x => x.id === statusId); if (!t) return closeStatus();
  const r = b.getBoundingClientRect();
  if (b.dataset.status) { const was = t.status; t.status = b.dataset.status; if (t.status === 'done' && was !== 'done') burst(r.left + 20, r.top, 10); }
  else if (b.dataset.flag) t.isDue = !t.isDue;
  closeStatus(); save(); renderCalendar(); renderHero();
});
document.addEventListener('pointerdown', e => { if (!statusPop.hidden && !statusPop.contains(e.target) && !e.target.closest('[data-status-open]')) closeStatus(); });

/* ---- click blank space in a day: add drop-down ---- */
const addPop = document.createElement('div');
addPop.className = 'move-pop add-pop'; addPop.id = 'addPop'; addPop.hidden = true;
document.body.appendChild(addPop);
let addZone = null;
const IC_TODO = '<svg class="ap-ic" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="2.5" width="15" height="15" rx="4"/><path d="M6.5 10.3l2.4 2.4 4.6-5"/></svg>';
const IC_MTG = '<svg class="ap-ic" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7.5"/><path d="M10 5.5V10l3 2"/></svg>';
function openAddPop(zone, x, y) {
  closeMove(); closeStatus();
  const k = zone.dataset.date;
  addZone = zone; zone.classList.add('picked');
  addPop.innerHTML = `<div class="mp-title">Add to ${esc(fmtDay(k))}</div>
    <button data-new="task">${IC_TODO}<span>To do</span></button>
    <button data-new="meeting">${IC_MTG}<span>Meeting</span></button>`;
  addPop.dataset.date = k; addPop.hidden = false;
  const w = addPop.offsetWidth, h = addPop.offsetHeight;
  let px = Math.max(8, Math.min(x - 14, innerWidth - w - 8));
  let py = y + 12; if (py + h > innerHeight - 8) py = Math.max(8, y - h - 12);
  addPop.style.left = px + 'px'; addPop.style.top = py + 'px';
}
function closeAdd() { addPop.hidden = true; addZone?.classList.remove('picked'); addZone = null; }
addPop.addEventListener('click', e => {
  const b = e.target.closest('[data-new]'); if (!b) return;
  const k = addPop.dataset.date; closeAdd();
  openTask(null, { date: k, kind: b.dataset.new });
});
document.addEventListener('pointerdown', e => { if (!addPop.hidden && !addPop.contains(e.target)) closeAdd(); });

function renderCalendar() {
  viewEl.className = 'view' + (navDir > 0 ? ' slide-l' : navDir < 0 ? ' slide-r' : '');
  void viewEl.offsetWidth;
  ({ month: renderMonth, week: renderWeek, day: renderDay, list: renderList }[S.view] || renderMonth)();
  renderTray();
  void viewEl.offsetWidth;
  updateMtgBars();
  navDir = 0;
  $$('#viewSeg button').forEach(b => b.classList.toggle('on', b.dataset.view === S.view));
  moveSegPill();
  $('#prev').disabled = $('#next').disabled = S.view === 'list';
}

function moveSegPill() {
  const seg = $('#viewSeg'); let pill = $('.pill', seg);
  if (!pill) { pill = document.createElement('span'); pill.className = 'pill'; seg.prepend(pill); }
  const on = $('button.on', seg); if (!on) return;
  pill.style.left = on.offsetLeft + 'px'; pill.style.width = on.offsetWidth + 'px';
}

function renderFilters() {
  const used = [...new Set([...S.classes, ...S.tasks.map(t => t.cls).filter(Boolean)])];
  $('#classFilter').innerHTML = `<option value="">All classes</option>` + used.map(c => `<option ${c === S.classFilter ? 'selected' : ''}>${esc(c)}</option>`).join('');
  $('#classList').innerHTML = used.map(c => `<option value="${esc(c)}">`).join('');
  const types = [...new Set([...S.types, ...S.tasks.map(t => t.type).filter(Boolean)])];
  $('#typeList').innerHTML = types.map(c => `<option value="${esc(c)}">`).join('');
  $('#hideDone').checked = S.hideDone;
}

/* ---------------- hero: greeting + daily progress ---------------- */
let celebrated = '';
function renderHero() {
  const now = new Date(), hr = now.getHours();
  $('#greetWord').textContent = hr < 5 ? 'Up late,' : hr < 12 ? 'Good morning,' : hr < 17 ? 'Good afternoon,' : 'Good evening,';
  $('#todayKicker').textContent = `00 / Today · ${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;
  const t = todayStr();
  const list = S.tasks.filter(x => covers(x, t) && x.status !== 'cancelled' && x.kind !== 'meeting');
  const done = list.filter(x => x.status === 'done').length;
  const pct = list.length ? done / list.length : 0;
  $('.p-fill').style.width = (pct * 100) + '%';
  $('.p-marker').style.left = (pct * 100) + '%';
  $('#pDone').textContent = done;
  $('#pLeft').textContent = list.length - done;
  $('#pMid').textContent = list.length ? (pct === 1 ? 'all done today ✿' : `${list.length} on today`) : 'nothing on today';
  const prog = $('#progress');
  const complete = list.length > 0 && pct === 1;
  prog.classList.toggle('complete', complete);
  if (complete && celebrated !== t && document.body.classList.contains('loaded')) {
    celebrated = t;
    const r = $('.p-marker').getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, 22);
  }
}

function renderAll() { if (typeof renderQuick === 'function') renderQuick(); renderFilters(); renderCalendar(); renderHero(); renderSections(); }

/* ---------------- calendar events ---------------- */
$('#viewSeg').addEventListener('click', e => {
  const b = e.target.closest('button[data-view]'); if (!b) return;
  S.view = b.dataset.view; save(true); renderCalendar();
});
function step(dir) {
  if (S.view === 'list') return;
  navDir = dir;
  if (S.view === 'month') cursor = new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1);
  else cursor = addDays(cursor, S.view === 'week' ? 7 * dir : dir);
  renderCalendar();
}
$('#prev').onclick = () => step(-1);
$('#next').onclick = () => step(1);
$('#todayBtn').onclick = () => { const c = cursor; cursor = parse(todayStr()); navDir = cursor < c ? -1 : cursor > c ? 1 : 0; renderCalendar(); };
$('#classFilter').onchange = e => { S.classFilter = e.target.value; save(true); renderCalendar(); };
$('#hideDone').onchange = e => { S.hideDone = e.target.checked; save(true); renderCalendar(); };
$('#newTask').onclick = () => openTask(null, { date: S.view === 'list' ? todayStr() : (S.view === 'month' && ymd(cursor).slice(0, 7) !== todayStr().slice(0, 7) ? ymd(cursor) : (S.view === 'day' ? ymd(cursor) : todayStr())) });

function onCalClick(e) {
  if (e.target.closest('.c-link')) return; // let link open
  const tog = e.target.closest('[data-toggle]');
  if (tog) { e.stopPropagation(); toggleDone(tog.dataset.toggle, tog); return; }
  const mv = e.target.closest('[data-move-open]');
  if (mv) { e.stopPropagation(); openMove(mv.dataset.moveOpen, mv); return; }
  const stb = e.target.closest('[data-status-open]');
  if (stb) { e.stopPropagation(); openStatus(stb.dataset.statusOpen, stb); return; }
  const am = e.target.closest('[data-add-meeting]');
  if (am) { openTask(null, { date: am.dataset.addMeeting, kind: 'meeting' }); return; }
  const add = e.target.closest('[data-add]');
  if (add) { openTask(null, { date: add.dataset.add }); return; }
  const c = e.target.closest('[data-id]');
  if (c) { openTask(c.dataset.id); return; }
  // blank space in a day: drop-down to add a to-do or meeting there
  const z = e.target.closest('[data-date]');
  if (z && !e.target.closest('a,button,input,select,textarea,label')) openAddPop(z, e.clientX, e.clientY);
}
viewEl.addEventListener('click', onCalClick);
$('#tray').addEventListener('click', onCalClick);

// drag & drop (desktop)
let dragId = null;
document.addEventListener('dragstart', e => {
  const c = e.target.closest?.('.card, .mtg'); if (!c) return;
  dragId = c.dataset.id; c.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId);
});
document.addEventListener('dragend', () => { $$('.dragging').forEach(x => x.classList.remove('dragging')); $$('.over').forEach(x => x.classList.remove('over')); dragId = null; });
viewEl.addEventListener('dragover', e => {
  const z = e.target.closest('[data-date]'); if (!z || !dragId) return;
  e.preventDefault(); $$('.over').forEach(x => x !== z && x.classList.remove('over')); z.classList.add('over');
});
viewEl.addEventListener('drop', e => {
  const z = e.target.closest('[data-date]'); if (!z || !dragId) return;
  e.preventDefault(); moveTask(dragId, z.dataset.date);
});

function toggleDone(id, el) {
  const t = S.tasks.find(x => x.id === id); if (!t) return;
  if (t.status === 'done') t.status = 'not-started';
  else {
    t.status = 'done';
    const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 12);
  }
  save(); renderCalendar(); renderHero();
}

function moveTask(id, date) {
  const t = S.tasks.find(x => x.id === id); if (!t) return;
  const len = t.endDate && t.date ? dayDiff(t.endDate, t.date) : 0;
  t.date = date || ''; t.endDate = date && len > 0 ? ymd(addDays(parse(date), len)) : ''; t.rolled = 0; delete t.rolledFrom;
  save(); renderCalendar(); renderHero();
  toast(date ? `moved to ${fmtDay(date)}` : 'moved to no date');
}

/* ---------------- move popover ---------------- */
const movePop = $('#movePop'); let moveId = null;
function openMove(id, anchor) {
  moveId = id;
  const t = S.tasks.find(x => x.id === id);
  $('#movePick').value = t?.date || '';
  movePop.hidden = false;
  const r = anchor.getBoundingClientRect(), w = movePop.offsetWidth, h = movePop.offsetHeight;
  let x = Math.min(r.right - w, innerWidth - w - 8); x = Math.max(8, x);
  let y = r.bottom + 6; if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 6);
  movePop.style.left = x + 'px'; movePop.style.top = y + 'px';
}
function closeMove() { movePop.hidden = true; moveId = null; }
movePop.addEventListener('click', e => {
  const b = e.target.closest('[data-move]'); if (!b || !moveId) return;
  const v = b.dataset.move; const id = moveId;
  const t = S.tasks.find(x => x.id === id);
  let target = '';
  if (v === 'none') target = '';
  else if (v === '0' || v === '1') target = ymd(addDays(parse(todayStr()), +v));
  else target = ymd(addDays(t?.date ? parse(t.date) : parse(todayStr()), +v));
  closeMove(); animateOut(id, () => moveTask(id, target));
});
$('#movePick').addEventListener('change', e => { if (!moveId || !e.target.value) return; const id = moveId; closeMove(); animateOut(id, () => moveTask(id, e.target.value)); });
document.addEventListener('pointerdown', e => { if (!movePop.hidden && !movePop.contains(e.target) && !e.target.closest('[data-move-open]')) closeMove(); });
addEventListener('resize', () => { closeMove(); moveSegPill(); });
function animateOut(id, cb) {
  const el = viewEl.querySelector(`[data-id="${id}"]`);
  if (!el || REDUCED) return cb();
  el.classList.add('leaving'); setTimeout(cb, 300);
}

/* ---------------- task dialog ---------------- */
const dlg = $('#taskDlg'); let editing = null;
const F = { title: $('#fTitle'), link: $('#fLink'), status: $('#fStatus'), cls: $('#fClass'), type: $('#fType'), date: $('#fDate'), due: $('#fDue'), notes: $('#fNotes'), start: $('#fStart'), end: $('#fEnd'), isDue: $('#fIsDue'), endDate: $('#fEndDate') };
let curKind = 'task';
function setKind(k) {
  curKind = k;
  $$('#fKind button').forEach(b => b.classList.toggle('on', b.dataset.kind === k));
  $('#rowTime').hidden = k !== 'meeting'; $('#rowDue').hidden = k === 'meeting'; $('#rowEnd').hidden = k === 'meeting';
}
$('#fKind').addEventListener('click', e => { const b = e.target.closest('[data-kind]'); if (b) setKind(b.dataset.kind); });
function detectKind() {
  if (editing || curKind !== 'task' || F.start.value) return;
  const p = parseTime(F.title.value); if (!p) return;
  setKind('meeting'); F.start.value = p.start; F.end.value = p.end || '';
  toast('looks like a meeting, switched it');
}
F.title.addEventListener('change', detectKind);
$$('[data-endshift]').forEach(b => b.onclick = () => {
  const v = b.dataset.endshift;
  F.endDate.value = v === 'clear' ? '' : ymd(addDays(F.date.value ? parse(F.date.value) : parse(todayStr()), +v));
  if (v !== 'clear' && !F.date.value) F.date.value = todayStr();
});
F.status.innerHTML = ['To-do', 'In progress', 'Complete'].map(g =>
  `<optgroup label="${g}">${STATUSES.filter(s => s.g === g).map(s => `<option value="${s.k}">${esc(s.label)}</option>`).join('')}</optgroup>`).join('');

function openTask(id, preset = {}) {
  closeMove();
  editing = id;
  const t = id ? S.tasks.find(x => x.id === id) : { title: '', link: '', status: 'not-started', cls: '', type: '', date: '', due: '', notes: '', kind: 'task', start: '', end: '', isDue: false, ...preset };
  if (!t) return;
  $('#dlgKicker').textContent = id ? 'EDIT ITEM' : 'NEW ITEM';
  F.title.value = t.title || ''; F.link.value = t.link || ''; F.status.value = t.status || 'not-started';
  F.cls.value = t.cls || ''; F.type.value = t.type || ''; F.date.value = t.date || ''; F.due.value = t.due || ''; F.notes.value = t.notes || '';
  setKind(t.kind || 'task'); F.start.value = t.start || ''; F.end.value = t.end || ''; F.isDue.checked = !!t.isDue; F.endDate.value = t.endDate || '';
  $('#fDelete').hidden = !id;
  const rolled = $('#fRolled');
  rolled.hidden = !(t.rolled && t.rolledFrom);
  if (t.rolled && t.rolledFrom) rolled.textContent = `↻ carried over from ${fmtDay(t.rolledFrom)} (in progress)`;
  updateLinkUI(); updateFound();
  dlg.showModal();
  if (!id && preset.title && !preset.kind) detectKind();
  if (!id && !TOUCH) setTimeout(() => F.title.focus(), 50);
}
function updateLinkUI() {
  const u = safeUrl(F.link.value);
  const a = $('#fLinkOpen'); a.hidden = !u; if (u) a.href = u;
}
function updateFound() {
  const links = findLinks(F.notes.value);
  $('#fFound').innerHTML = links.map(u => `<a class="chip" href="${esc(u)}" target="_blank" rel="noopener">↗ ${esc(shortUrl(u))}</a>`).join('');
}
F.link.addEventListener('input', updateLinkUI);
F.notes.addEventListener('input', updateFound);
$('#fCancel').onclick = () => dlg.close();
$('#fDelete').onclick = () => {
  if (!editing || !confirm('Delete this task?')) return;
  S.tasks = S.tasks.filter(t => t.id !== editing); save(); dlg.close(); renderCalendar(); renderHero(); toast('deleted');
};
$$('.chips [data-shift]').forEach(b => b.onclick = () => {
  const n = +b.dataset.shift;
  F.date.value = n === 0 ? todayStr() : ymd(addDays(F.date.value ? parse(F.date.value) : parse(todayStr()), n));
  F.date.animate?.([{ transform: 'scale(1.04)' }, { transform: 'none' }], { duration: 300 });
});
$('#taskForm').addEventListener('submit', e => {
  e.preventDefault();
  const title = F.title.value.trim();
  if (!title) { F.title.focus(); F.title.animate?.([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 300 }); return; }
  const data = { title, link: safeUrl(F.link.value), status: F.status.value, cls: F.cls.value.trim(), type: F.type.value.trim(), date: F.date.value, due: F.due.value, notes: F.notes.value,
    kind: curKind, start: curKind === 'meeting' ? F.start.value : '', end: curKind === 'meeting' ? F.end.value : '', isDue: curKind === 'task' && F.isDue.checked, endDate: curKind === 'task' ? F.endDate.value : '' };
  if (!data.date || data.endDate <= data.date) data.endDate = '';
  if (data.kind === 'meeting' && !data.start) { const pt = parseTime(title); if (pt) { data.start = pt.start; data.end = pt.end; } }
  if (data.cls && !S.classes.includes(data.cls)) S.classes.push(data.cls);
  if (data.type && !S.types.includes(data.type)) S.types.push(data.type);
  if (editing) {
    const t = S.tasks.find(x => x.id === editing);
    const wasDone = t.status === 'done';
    if (t.date !== data.date) { t.rolled = 0; delete t.rolledFrom; }
    Object.assign(t, data);
    if (!wasDone && t.status === 'done') { const r = $('#fSave').getBoundingClientRect(); burst(r.left + r.width / 2, r.top, 14); }
  } else {
    S.tasks.push({ id: uid(), created: Date.now(), ...data });
    if (data.date) { cursor = parse(data.date); }
  }
  save(); dlg.close(); renderFilters(); renderCalendar(); renderHero();
});

/* paste: grab the hyperlink from copied assignment titles (Canvas etc.) */
function parsePaste(cd) {
  const html = cd.getData('text/html'), plain = cd.getData('text/plain') || '';
  let link = '', title = plain;
  if (html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const a = $$('a[href]', doc).map(a => a.getAttribute('href')).find(h => /^https?:/i.test(h));
    if (a) link = a;
    const txt = doc.body?.textContent; if (txt && txt.trim()) title = txt;
  }
  if (!link) { const m = title.match(URL_RE); if (m) link = m[0]; }
  if (link) title = title.split(link).join(' ');
  title = title.replace(/Links? to an external site\.?/gi, '').replace(/\s+/g, ' ').trim();
  return { title, link };
}
F.title.addEventListener('paste', e => {
  const p = parsePaste(e.clipboardData);
  e.preventDefault();
  const el = F.title; el.setRangeText(p.title, el.selectionStart, el.selectionEnd, 'end'); detectKind();
  if (p.link) {
    F.link.value = p.link; updateLinkUI();
    const row = $('#linkRow'); row.classList.remove('got'); void row.offsetWidth; row.classList.add('got');
    toast('link saved ↗');
  }
});
document.addEventListener('paste', e => {
  if (e.target.closest('input,textarea,[contenteditable],dialog')) return;
  const p = parsePaste(e.clipboardData);
  if (!p.title && !p.link) return;
  e.preventDefault();
  openTask(null, { title: p.title, link: p.link, date: S.view === 'day' ? ymd(cursor) : todayStr() });
  if (p.link) toast('link saved ↗');
});

/* keyboard */
document.addEventListener('keydown', e => {
  if (e.target.closest('input,textarea,select,[contenteditable]') || document.querySelector('dialog[open]')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); $('#newTask').click(); }
  else if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'Escape') { closeMove(); closeStatus(); closeAdd(); }
});

/* ---------------- notes ---------------- */
const secHost = $('#sections');
function chkList(list, key) {
  const sorted = [...list].sort((a, b) => a.done - b.done);
  return `<ul class="chk" data-list="${key}">${sorted.map(it => `<li class="${it.done ? 'done' : ''}" data-iid="${it.id}">
    <button class="box" data-act="check" aria-label="check"><svg><use href="#i-berry"/></svg></button>
    <input class="li-text" data-f="text" value="${esc(it.text)}" aria-label="item">
    <button class="icon x" data-act="rm" aria-label="remove">×</button></li>`).join('')}</ul>`;
}
function sectionBody(n) {
  const d = n.data;
  switch (n.template) {
    case 'checklist': return chkList(d.items, 'items') +
      `<form class="adder" data-list="items"><input name="t" placeholder="add item…" autocomplete="off"><button aria-label="add">+</button></form>` +
      (d.items.some(i => i.done) ? `<button class="linkbtn" data-act="clearDone" data-list="items">clear checked</button>` : '');
    case 'free': return `<textarea class="free" data-f="text" placeholder="write anything… links become clickable below">${esc(d.text)}</textarea><div class="found">${findLinks(d.text).map(u => `<a class="chip" href="${esc(u)}" target="_blank" rel="noopener">↗ ${esc(shortUrl(u))}</a>`).join('')}</div>`;
    case 'links': return `<ul class="lnk" data-list="items">${d.items.map(it => `<li data-iid="${it.id}"><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.label || shortUrl(it.url))}</a><span class="host">${esc(host(it.url))}</span><button class="icon x" data-act="rm" aria-label="remove">×</button></li>`).join('')}</ul>
      <form class="adder" data-list="items"><input name="u" placeholder="paste a link" autocomplete="off" inputmode="url"><input name="l" placeholder="label (optional)" autocomplete="off"><button aria-label="add">+</button></form>`;
    case 'budget': {
      const total = d.items.reduce((s, i) => s + (+i.amt || 0), 0);
      return `<ul class="bud" data-list="items">${d.items.map(it => `<li data-iid="${it.id}"><input class="li-text" data-f="text" value="${esc(it.text)}" aria-label="item"><input class="amt" data-f="amt" type="number" step="0.01" inputmode="decimal" value="${it.amt ?? ''}" aria-label="amount"><button class="icon x" data-act="rm" aria-label="remove">×</button></li>`).join('')}</ul>
        <form class="adder" data-list="items"><input name="t" placeholder="item" autocomplete="off"><input name="a" class="a-amt" type="number" step="0.01" inputmode="decimal" placeholder="$"><button aria-label="add">+</button></form>
        <div class="total"><span>total</span><b data-total>$${total.toFixed(2)}</b></div>`;
    }
    case 'recipe': return `<div class="src"><input class="f-input" data-f="source" placeholder="recipe link" value="${esc(d.source)}">${safeUrl(d.source) ? `<a class="btn sm" href="${esc(safeUrl(d.source))}" target="_blank" rel="noopener">open</a>` : ''}</div>
      <div class="sub">Ingredients</div>${chkList(d.ingredients, 'ingredients')}
      <form class="adder" data-list="ingredients"><input name="t" placeholder="add ingredient…" autocomplete="off"><button aria-label="add">+</button></form>
      <div class="sub">Steps</div><textarea class="free" data-f="steps" placeholder="1. wash strawberries…" style="min-height:100px">${esc(d.steps)}</textarea>`;
  }
  return '';
}
function sectionHTML(n, i) {
  return `<article class="note ${n.collapsed ? 'collapsed' : ''}" data-sid="${n.id}" style="--i:${i}">
    <header class="note-head"><span class="note-num">${pad(i + 1)}</span>
      <input class="note-name" data-f="name" value="${esc(n.name)}" aria-label="section name">
      <span class="note-tpl">${TEMPLATES[n.template]?.label || ''}</span>
      <button class="icon col" data-act="collapse" aria-label="collapse">⌃</button>
      <button class="icon" data-act="del" aria-label="delete section">×</button></header>
    <div class="note-body">${sectionBody(n)}</div><svg class="orn" aria-hidden="true"><use href="#i-rosette" fill="currentColor" filter="url(#emboss)"/></svg></article>`;
}
function renderSections() {
  secHost.innerHTML = S.notes.length ? S.notes.map(sectionHTML).join('') : `<div class="empty">No sections yet. Make one for groceries, packing, links…</div>`;
}
function rerenderSection(n, focusList) {
  const el = secHost.querySelector(`[data-sid="${n.id}"]`); if (!el) return renderSections();
  const i = S.notes.indexOf(n);
  el.outerHTML = sectionHTML(n, i);
  const fresh = secHost.querySelector(`[data-sid="${n.id}"]`);
  fresh.style.animation = 'none';
  if (focusList) fresh.querySelector(`form.adder[data-list="${focusList}"] input`)?.focus();
}
const noteOf = el => S.notes.find(n => n.id === el.closest('[data-sid]')?.dataset.sid);

secHost.addEventListener('input', e => {
  const n = noteOf(e.target); const f = e.target.dataset.f; if (!n || !f) return;
  const li = e.target.closest('[data-iid]');
  if (li) {
    const list = n.data[li.closest('[data-list]').dataset.list];
    const it = list.find(x => x.id === li.dataset.iid); if (!it) return;
    it[f] = f === 'amt' ? (e.target.value === '' ? '' : +e.target.value) : e.target.value;
    if (n.template === 'budget') {
      const tot = n.data.items.reduce((s, i) => s + (+i.amt || 0), 0);
      e.target.closest('.note').querySelector('[data-total]').textContent = '$' + tot.toFixed(2);
    }
  } else if (f === 'name') n.name = e.target.value;
  else {
    n.data[f] = e.target.value;
    if (n.template === 'free') e.target.nextElementSibling.innerHTML = findLinks(n.data.text).map(u => `<a class="chip" href="${esc(u)}" target="_blank" rel="noopener">↗ ${esc(shortUrl(u))}</a>`).join('');
  }
  save();
});
secHost.addEventListener('change', e => { const n = noteOf(e.target); if (n && n.template === 'recipe' && e.target.dataset.f === 'source') rerenderSection(n); });
secHost.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const n = noteOf(b); if (!n) return;
  const act = b.dataset.act;
  if (act === 'collapse') { n.collapsed = !n.collapsed; b.closest('.note').classList.toggle('collapsed', n.collapsed); save(); return; }
  if (act === 'del') {
    if (!confirm(`Delete "${n.name}"?`)) return;
    const el = b.closest('.note');
    el.animate?.([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.9)' }], { duration: 300, easing: 'ease-in' });
    setTimeout(() => { S.notes = S.notes.filter(x => x !== n); save(); renderSections(); }, REDUCED ? 0 : 280);
    return;
  }
  if (act === 'clearDone') { const k = b.dataset.list; n.data[k] = n.data[k].filter(i => !i.done); save(); rerenderSection(n); return; }
  const li = b.closest('[data-iid]'); if (!li) return;
  const key = li.closest('[data-list]').dataset.list;
  if (act === 'rm') {
    n.data[key] = n.data[key].filter(x => x.id !== li.dataset.iid); save();
    li.animate?.([{ opacity: 1 }, { opacity: 0, transform: 'translateX(20px)' }], { duration: 220 });
    setTimeout(() => rerenderSection(n), REDUCED ? 0 : 200);
  }
  if (act === 'check') {
    const it = n.data[key].find(x => x.id === li.dataset.iid); it.done = !it.done; save();
    li.classList.toggle('done', it.done);
    if (it.done) { const r = b.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 6); }
    setTimeout(() => rerenderSection(n), REDUCED ? 0 : 520);
  }
});
secHost.addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target, n = noteOf(form), key = form.dataset.list; if (!n) return;
  const v = name => (form.elements[name]?.value || '').trim();
  if (n.template === 'links') {
    const url = safeUrl(v('u')); if (!url) return form.elements.u.focus();
    n.data.items.push({ id: uid(), url, label: v('l') });
  } else if (n.template === 'budget') {
    if (!v('t') && !v('a')) return;
    n.data.items.push({ id: uid(), text: v('t'), amt: v('a') === '' ? '' : +v('a') });
  } else {
    if (!v('t')) return;
    n.data[key].push({ id: uid(), text: v('t'), done: false });
  }
  save(); rerenderSection(n, key);
});
// paste a link into the links template: auto-fill label from copied html
secHost.addEventListener('paste', e => {
  if (e.target.name !== 'u') return;
  const p = parsePaste(e.clipboardData);
  if (p.link) { e.preventDefault(); e.target.value = p.link; const l = e.target.form.elements.l; if (l && !l.value && p.title) l.value = p.title; }
});

/* new section dialog */
const secDlg = $('#secDlg'); let pickedTpl = 'checklist';
$('#tpls').innerHTML = Object.entries(TEMPLATES).map(([k, t]) => `<button type="button" class="tpl" data-tpl="${k}"><b>${t.label}</b><small>${t.hint}</small></button>`).join('');
$('#tpls').addEventListener('click', e => {
  const b = e.target.closest('[data-tpl]'); if (!b) return;
  const prevDefault = TEMPLATES[pickedTpl].name;
  pickedTpl = b.dataset.tpl;
  $$('.tpl').forEach(x => x.classList.toggle('on', x === b));
  const nm = $('#sName'); if (!nm.value || nm.value === prevDefault) nm.value = TEMPLATES[pickedTpl].name;
});
$('#newSection').onclick = () => {
  pickedTpl = 'checklist'; $('#sName').value = '';
  $$('.tpl').forEach(x => x.classList.toggle('on', x.dataset.tpl === pickedTpl));
  secDlg.showModal();
};
$('#sCancel').onclick = () => secDlg.close();
$('#secForm').addEventListener('submit', e => {
  e.preventDefault();
  const n = { id: uid(), name: $('#sName').value.trim() || TEMPLATES[pickedTpl].name, template: pickedTpl, collapsed: false, data: TEMPLATES[pickedTpl].make() };
  S.notes.push(n); save(); secDlg.close(); renderSections();
  const el = secHost.querySelector(`[data-sid="${n.id}"]`);
  el.classList.add('fresh'); el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => el.querySelector('.adder input, textarea')?.focus({ preventScroll: true }), 500);
});

/* close dialogs by tapping the backdrop */
$$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

/* ---------------- sync (private GitHub Gist) ---------------- */
let sync = (() => { try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || {}; } catch { return {}; } })();
const saveSync = () => { try { localStorage.setItem(SYNC_KEY, JSON.stringify(sync)); } catch {} };
const syncChip = $('#syncChip');
function syncState(st, msg) {
  syncChip.classList.toggle('on', st === 'on');
  syncChip.classList.toggle('busy', st === 'busy');
  $('span', syncChip).textContent = st === 'on' ? 'synced' : st === 'busy' ? 'syncing' : st === 'err' ? 'sync error' : 'local only';
  if (msg) $('#syncStatus').textContent = msg;
}
async function gh(path, opts = {}) {
  const r = await fetch('https://api.github.com' + path, { ...opts, headers: {
    Authorization: 'Bearer ' + sync.token, Accept: 'application/vnd.github+json', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) } });
  if (!r.ok) throw new Error(r.status === 401 ? 'token not accepted (401)' : 'GitHub error ' + r.status);
  return r.json();
}
const payload = () => JSON.stringify({ links: S.links, tasks: S.tasks, notes: S.notes, classes: S.classes, types: S.types, updatedAt: S.updatedAt });
async function ensureGist() {
  if (sync.gistId) return;
  const list = await gh('/gists?per_page=100');
  const g = list.find(g => g.files && g.files[GIST_FILE]);
  if (g) sync.gistId = g.id;
  else {
    const c = await gh('/gists', { method: 'POST', body: JSON.stringify({ description: 'Berry List data', public: false, files: { [GIST_FILE]: { content: payload() } } }) });
    sync.gistId = c.id;
  }
  saveSync();
}
let pushTimer, pushing = false;
function schedulePush() { if (!sync.token) return; clearTimeout(pushTimer); pushTimer = setTimeout(push, 1500); }
async function push() {
  if (!sync.token || pushing) return;
  pushing = true; syncState('busy');
  try {
    await ensureGist();
    await gh('/gists/' + sync.gistId, { method: 'PATCH', body: JSON.stringify({ files: { [GIST_FILE]: { content: payload() } } }) });
    sync.last = Date.now(); saveSync(); syncState('on', 'Connected. Last synced ' + new Date().toLocaleTimeString());
  } catch (err) { syncState('err', 'Sync failed: ' + err.message); }
  pushing = false;
}
async function pull(quiet) {
  if (!sync.token || document.querySelector('dialog[open]')) return;
  syncState('busy');
  try {
    await ensureGist();
    const g = await gh('/gists/' + sync.gistId);
    const f = g.files[GIST_FILE];
    if (!f) { await push(); return; }
    const txt = f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
    const remote = JSON.parse(txt || '{}');
    if ((remote.updatedAt || 0) > (S.updatedAt || 0)) {
      Object.assign(S, { links: remote.links || S.links, tasks: remote.tasks || [], notes: remote.notes || [], classes: remote.classes || S.classes, types: remote.types || S.types, updatedAt: remote.updatedAt });
      normalizeTasks(S.tasks); saveNow(); rollover(); renderAll();
      if (!quiet) toast('pulled latest from your other device');
    } else if ((S.updatedAt || 0) > (remote.updatedAt || 0)) { pushing = false; await push(); return; }
    syncState('on', 'Connected. Last synced ' + new Date().toLocaleTimeString());
  } catch (err) { syncState('err', 'Sync failed: ' + err.message); }
}
const syncDlg = $('#syncDlg');
const openSync = () => { $('#syncToken').value = sync.token || ''; if (!sync.token) syncState('off', 'Not connected. Everything is only saved in this browser.'); syncDlg.showModal(); };
syncChip.onclick = openSync; $('#syncBtn').onclick = openSync;
$('#syncCancel').onclick = () => syncDlg.close();
$('#syncOff').onclick = () => { sync = {}; saveSync(); syncState('off', 'Disconnected. Saving only in this browser.'); };
$('#syncForm').addEventListener('submit', async e => {
  e.preventDefault();
  const tok = $('#syncToken').value.trim(); if (!tok) return;
  if (tok !== sync.token) sync = { token: tok };
  saveSync(); syncState('busy', 'Connecting…');
  try {
    await ensureGist();
    const g = await gh('/gists/' + sync.gistId);
    const f = g.files[GIST_FILE];
    const remote = f ? JSON.parse((f.truncated ? await (await fetch(f.raw_url)).text() : f.content) || '{}') : null;
    // first connect on a device: if the cloud already has a list, use it
    if (remote && remote.tasks && (remote.updatedAt || 0) >= (S.updatedAt || 0) - 1) {
      Object.assign(S, { links: remote.links || S.links, tasks: remote.tasks, notes: remote.notes || [], classes: remote.classes || S.classes, types: remote.types || S.types, updatedAt: remote.updatedAt });
      normalizeTasks(S.tasks); saveNow(); rollover(); renderAll();
      syncState('on', 'Connected. Loaded your list from the cloud.');
    } else { await push(); }
    toast('sync on ✿');
  } catch (err) { syncState('err', 'Could not connect: ' + err.message); }
});
if (sync.token) { syncState('on', 'Connected.'); pull(true); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { pull(); if (todayStr() !== lastDay) { lastDay = todayStr(); rollover(); renderAll(); } } });
setInterval(() => { if (document.visibilityState === 'visible') pull(true); }, 90000);

/* ---------------- backup ---------------- */
$('#exportBtn').onclick = () => {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `berry-list-${todayStr()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('#importBtn').onclick = () => $('#importFile').click();
$('#importFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!Array.isArray(d.tasks)) throw 0;
    if (!confirm('Replace your current list with this backup?')) return;
    S = Object.assign(defaults(), d); normalizeTasks(S.tasks); save(); renderAll(); toast('imported');
  } catch { alert('That file is not a Berry List backup.'); }
  e.target.value = '';
};
$('#resetBtn').onclick = () => {
  if (!confirm('Erase everything on this device and start fresh?')) return;
  S = defaults(); save(); renderAll(); toast('fresh start');
};

/* ---------------- fx ---------------- */
function burst(x, y, n = 10) {
  if (REDUCED) return;
  for (let i = 0; i < n; i++) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('class', 'particle');
    el.innerHTML = `<use href="#${Math.random() < .55 ? 'i-berry' : 'i-grape'}"/>`;
    document.body.appendChild(el);
    const a = Math.random() * Math.PI * 2, v = 50 + Math.random() * 90, s = .45 + Math.random() * .6;
    const dx = Math.cos(a) * v, dy = Math.sin(a) * v - 70, rot = (Math.random() - .5) * 540;
    el.animate([
      { transform: `translate(${x - 10}px,${y - 11}px) scale(${s * .3}) rotate(0)`, opacity: 1 },
      { transform: `translate(${x - 10 + dx * .6}px,${y - 11 + dy * .6}px) scale(${s}) rotate(${rot * .5}deg)`, opacity: 1, offset: .45 },
      { transform: `translate(${x - 10 + dx}px,${y - 11 + dy + 160}px) scale(${s * .8}) rotate(${rot}deg)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.2,.6,.4,1)' }).onfinish = () => el.remove();
  }
}
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
}

/* marquee */
const mq = `<span>Strawberries</span><svg><use href="#i-berry"/></svg><span><em>grapes</em></span><svg><use href="#i-grape"/></svg><span>one thing at a time</span><svg><use href="#i-berry"/></svg><span class="zh">一步一步</span><svg><use href="#i-grape"/></svg>`;
$('#track').innerHTML = mq + mq + mq + mq;

/* ---------------- immersive layer: loader, smooth scroll, cursor, reveals ---------------- */
const topbar = $('.topbar'); let lastY = 0;
addEventListener('scroll', () => {
  const y = scrollY;
  topbar.classList.toggle('scrolled', y > 30);
  lastY = y;
  if (!movePop.hidden) closeMove();
  if (!statusPop.hidden) closeStatus();
  if (!addPop.hidden) closeAdd();
}, { passive: true });

const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: .15 });
$$('.reveal, .fret').forEach(el => io.observe(el));

const cur = $('#cursor');
if (!TOUCH) {
  let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
  addEventListener('pointermove', e => {
    tx = e.clientX; ty = e.clientY; cur.classList.add('on');
    cur.classList.toggle('big', !!e.target.closest?.('a,button,.card,.tpl,summary,label.toggle'));
    document.documentElement.style.setProperty('--mx', (e.clientX / innerWidth - .5).toFixed(3));
    document.documentElement.style.setProperty('--my', (e.clientY / innerHeight - .5).toFixed(3));
  }, { passive: true });
  document.addEventListener('pointerleave', () => cur.classList.remove('on'));
  (function loop() { cx += (tx - cx) * .2; cy += (ty - cy) * .2; cur.style.transform = `translate(${cx}px,${cy}px)`; requestAnimationFrame(loop); })();
}

function runLoader() {
  const cnt = $('#loaderCount'), bar = $('#loaderBar');
  const dur = REDUCED ? 100 : 1700, t0 = performance.now();
  const tick = now => {
    const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    cnt.textContent = Math.round(e * 100); bar.style.width = e * 100 + '%';
    if (p < 1) requestAnimationFrame(tick);
    else setTimeout(() => { document.body.classList.add('loaded'); renderHero(); window.dispatchEvent(new Event('berry:loaded')); }, 250);
  };
  requestAnimationFrame(tick);
}

/* quick links (hover top right, tap on phone) */
const quick = $('#quick'), qMenu = $('#quickMenu'); let qEdit = false;
const Q_ICON = { resume: '✎', linkedin: 'in', canvas: '◐', gmail: '✉' };
function renderQuick() {
  if (!Array.isArray(S.links)) S.links = defaultLinks();
  qMenu.innerHTML = (qEdit
    ? S.links.map((l, i) => `<label class="q-edit"><span>${esc(l.label)}</span><input data-qi="${i}" value="${esc(l.url)}" placeholder="paste link" inputmode="url" autocomplete="off"></label>`).join('') +
      `<button class="q-foot" data-q="done">done</button>`
    : S.links.map((l, i) => l.url
        ? `<a class="q-item" href="${esc(l.url)}" target="_blank" rel="noopener" style="--i:${i}"><i>${Q_ICON[l.k] || '↗'}</i><span>${esc(l.label)}</span><em>${esc(host(l.url))}</em><b>↗</b></a>`
        : `<button class="q-item q-missing" data-q="edit" style="--i:${i}"><i>${Q_ICON[l.k] || '↗'}</i><span>${esc(l.label)}</span><em>add link</em><b>+</b></button>`).join('') +
      `<button class="q-foot" data-q="edit">edit links</button>`);
}
const qOpen = v => { quick.classList.toggle('open', v); $('#quickBtn').setAttribute('aria-expanded', v); if (!v && qEdit) { qEdit = false; renderQuick(); } };
let qTimer;
quick.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { clearTimeout(qTimer); qOpen(true); } });
quick.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !qEdit) qTimer = setTimeout(() => qOpen(false), 250); });
$('#quickBtn').addEventListener('click', () => qOpen(!quick.classList.contains('open')));
document.addEventListener('pointerdown', e => { if (!quick.contains(e.target)) qOpen(false); });
qMenu.addEventListener('click', e => {
  const b = e.target.closest('[data-q]'); if (!b) return;
  e.preventDefault(); qEdit = b.dataset.q === 'edit'; renderQuick();
  if (qEdit) { const empty = qMenu.querySelector('input[value=""]') || qMenu.querySelector('input'); empty?.focus(); }
});
qMenu.addEventListener('input', e => {
  const i = e.target.dataset.qi; if (i == null) return;
  S.links[i].url = safeUrl(e.target.value) || e.target.value.trim(); save();
});
renderQuick();

/* glazed relief tiles */
const TILE_COLORS = ['#e8f0f0', '#f8f4ec', '#f6e9e6', '#f2f6f6', '#d3e1e3', '#fcfaf5', '#f3e2de', '#edf3f3'];
$('#tileStrip').innerHTML = Array.from({ length: 16 }, (_, i) => {
  const c = TILE_COLORS[i % TILE_COLORS.length];
  return `<div class="tile" style="--i:${i};background:${c}"><svg viewBox="0 0 100 100"><use href="#i-rosette" fill="${c}" filter="url(#emboss)"/></svg></div>`;
}).join('');
io.observe($('#tileStrip'));
document.fonts?.ready.then(moveSegPill);

/* ---------------- boot ---------------- */
if (!rollover()) saveNow();
renderAll();
runLoader();
setInterval(updateMtgBars, 20000);
document.addEventListener('visibilitychange', updateMtgBars);
window.__berry = { burst };
})();
