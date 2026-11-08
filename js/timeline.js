/**
 * timeline.js — the "Today" card on the Decide page.
 *
 * Draws a midnight-to-midnight line with one "lollipop" (stick + coloured head) per
 * decision made today, positioned at the time it was made. Also shows a "now" marker,
 * the number of decisions today, and a legend of today's picks with counts.
 *
 * POSITIONING
 * Everything is placed with CSS `left: X%`, where X is the fraction of the day that
 * has passed (see dayFrac). That keeps the timeline responsive with no maths on resize.
 * Lollipops close together are given different heights ("levels") so they don't overlap.
 */

/** `at` timestamp of the lollipop the user tapped (its details show below the line), or null. */
let selectedPopAt = null;

/** Today's decisions (local midnight to midnight), oldest first, each with its option and a Date. */
function todaysDecisions() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return store.decisions
    .map(d => ({ ...d, date: new Date(d.at), option: store.options.find(o => o.id === d.optionId) }))
    .filter(d => d.option && d.date >= start && d.date < end)
    .sort((a, b) => a.date - b.date);
}

/** How far through the day a time is, from 0 (midnight) to 1 (next midnight). */
const dayFrac = d => (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400;

/** Rebuild the whole Today card. */
function renderDay() {
  const today = todaysDecisions();
  const now = new Date();
  $('day-count').textContent =
    `${today.length} decision${today.length === 1 ? '' : 's'} · ${now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}`;

  // Choose a height level for each lollipop so close ones don't overlap.
  // Going left to right, each lollipop takes the lowest level whose previous
  // lollipop is at least MIN_GAP away; if none is free, it starts a new level (max 5).
  const MIN_GAP = 0.025; // 2.5% of a day ≈ 36 minutes
  const lastAtLevel = [];  // lastAtLevel[level] = x position of the latest lollipop on that level
  const placed = today.map(d => {
    const x = dayFrac(d.date);
    let level = lastAtLevel.findIndex(prev => x - prev >= MIN_GAP);
    if (level === -1) level = lastAtLevel.length;
    level = Math.min(level, 4);
    lastAtLevel[level] = x;
    return { ...d, x, level };
  });

  // Base line, the "already passed" tint, hour labels (every 3h; the in-between
  // ones are marked "minor" and hidden on phones by CSS), and the "now" marker.
  let html = '<div class="axis"></div>';
  html += `<div class="past" style="width:${dayFrac(now) * 100}%"></div>`;
  for (let h = 0; h <= 24; h += 3) {
    html += `<div class="tick${h % 6 ? ' minor' : ''}" style="left:${h / 24 * 100}%">${String(h).padStart(2, '0')}:00</div>`;
  }
  html += `<div class="now" style="left:${dayFrac(now) * 100}%"><span>now</span></div>`;

  // The lollipops. Each is a <button> so it can be tapped/focused; the --level CSS
  // variable sets its stick height. `title` gives the hover tooltip on desktop.
  html += placed.map(d => `
    <button class="pop ${colorOf(d.optionId)}${d.at === selectedPopAt ? ' selected' : ''}"
            style="left:${d.x * 100}%; --level:${d.level}"
            data-at="${d.at}"
            title="${fmtTime(d.date)} · ${esc(d.option.name)}"
            aria-label="${fmtTime(d.date)}: ${esc(d.option.name)}">
      <span class="head"></span><span class="stick"></span>
    </button>`).join('');
  $('timeline').innerHTML = html;

  // Line under the timeline: details of the tapped lollipop, or a hint.
  // (Tapping is needed on phones, which have no hover tooltips.)
  const sel = placed.find(d => d.at === selectedPopAt);
  $('tl-detail').innerHTML = sel
    ? `<strong>${fmtTime(sel.date)}</strong> · ${esc(sel.option.name)}`
    : today.length ? 'Tap a lollipop to see what you picked.' : 'No decisions yet today.';

  // Legend: each option picked today with its count, most picked first.
  const counts = {};
  today.forEach(d => counts[d.optionId] = (counts[d.optionId] || 0) + 1);
  $('day-legend').innerHTML = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => {
      const o = store.options.find(o => o.id === id);
      return `<span><span class="dot ${colorOf(id)}"></span>${esc(o.name)} · ${n}</span>`;
    }).join('');
}

// Tapping a lollipop selects it; tapping it again clears the selection.
$('timeline').addEventListener('click', e => {
  const pop = e.target.closest('.pop');
  if (!pop) return;
  selectedPopAt = selectedPopAt === pop.dataset.at ? null : pop.dataset.at;
  renderDay();
});

// Redraw every minute so the "now" marker moves and the timeline resets at midnight.
setInterval(renderDay, 60 * 1000);
