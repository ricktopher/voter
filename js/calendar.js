/**
 * calendar.js — the Calendar page: where your decisions landed over time.
 *
 * Shows one month as a Monday-first grid. Each day gets one dot per decision made
 * that day, coloured by option (same colours as the Today timeline). Busy days show
 * the first few dots plus "+N". Below the grid, a legend lists the options picked
 * that month with their counts.
 *
 * Tapping a day opens a card below with that day's decisions, in one of two views
 * (switch with the List | Timeline control; the choice is saved in store.calView):
 *   list      time · option · what it was chosen over (its shortlist)
 *   timeline  the same lollipop timeline as the Today card (drawTimeline in timeline.js)
 *
 * Other UI state (which month, which day, which lollipop) lives in this file and isn't saved.
 */

/** Month being shown. Starts on the current month. (Months are 0–11: January = 0.) */
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
/** Day selected for the detail card, as a Date at local midnight, or null for none. */
let calSelected = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
/** `at` of the lollipop tapped in the day's timeline view, or null. */
let calSelectedPopAt = null;

/** Max dots drawn in a day cell before switching to "+N". Fewer fit on narrow phone cells. */
const maxDots = () => (matchMedia('(max-width: 600px)').matches ? 4 : 8);

/** Local-date key like "2026-11-08", used to group decisions by day. */
const dayKey = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** Decisions made in the given month, oldest first, each with its option and a Date. */
function decisionsInMonth(year, month) {
  return store.decisions
    .map(d => ({ ...d, date: new Date(d.at), option: store.options.find(o => o.id === d.optionId) }))
    .filter(d => d.option && d.date.getFullYear() === year && d.date.getMonth() === month)
    .sort((a, b) => a.date - b.date);
}

/** Rebuild the Calendar page: month grid, legend, and the selected day's card. */
function renderCalendar() {
  const year = calYear, month = calMonth;
  const today = new Date();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate(); // day 0 of next month = last day of this one
  const offset = (first.getDay() + 6) % 7;                    // getDay() has Sunday = 0; shift so Monday = 0

  const monthDecisions = decisionsInMonth(year, month);
  const byDay = {}; // dayOfMonth → [decision, …]
  monthDecisions.forEach(d => (byDay[d.date.getDate()] ||= []).push(d));

  // ---- Header ----
  $('cal-title').textContent = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const n = monthDecisions.length;
  $('cal-count').textContent = n ? `${n} decision${n === 1 ? '' : 's'}` : '';

  // ---- Grid: weekday headings, blank cells so day 1 lands on the right weekday, then the days ----
  let html = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    .map(d => `<div class="dow">${d}</div>`).join('');
  html += '<div></div>'.repeat(offset);
  const cap = maxDots();
  for (let d = 1; d <= daysInMonth; d++) {
    const list = byDay[d] || [];
    const date = new Date(year, month, d);
    const isToday = dayKey(date) === dayKey(today);
    const isSelected = calSelected && dayKey(date) === dayKey(calSelected);
    const cls = ['day', list.length && 'has', isToday && 'today', isSelected && 'selected'].filter(Boolean).join(' ');

    // Up to `cap` dots; if there are more, show cap-1 dots and a "+N" so the cell never overflows.
    const shown = list.length > cap ? list.slice(0, cap - 1) : list;
    const dots = shown.map(x => `<span class="dot ${colorOf(x.optionId)}"></span>`).join('') +
      (list.length > shown.length ? `<span class="more">+${list.length - shown.length}</span>` : '');

    const label = `${date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}: ` +
      `${list.length} decision${list.length === 1 ? '' : 's'}`;
    html += `<button class="${cls}" type="button" data-day="${d}" aria-label="${label}" aria-pressed="${!!isSelected}">
      ${d}<span class="dots">${dots}</span></button>`;
  }
  $('cal-grid').innerHTML = html;

  // ---- Legend: options picked this month, most picked first ----
  const counts = {};
  monthDecisions.forEach(d => counts[d.optionId] = (counts[d.optionId] || 0) + 1);
  $('cal-legend').innerHTML = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([id, c]) => {
      const o = store.options.find(o => o.id === id);
      return `<span><span class="dot ${colorOf(id)}"></span>${esc(o.name)} · ${c}</span>`;
    }).join('');

  $('cal-empty').hidden = n > 0;
  $('cal-empty').textContent = `No decisions in ${first.toLocaleDateString(undefined, { month: 'long' })}.`;

  renderCalendarDay();
}

/** Fill the card below the grid with the selected day's decisions (hidden if the day isn't in view). */
function renderCalendarDay() {
  const sel = calSelected;
  const inView = sel && sel.getFullYear() === calYear && sel.getMonth() === calMonth;
  $('cal-detail').hidden = !inView;
  if (!inView) return;

  const list = decisionsInMonth(calYear, calMonth).filter(d => d.date.getDate() === sel.getDate());
  $('cal-detail-title').textContent =
    sel.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  $('cal-detail-count').textContent = `${list.length} decision${list.length === 1 ? '' : 's'}`;

  // List | Timeline switch: highlight the active button, show the matching view.
  const view = store.calView === 'timeline' ? 'timeline' : 'list';
  $('cal-view').querySelectorAll('button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  $('cal-entries').hidden = view !== 'list';
  $('cal-timeline-wrap').hidden = view !== 'timeline';

  if (view === 'timeline') {
    // Only today gets the "now" marker; past days are complete, future days are empty.
    const isToday = dayKey(sel) === dayKey(new Date());
    const picked = drawTimeline($('cal-timeline'), list,
      { now: isToday ? new Date() : null, selectedAt: calSelectedPopAt });
    $('cal-tl-detail').innerHTML = picked
      ? `<strong>${fmtTime(picked.date)}</strong> · ${esc(picked.option.name)}`
      : list.length ? 'Tap a lollipop to see what you picked.' : 'No decisions this day.';
    return;
  }

  // One line per decision: time · colour dot · option · "over A, B" (the rest of its shortlist).
  const nameOf = id => store.options.find(o => o.id === id)?.name;
  $('cal-entries').innerHTML = list.length
    ? list.map(d => {
        const others = (d.candidates || []).filter(id => id !== d.optionId).map(nameOf).filter(Boolean);
        return `<li>
          <time datetime="${d.at}">${fmtTime(d.date)}</time>
          <span class="dot ${colorOf(d.optionId)}"></span>
          <span class="name">${esc(d.option.name)}</span>
          ${others.length ? `<span class="vs">over ${others.map(esc).join(', ')}</span>` : ''}
        </li>`;
      }).join('')
    : '<li class="none">No decisions this day.</li>';
}

/** Move the calendar by `delta` months (−1 = previous, +1 = next). */
function shiftMonth(delta) {
  const d = new Date(calYear, calMonth + delta, 1); // Date handles year roll-over (e.g. month 12 → next January)
  calYear = d.getFullYear();
  calMonth = d.getMonth();
  renderCalendar();
}

$('cal-prev').addEventListener('click', () => shiftMonth(-1));
$('cal-next').addEventListener('click', () => shiftMonth(1));

// Tapping a day selects it; tapping it again closes the detail card.
$('cal-grid').addEventListener('click', e => {
  const cell = e.target.closest('.day');
  if (!cell) return;
  const date = new Date(calYear, calMonth, Number(cell.dataset.day));
  calSelected = calSelected && dayKey(calSelected) === dayKey(date) ? null : date;
  calSelectedPopAt = null; // a new day starts with no lollipop selected
  renderCalendar();
});

// List | Timeline switch. Saved, so the Calendar opens in the same view next time.
$('cal-view').addEventListener('click', e => {
  const btn = e.target.closest('button[data-view]');
  if (!btn) return;
  store.calView = btn.dataset.view;
  save();
  renderCalendarDay();
});

// Tapping a lollipop in the day's timeline shows its details; tapping it again clears them.
$('cal-timeline').addEventListener('click', e => {
  const pop = e.target.closest('.pop');
  if (!pop) return;
  calSelectedPopAt = calSelectedPopAt === pop.dataset.at ? null : pop.dataset.at;
  renderCalendarDay();
});

// Phone ↔ desktop width changes how many dots fit in a cell, so redraw when it flips.
matchMedia('(max-width: 600px)').addEventListener('change', renderCalendar);
