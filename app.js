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

// ---- Decide page (list only; filtering and Pick come next) ----
function renderDecide() {
  const list = [...store.options].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  $('decide-empty').hidden = list.length > 0;
  $('decide-list').innerHTML = list.map(o => `
    <li data-id="${o.id}"><span class="name">${esc(o.name)}</span><button class="primary">Pick</button></li>`).join('');
}

function renderAll() {
  renderOptions();
  renderDecide();
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
