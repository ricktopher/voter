/**
 * calendar.js — the Calendar page: a month grid that will show where decisions landed.
 *
 * STATUS: layout only. It is called with no data (see main.js), so it shows the
 * current month with today highlighted and no dots. Wiring it to store.decisions
 * is a future step. The ‹ › month buttons are not hooked up yet either.
 */

/**
 * Draw a month as a Monday-first grid.
 *
 * @param {number} year       e.g. 2026
 * @param {number} month      0–11 (JavaScript months start at 0: January = 0)
 * @param {Object} dotsByDay  { dayOfMonth: [colourIndex, …] }: one dot per entry, e.g. { 8: [0, 2] }
 * @param {string[]} legend   option names; legend[i] is labelled with colour i
 */
function renderCalendar(year, month, dotsByDay = {}, legend = []) {
  const grid = document.getElementById('cal-grid');
  const today = new Date();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate(); // day 0 of next month = last day of this one
  const offset = (first.getDay() + 6) % 7; // getDay() has Sunday = 0; shift so Monday = 0

  document.getElementById('cal-title').textContent =
    first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  // Weekday headings, then blank cells so day 1 lands under the right weekday.
  let html = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    .map(d => `<div class="dow">${d}</div>`).join('');
  html += '<div></div>'.repeat(offset);

  // One cell per day, with its dots.
  // NOTE: uses only 4 colours (c1–c4); switch to colorOf() / 8 colours when wiring up real data.
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
    const dots = (dotsByDay[d] || []).map(c => `<span class="dot c${c % 4 + 1}"></span>`).join('');
    html += `<div class="day${isToday ? ' today' : ''}">${d}<div class="dots">${dots}</div></div>`;
  }
  grid.innerHTML = html;

  document.getElementById('cal-legend').innerHTML = legend
    .map((o, i) => `<span><span class="dot c${i % 4 + 1}"></span>${esc(o)}</span>`).join('');
}
