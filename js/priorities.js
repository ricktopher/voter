/**
 * priorities.js — the Priorities page: a heatmap of head-to-head preferences.
 *
 * HOW TO READ IT
 * Each circle is a sentence: "I would rather <column> than <row>", filled by how often
 * that was true. Darker = more often. A hollow circle means those two have never been
 * shortlisted together. Tap a circle to see the exact numbers.
 *
 * HOW IT'S CALCULATED
 * Only real head-to-heads count. A decision's `candidates` is the shortlist it was
 * picked from; the picked option "beats" each OTHER option on that shortlist, and
 * nothing else. Example: shortlist [Exercise, Read, Call a friend], pick Exercise →
 * Exercise beat Read, Exercise beat Call a friend.
 *
 * For any pair (a, b):
 *   share of times a won = times a beat b / (times a beat b + times b beat a)
 *
 * Decisions without a usable shortlist (made before shortlists existed, or picked
 * from a shortlist of one) are ignored here, but still count on the other pages.
 */

/** The tapped circle, as "columnId:rowId", or null. Its numbers show under the table. */
let matrixSelected = null;

/**
 * Count head-to-head wins between every pair of options.
 *
 * @returns {{opts: Array, picks: number[][]}}
 *   opts          = store.options (indices below refer to positions in this array)
 *   picks[a][b]   = number of times option a was picked while b was also on the shortlist
 */
function pairwise() {
  const opts = store.options;
  const index = new Map(opts.map((o, i) => [o.id, i])); // option id → position, for fast lookup
  const n = opts.length;
  const beat = Array.from({ length: n }, () => Array(n).fill(0)); // n×n grid of zeros
  for (const d of store.decisions) {
    const a = index.get(d.optionId);
    if (a === undefined || !Array.isArray(d.candidates)) continue; // deleted option, or no shortlist saved
    for (const id of d.candidates) {
      const b = index.get(id);
      if (b !== undefined && b !== a) beat[a][b]++; // skip deleted options and the pick itself
    }
  }
  return { opts, picks: beat };
}

/** Rebuild the matrix table (or the "nothing to compare" message). */
function renderMatrix() {
  const table = $('matrix-table');
  const { opts, picks } = pairwise();
  const total = i => picks[i].reduce((s, x) => s + x, 0); // all head-to-head wins for option i

  // Order rows and columns the same way: most picked overall first (ties A–Z),
  // so the strongest options sit top-left.
  const order = opts.map((_, i) => i)
    .sort((a, b) => timesPicked(opts[b].id) - timesPicked(opts[a].id) ||
                    byName(opts[a], opts[b]));

  // Without any head-to-heads there's nothing to draw. Explain why instead.
  const hasData = opts.length >= 2 && order.some(i => total(i) > 0);
  $('matrix-empty').hidden = hasData;
  $('matrix-scale').hidden = !hasData;
  $('matrix-detail').hidden = !hasData;
  $('matrix-empty').textContent = opts.length < 2
    ? 'Add at least two options to compare them.'
    : 'Nothing to compare yet. On the Decide page, shortlist two or more options and pick one.';
  if (!hasData) { table.innerHTML = ''; return; }

  // Two header rows: "I would rather…" spanning the columns, then the column names
  // (with "than…" in the corner above the row names).
  let html =
    `<tr><th></th><th class="axis axis-col" colspan="${opts.length}">I would rather…</th></tr>` +
    '<tr><th class="axis axis-row">than…</th>' +
    // Column names are drawn at 45° (see .colh in styles.css) so every cell can be a square.
    order.map(c => `<th class="colh" title="${esc(opts[c].name)}"><span>${esc(opts[c].name)}</span></th>`).join('') + '</tr>';

  // One row per option. Cell (row r, column c) = how often c beat r.
  // One row per option. Cell (row r, column c) = how often c beat r, drawn as a circle:
  // the fill gets darker the more often c won; a hollow circle means no data yet.
  // The exact numbers show in the tooltip, and in the line under the table when tapped.
  let selected = null; // the tapped cell's sentence, if it's still in the table
  order.forEach(r => {
    const than = opts[r].name;
    html += `<tr><th class="rowh">${esc(than)}</th>` + order.map(c => {
      if (r === c) return '<td class="self"></td>'; // an option vs itself
      const rather = opts[c].name;
      const key = `${opts[c].id}:${opts[r].id}`;
      const won = picks[c][r], lost = picks[r][c], n = won + lost;
      const text = n
        ? `I would rather <strong>${esc(rather)}</strong> than <strong>${esc(than)}</strong>: ` +
          `${won} of ${n} time${n === 1 ? '' : 's'} (${Math.round(won / n * 100)}%)`
        : `<strong>${esc(rather)}</strong> and <strong>${esc(than)}</strong> haven’t been shortlisted together yet`;
      const plain = text.replace(/<[^>]+>/g, ''); // same sentence without the <strong> tags
      const isSel = key === matrixSelected;
      if (isSel) selected = text;
      // --v (0–1) drives the circle's fill intensity in CSS.
      return `<td${n ? '' : ' class="nodata"'}>
        <button class="circle${isSel ? ' selected' : ''}" data-key="${key}" ${n ? `style="--v:${won / n}"` : ''}
                title="${plain}" aria-label="${plain}"></button></td>`;
    }).join('') + '</tr>';
  });
  table.innerHTML = html;
  $('matrix-detail').innerHTML = selected || 'Tap a circle to see the numbers.';

  // Make the header row tall enough for the longest slanted name.
  // A 45° label of width w needs about w × sin 45° ≈ 0.71·w of height. The width is
  // estimated from character count (≈7.5px per character, capped at the CSS max-width
  // of 160px) rather than measured, because this page is often hidden while rendering,
  // and hidden elements measure as 0.
  const longestChars = Math.max(...opts.map(o => o.name.length));
  const labelWidth = Math.min(160, longestChars * 7.5);
  table.style.setProperty('--colh-h', `${Math.ceil(labelWidth * 0.71) + 16}px`);
}

// Tapping a circle shows its sentence and numbers under the table; tapping it again clears it.
$('matrix-table').addEventListener('click', e => {
  const btn = e.target.closest('button.circle');
  if (!btn) return;
  matrixSelected = matrixSelected === btn.dataset.key ? null : btn.dataset.key;
  renderMatrix();
});
