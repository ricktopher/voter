// ---- Tab routing via URL hash ----
const pages = ['decide', 'modify', 'matrix', 'calendar'];
function show() {
  const id = pages.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'decide';
  pages.forEach(p => document.getElementById(p).hidden = p !== id);
  document.querySelectorAll('nav a').forEach(a =>
    a.classList.toggle('active', a.getAttribute('href') === '#' + id));
}
addEventListener('hashchange', show);
show();

// ---- Helpers ----
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---- Storage (browser localStorage — swap for the Django API later) ----
// options:   [{ id, name }]
// decisions: [{ optionId, at }]   (at = ISO timestamp; filled in once Pick is wired up)
const STORE_KEY = 'voter:v1';
function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY));
    if (data && Array.isArray(data.options)) return { decisions: [], sort: 'alpha', ...data };
  } catch {}
  return { options: [], decisions: [], sort: 'alpha' };
}
const store = load();
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch {}
}
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const timesPicked = id => store.decisions.filter(d => d.optionId === id).length;
const nameTaken = (name, exceptId) => store.options.some(o =>
  o.id !== exceptId && o.name.toLowerCase() === name.toLowerCase());

// ---- Options page: add / edit / delete / sort ----
let editingId = null;     // option currently being renamed
let confirmingId = null;  // option waiting for delete confirmation

function sortedOptions() {
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  const list = [...store.options];
  if (store.sort === 'freq-asc')  return list.sort((a, b) => timesPicked(a.id) - timesPicked(b.id) || byName(a, b));
  if (store.sort === 'freq-desc') return list.sort((a, b) => timesPicked(b.id) - timesPicked(a.id) || byName(a, b));
  return list.sort(byName);
}

function renderOptions() {
  const list = sortedOptions();
  $('options-empty').hidden = list.length > 0;
  $('options-list').innerHTML = list.map(o => {
    const n = timesPicked(o.id);
    if (o.id === editingId) return `
      <li class="editing" data-id="${o.id}">
        <input type="text" class="edit-input" value="${esc(o.name)}" maxlength="80" aria-label="Rename option">
        <span class="actions">
          <button class="primary" data-action="save">Save</button>
          <button class="ghost" data-action="cancel">Cancel</button>
        </span>
      </li>`;
    if (o.id === confirmingId) return `
      <li data-id="${o.id}">
        <span class="name">${esc(o.name)}</span>
        <span class="actions">
          <span class="confirm">Delete${n ? ` (and its ${n} pick${n > 1 ? 's' : ''})` : ''}?</span>
          <button class="ghost danger" data-action="confirm-delete">Yes</button>
          <button class="ghost" data-action="cancel">No</button>
        </span>
      </li>`;
    return `
      <li data-id="${o.id}">
        <span class="name">${esc(o.name)}</span>
        <span class="row">
          <span class="count">${n}×</span>
          <span class="actions">
            <button class="ghost" data-action="edit">Edit</button>
            <button class="ghost danger" data-action="delete">Delete</button>
          </span>
        </span>
      </li>`;
  }).join('');

  const editInput = $('options-list').querySelector('.edit-input');
  if (editInput) { editInput.focus(); editInput.select(); }
}

function showAddError(msg) {
  $('add-error').textContent = msg;
  $('add-error').hidden = !msg;
}

$('add-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('add-input').value.trim();
  if (!name) return;
  if (nameTaken(name)) return showAddError(`“${name}” is already an option.`);
  store.options.push({ id: newId(), name });
  save();
  $('add-input').value = '';
  showAddError('');
  renderAll();
});
$('add-input').addEventListener('input', () => showAddError(''));

$('sort-select').value = store.sort;
$('sort-select').addEventListener('change', e => {
  store.sort = e.target.value;
  save();
  renderOptions();
});

function saveEdit(li) {
  const name = li.querySelector('.edit-input').value.trim();
  const opt = store.options.find(o => o.id === li.dataset.id);
  if (!name || name === opt.name) { editingId = null; return renderOptions(); }
  if (nameTaken(name, opt.id)) {
    const input = li.querySelector('.edit-input');
    input.setCustomValidity(`“${name}” is already an option.`);
    input.reportValidity();
    return;
  }
  opt.name = name;
  editingId = null;
  save();
  renderAll();
}

$('options-list').addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const li = btn.closest('li');
  const id = li.dataset.id;
  switch (btn.dataset.action) {
    case 'edit':   editingId = id; confirmingId = null; break;
    case 'delete': confirmingId = id; editingId = null; break;
    case 'cancel': editingId = confirmingId = null; break;
    case 'save':   return saveEdit(li);
    case 'confirm-delete':
      store.options = store.options.filter(o => o.id !== id);
      store.decisions = store.decisions.filter(d => d.optionId !== id);
      confirmingId = null;
      save();
      return renderAll();
  }
  renderOptions();
});

$('options-list').addEventListener('keydown', e => {
  if (!e.target.classList.contains('edit-input')) return;
  e.target.setCustomValidity('');
  if (e.key === 'Enter')  { e.preventDefault(); saveEdit(e.target.closest('li')); }
  if (e.key === 'Escape') { editingId = null; renderOptions(); }
});

// ---- Decide page: filter, pick, undo ----
// Each pick is one raw decision — no duration attached.
let justPickedId = null;
let recordedTimer = null;

function filteredOptions() {
  const q = $('filter-input').value.trim().toLowerCase();
  return [...store.options]
    .filter(o => o.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

// Brief "Recorded: X · Undo" confirmation after each pick.
function showRecorded(option) {
  clearTimeout(recordedTimer);
  $('recorded').innerHTML =
    `<span>Recorded: <strong>${esc(option.name)}</strong></span>
     <button class="ghost" id="undo-pick">Undo</button>`;
  $('recorded').hidden = false;
  recordedTimer = setTimeout(hideRecorded, 6000);
}
function hideRecorded() {
  clearTimeout(recordedTimer);
  $('recorded').hidden = true;
}

function renderDecide() {
  const hasOptions = store.options.length > 0;
  const list = filteredOptions();
  $('decide-empty').hidden = hasOptions;
  $('filter-input').closest('.row').hidden = !hasOptions;
  $('decide-nomatch').hidden = !hasOptions || list.length > 0;
  $('decide-nomatch').textContent = `No options match “${$('filter-input').value.trim()}”.`;
  $('decide-list').innerHTML = list.map(o => `
    <li data-id="${o.id}"${o.id === justPickedId ? ' class="just-picked"' : ''}>
      <span class="name">${esc(o.name)}</span>
      <button class="primary" data-action="pick">Pick</button>
    </li>`).join('');
  justPickedId = null;
}

function pick(optionId) {
  store.decisions.push({ optionId, at: new Date().toISOString() });
  save();
  justPickedId = optionId;
  $('filter-input').value = '';
  renderAll();
  showRecorded(store.options.find(o => o.id === optionId));
}

$('filter-input').addEventListener('input', renderDecide);
$('filter-input').addEventListener('keydown', e => {
  // Enter picks the option when the filter narrows it down to exactly one.
  if (e.key !== 'Enter') return;
  const list = filteredOptions();
  if (list.length === 1) pick(list[0].id);
});

$('decide-list').addEventListener('click', e => {
  const btn = e.target.closest('button[data-action="pick"]');
  if (btn) pick(btn.closest('li').dataset.id);
});

$('recorded').addEventListener('click', e => {
  if (e.target.id !== 'undo-pick') return;
  store.decisions.pop();
  save();
  hideRecorded();
  renderAll();
});
// Leaving the page dismisses the note, so Undo can't act on stale state.
addEventListener('hashchange', hideRecorded);

// ---- Decide page: today's timeline (lollipop per decision) ----
const PALETTE_SIZE = 8;
// Stable colour per option, based on the order options were created.
const colorOf = optionId =>
  `c${store.options.findIndex(o => o.id === optionId) % PALETTE_SIZE + 1}`;
const fmtTime = d => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
let selectedPopAt = null;

function todaysDecisions() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return store.decisions
    .map(d => ({ ...d, date: new Date(d.at), option: store.options.find(o => o.id === d.optionId) }))
    .filter(d => d.option && d.date >= start && d.date < end)
    .sort((a, b) => a.date - b.date);
}

// Fraction of the day (0–1) for a given time.
const dayFrac = d => (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400;

function renderDay() {
  const today = todaysDecisions();
  const now = new Date();
  $('day-count').textContent =
    `${today.length} decision${today.length === 1 ? '' : 's'} · ${now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}`;

  // Stack lollipops that sit close together: each takes the lowest level free nearby.
  const MIN_GAP = 0.025; // ~36 minutes
  const lastAtLevel = [];
  const placed = today.map(d => {
    const x = dayFrac(d.date);
    let level = lastAtLevel.findIndex(prev => x - prev >= MIN_GAP);
    if (level === -1) level = lastAtLevel.length;
    level = Math.min(level, 4);
    lastAtLevel[level] = x;
    return { ...d, x, level };
  });

  let html = '<div class="axis"></div>';
  html += `<div class="past" style="width:${dayFrac(now) * 100}%"></div>`;
  for (let h = 0; h <= 24; h += 3) {
    html += `<div class="tick${h % 6 ? ' minor' : ''}" style="left:${h / 24 * 100}%">${String(h).padStart(2, '0')}:00</div>`;
  }
  html += `<div class="now" style="left:${dayFrac(now) * 100}%"><span>now</span></div>`;
  html += placed.map(d => `
    <button class="pop ${colorOf(d.optionId)}${d.at === selectedPopAt ? ' selected' : ''}"
            style="left:${d.x * 100}%; --level:${d.level}"
            data-at="${d.at}"
            title="${fmtTime(d.date)} · ${esc(d.option.name)}"
            aria-label="${fmtTime(d.date)}: ${esc(d.option.name)}">
      <span class="head"></span><span class="stick"></span>
    </button>`).join('');
  $('timeline').innerHTML = html;

  const sel = placed.find(d => d.at === selectedPopAt);
  $('tl-detail').innerHTML = sel
    ? `<strong>${fmtTime(sel.date)}</strong> · ${esc(sel.option.name)}`
    : today.length ? 'Tap a lollipop to see what you picked.' : 'No decisions yet today.';

  // Legend: options picked today, with counts, most picked first.
  const counts = {};
  today.forEach(d => counts[d.optionId] = (counts[d.optionId] || 0) + 1);
  $('day-legend').innerHTML = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => {
      const o = store.options.find(o => o.id === id);
      return `<span><span class="dot ${colorOf(id)}"></span>${esc(o.name)} · ${n}</span>`;
    }).join('');
}

$('timeline').addEventListener('click', e => {
  const pop = e.target.closest('.pop');
  if (!pop) return;
  selectedPopAt = selectedPopAt === pop.dataset.at ? null : pop.dataset.at;
  renderDay();
});

// Keep the "now" marker moving and roll over at midnight.
setInterval(renderDay, 60 * 1000);

function renderAll() {
  renderOptions();
  renderDecide();
  renderDay();
}
renderAll();

// ---- Calendar (current month, Monday-first grid) ----
// dotsByDay: { dayOfMonth: [colorIndex, ...] }   legend: [optionName, ...]
function renderCalendar(year, month, dotsByDay = {}, legend = []) {
  const grid = document.getElementById('cal-grid');
  const today = new Date();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7; // Sunday=0 → Monday-first

  document.getElementById('cal-title').textContent =
    first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  let html = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    .map(d => `<div class="dow">${d}</div>`).join('');
  html += '<div></div>'.repeat(offset);
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
    const dots = (dotsByDay[d] || []).map(c => `<span class="dot c${c % 4 + 1}"></span>`).join('');
    html += `<div class="day${isToday ? ' today' : ''}">${d}<div class="dots">${dots}</div></div>`;
  }
  grid.innerHTML = html;

  document.getElementById('cal-legend').innerHTML = legend
    .map((o, i) => `<span><span class="dot c${i % 4 + 1}"></span>${esc(o)}</span>`).join('');
}
const now = new Date();
renderCalendar(now.getFullYear(), now.getMonth());

// ---- Priority matrix ----
// opts: [optionName, ...]
// wins[a][b] = share of times option a was picked over option b (0–1).
// Reads as: "I would rather <column> than <row>" — cell = % of times column won.
function renderMatrix(opts = [], wins = []) {
  const table = document.getElementById('matrix-table');
  if (opts.length < 2) { table.innerHTML = ''; return; }
  let html =
    `<tr><th></th><th class="axis axis-col" colspan="${opts.length}">I would rather…</th></tr>` +
    '<tr><th class="axis axis-row">than…</th>' +
    opts.map(o => `<th class="colh">${esc(o)}</th>`).join('') + '</tr>';
  opts.forEach((than, r) => {
    html += `<tr><th class="rowh">${esc(than)}</th>` + opts.map((rather, c) => {
      if (r === c) return '<td class="self">—</td>';
      const v = wins[c][r];
      const pct = Math.round(v * 100);
      return `<td class="${v > .5 ? 'hi' : ''}" style="--v:${v}" title="I would rather ${esc(rather)} than ${esc(than)}: ${pct}% of the time">${pct}%</td>`;
    }).join('') + '</tr>';
  });
  table.innerHTML = html;
}
renderMatrix();
