/**
 * decide.js — the Decide page: build a shortlist, pick one, undo.
 *
 * HOW DECIDING WORKS
 *   1. In "All options", tap the options that are realistic right now → they go on the shortlist.
 *   2. In "Choosing between", press Pick on one of them.
 *   3. A decision is saved: { optionId, at, candidates }, where `candidates` is the
 *      whole shortlist. The Priorities page uses it to see what beat what.
 *
 * A pick is one raw decision with no duration attached (not "the next hour").
 * The shortlist itself is NOT saved; it resets on reload and after every pick.
 * The "Today" timeline below the card lives in timeline.js.
 */

/** Ids of the options currently on the shortlist, in the order they were added. */
let shortlist = [];
/** Id of the option just picked, so its row can flash once on the next render. */
let justPickedId = null;
/** Timer that hides the "Recorded: X" note after a few seconds. */
let recordedTimer = null;
/**
 * Has the user changed the "When" field? While false, the field follows the clock and
 * a pick uses the exact current time. Once true, a pick uses the time they chose.
 */
let whenEdited = false;

// ---- "When" field (time of the decision) ----

/** Format a Date for a datetime-local input: "YYYY-MM-DDTHH:MM" in local time. */
function toLocalInput(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Show or hide the When row, and keep it on the current time unless the user changed it. */
function renderWhen() {
  const input = $('when-input');
  $('when-row').hidden = shortlist.length === 0;
  input.max = toLocalInput(new Date());     // no picking a time in the future
  if (!whenEdited) input.value = toLocalInput(new Date());
  input.classList.toggle('edited', whenEdited);
  $('when-now').hidden = !whenEdited;
}

/** Go back to "now" mode (after a pick, or when Now is pressed). */
function resetWhen() {
  whenEdited = false;
  $('when-input').setCustomValidity('');
  renderWhen();
}

/**
 * The time to record for a pick: exactly now if the field is untouched, otherwise the
 * chosen time. Returns null (and shows the browser's error bubble) if the chosen time is
 * empty or in the future.
 */
function chosenTime() {
  if (!whenEdited) return new Date();
  const input = $('when-input');
  const t = new Date(input.value); // datetime-local values parse as local time
  const problem = isNaN(t) ? 'Pick a date and time.'
    : t > new Date() ? 'A decision can’t be in the future.' : '';
  input.setCustomValidity(problem);
  if (problem) { input.reportValidity(); return null; }
  return t;
}

$('when-input').addEventListener('input', () => {
  whenEdited = true;
  $('when-input').setCustomValidity('');
  renderWhen();
});
$('when-now').addEventListener('click', resetWhen);
// Keep the untouched field showing the current minute.
setInterval(() => { if (!whenEdited) renderWhen(); }, 30 * 1000);

/** All options whose name contains the filter text (case-insensitive), A–Z. */
function filteredOptions() {
  const q = $('filter-input').value.trim().toLowerCase();
  return [...store.options]
    .filter(o => o.name.toLowerCase().includes(q))
    .sort(byName);
}

/**
 * Show the brief "Recorded: X" confirmation after a pick; it hides itself after 6 seconds.
 * For a backdated pick, pass its time so the note says when it was recorded for.
 */
function showRecorded(option, at = null) {
  clearTimeout(recordedTimer); // restart the countdown if they pick again quickly
  const when = !at ? ''
    : ` at ${at.toDateString() === new Date().toDateString()
        ? fmtTime(at)
        : at.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' ' + fmtTime(at)}`;
  $('recorded').innerHTML = `<span>Recorded: <strong>${esc(option.name)}</strong>${when}</span>`;
  $('recorded').hidden = false;
  recordedTimer = setTimeout(hideRecorded, 6000);
}

/** Hide the "Recorded: X" note right away. */
function hideRecorded() {
  clearTimeout(recordedTimer);
  $('recorded').hidden = true;
}

/** Rebuild the whole Decide card (shortlist box, option list, Undo button) from current state. */
function renderDecide() {
  const hasOptions = store.options.length > 0;
  shortlist = shortlist.filter(id => store.options.some(o => o.id === id)); // drop options deleted meanwhile
  $('decide-empty').hidden = hasOptions;   // "No options yet" message
  $('decide-body').hidden = !hasOptions;   // everything else

  // "Choosing between": the shortlisted options, each with ✕ (remove) and Pick.
  const chosen = shortlist.map(id => store.options.find(o => o.id === id));
  $('shortlist-hint').hidden = chosen.length > 0;
  $('clear-shortlist').hidden = chosen.length === 0;
  $('shortlist-list').innerHTML = chosen.map(o => `
    <li data-id="${o.id}">
      <span class="name">${esc(o.name)}</span>
      <span class="actions">
        <button class="ghost small" data-action="unlist" aria-label="Remove ${esc(o.name)} from shortlist">✕</button>
        <button class="primary" data-action="pick">Pick</button>
      </span>
    </li>`).join('');

  // "All options": every option matching the filter. Tapping a row toggles it on the
  // shortlist; shortlisted rows are highlighted and show ✓ instead of +.
  const list = filteredOptions();
  $('decide-nomatch').hidden = list.length > 0;
  $('decide-nomatch').textContent = `No options match “${$('filter-input').value.trim()}”.`;
  $('decide-list').innerHTML = list.map(o => {
    const on = shortlist.includes(o.id);
    const cls = [on && 'selected', o.id === justPickedId && 'just-picked'].filter(Boolean).join(' ');
    return `
    <li data-id="${o.id}"${cls ? ` class="${cls}"` : ''}>
      <button class="option-toggle" data-action="toggle" aria-pressed="${on}">
        <span class="name">${esc(o.name)}</span>
        <span class="mark">${on ? '✓' : '+'}</span>
      </button>
    </li>`;
  }).join('');
  justPickedId = null; // only flash once
  renderWhen();
  renderUndo();
}

/** Add an option to the shortlist, or remove it if it's already there. */
function toggleShortlist(id) {
  shortlist = shortlist.includes(id) ? shortlist.filter(x => x !== id) : [...shortlist, id];
  renderDecide();
}

/**
 * Update the "↶ Undo X" button. It always targets the most recent decision,
 * even one from an earlier day, and is hidden when there are none.
 */
function renderUndo() {
  const last = store.decisions[store.decisions.length - 1];
  const option = last && store.options.find(o => o.id === last.optionId);
  $('undo-last').hidden = !option;
  if (!option) return;
  // Tooltip shows just the time for today's picks, date + time for older ones.
  const date = new Date(last.at);
  const when = date.toDateString() === new Date().toDateString()
    ? fmtTime(date)
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' ' + fmtTime(date);
  $('undo-last').innerHTML = `↶ Undo <em>${esc(option.name)}</em>`;
  $('undo-last').title = `Remove your last decision: ${option.name} at ${when}`;
}

/**
 * Record a decision for `optionId` at the time in the When field, together with the
 * current shortlist, then reset for the next one.
 * Decisions are appended in the order they're recorded (not sorted by time), so Undo
 * always removes the one just entered, even if it was backdated.
 */
function pick(optionId) {
  const when = chosenTime();
  if (!when) return; // invalid time: the error bubble is already showing
  store.decisions.push({ optionId, at: when.toISOString(), candidates: [...shortlist] });
  save();
  justPickedId = optionId;
  shortlist = [];
  $('filter-input').value = '';
  const backdated = whenEdited;
  resetWhen();
  renderAll(); // counts, timeline and matrix all change
  showRecorded(store.options.find(o => o.id === optionId), backdated ? when : null);
}

// ---- Filter box ----
$('filter-input').addEventListener('input', renderDecide);
$('filter-input').addEventListener('keydown', e => {
  // Shortcut: when the filter matches exactly one option, Enter toggles it on the shortlist.
  if (e.key !== 'Enter') return;
  const list = filteredOptions();
  if (list.length !== 1) return;
  toggleShortlist(list[0].id);
  $('filter-input').value = '';
  renderDecide();
});

// ---- Clicks (event delegation: one listener per list, see options.js for the pattern) ----
$('decide-list').addEventListener('click', e => {
  const btn = e.target.closest('button[data-action="toggle"]');
  if (btn) toggleShortlist(btn.closest('li').dataset.id);
});

$('shortlist-list').addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.closest('li').dataset.id;
  if (btn.dataset.action === 'pick') pick(id);
  if (btn.dataset.action === 'unlist') toggleShortlist(id);
});

$('clear-shortlist').addEventListener('click', () => {
  shortlist = [];
  resetWhen();
  renderDecide();
});

// ---- Undo: remove the most recent decision ----
$('undo-last').addEventListener('click', () => {
  if (!store.decisions.length) return;
  store.decisions.pop();
  save();
  hideRecorded();
  selectedPopAt = null; // the timeline's selected lollipop may have been the one removed
  renderAll();
});

// Leaving the page hides the "Recorded" note, so it isn't stale when you come back.
addEventListener('hashchange', hideRecorded);
