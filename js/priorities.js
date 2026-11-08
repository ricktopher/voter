/**
 * priorities.js — the Priorities page: a heatmap of head-to-head preferences.
 *
 * HOW TO READ IT
 * Each square is a sentence: "I would rather <column> than <row>", plus how often
 * that was true. Darker = more often. "–" means those two have never been shortlisted together.
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
  $('matrix-empty').textContent = opts.length < 2
    ? 'Add at least two options to compare them.'
    : 'Nothing to compare yet. On the Decide page, shortlist two or more options and pick one.';
  if (!hasData) { table.innerHTML = ''; return; }

  // Two header rows: "I would rather…" spanning the columns, then the column names
  // (with "than…" in the corner above the row names).
  let html =
    `<tr><th></th><th class="axis axis-col" colspan="${opts.length}">I would rather…</th></tr>` +
    '<tr><th class="axis axis-row">than…</th>' +
    order.map(c => `<th class="colh">${esc(opts[c].name)}</th>`).join('') + '</tr>';

  // One row per option. Cell (row r, column c) = how often c beat r.
  order.forEach(r => {
    const than = opts[r].name;
    html += `<tr><th class="rowh">${esc(than)}</th>` + order.map(c => {
      if (r === c) return '<td class="self">—</td>'; // an option vs itself
      const rather = opts[c].name;
      const won = picks[c][r], lost = picks[r][c], n = won + lost;
      if (!n) return `<td class="nodata" title="No decisions between ${esc(rather)} and ${esc(than)} yet">–</td>`;
      const v = won / n; // 0–1
      const pct = Math.round(v * 100);
      // --v drives the cell's colour intensity in CSS; "hi" switches to light text on dark cells.
      return `<td class="${v > .5 ? 'hi' : ''}" style="--v:${v}"
        title="I would rather ${esc(rather)} than ${esc(than)}: ${won} of ${n} times (${pct}%)">${pct}%</td>`;
    }).join('') + '</tr>';
  });
  table.innerHTML = html;
}
