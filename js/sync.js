/**
 * sync.js — "Back up & sync" card on the Options page: export and import all data as JSON.
 *
 * Until there's a backend, this is how the phone and laptop share data:
 *   1. Export on device A  → saves voter-YYYY-MM-DD.json
 *   2. Move the file over (AirDrop, email, cloud drive, USB…)
 *   3. Import it on device B and choose Merge
 *   (Do the same in the other direction to bring both fully up to date.)
 *
 * MERGE vs REPLACE
 *   Merge   adds what's in the file to what's here. Nothing on this device is removed.
 *           • Options match by id, or else by name (case-insensitive), so "Exercise"
 *             created separately on both devices becomes one option.
 *           • Decisions match by option + exact timestamp, so importing the same file
 *             twice never double-counts.
 *           • Deletions don't carry over: something deleted on one device comes back
 *             if the other device still has it. Delete it on both, or use Replace.
 *   Replace overwrites everything on this device with the file's contents.
 *
 * FILE FORMAT
 *   { app: "voter", version: 1, exportedAt: ISO time,
 *     data: { options, decisions, sort, calView } }   // same shape as `store`, see store.js
 */

/** Data parsed from the chosen file, waiting for Merge / Replace / Cancel. */
let pendingImport = null;

const EXPORT_VERSION = 1;

/** Show a short result message under the buttons. `isError` turns it red. */
function showSyncStatus(msg, isError = false) {
  $('sync-status').textContent = msg;
  $('sync-status').classList.toggle('error', isError);
  $('sync-status').hidden = !msg;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ---- Export ----

/** Download all data as a JSON file named after today's date. */
function exportData() {
  const payload = {
    app: 'voter',
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      options: store.options,
      decisions: store.decisions,
      sort: store.sort,
      calView: store.calView,
    },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  a.href = url;
  a.download = `voter-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showSyncStatus(`Exported ${plural(store.options.length, 'option')} and ${plural(store.decisions.length, 'decision')}.`);
}

// ---- Import: read and check the file ----

/**
 * Check a parsed file and return clean { options, decisions, sort, calView, exportedAt }.
 * Throws an Error with a readable message if the file isn't a Voter export.
 * Accepts both the export format and a bare `store`-shaped object.
 */
function validateImport(json) {
  const data = json && json.app === 'voter' ? json.data : json;
  if (!data || !Array.isArray(data.options) || !Array.isArray(data.decisions)) {
    throw new Error('This file doesn’t look like a Voter export.');
  }
  if (json.version > EXPORT_VERSION) {
    throw new Error('This file was made by a newer version of Voter. Update the app on this device first.');
  }
  const options = data.options
    .filter(o => o && typeof o.id === 'string' && typeof o.name === 'string' && o.name.trim())
    .map(o => ({ id: o.id, name: o.name.trim(), ...(o.createdAt ? { createdAt: o.createdAt } : {}) }));
  const ids = new Set(options.map(o => o.id));
  const decisions = data.decisions
    .filter(d => d && ids.has(d.optionId) && !isNaN(new Date(d.at)))
    .map(d => ({
      optionId: d.optionId,
      at: d.at,
      ...(Array.isArray(d.candidates) ? { candidates: d.candidates.filter(id => ids.has(id)) } : {}),
    }));
  return {
    options, decisions,
    sort: data.sort, calView: data.calView,
    exportedAt: json.exportedAt,
  };
}

/** Show what's in the chosen file and the Merge / Replace / Cancel choice. */
function showImportReview(incoming) {
  const when = incoming.exportedAt
    ? ` · exported ${new Date(incoming.exportedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
    : '';
  $('import-review').innerHTML = `
    <p><strong>${plural(incoming.options.length, 'option')}</strong> and
       <strong>${plural(incoming.decisions.length, 'decision')}</strong> in this file${when}.</p>
    <div class="sync-actions">
      <button class="primary" data-import="merge" type="button">Merge into this device</button>
      <button class="ghost danger" data-import="replace" type="button">Replace everything here</button>
      <button class="ghost" data-import="cancel" type="button">Cancel</button>
    </div>
    <p class="hint-muted">Merge keeps everything on this device and adds what’s new from the file.
       Replace deletes this device’s data first.</p>`;
  $('import-review').hidden = false;
}

$('import-file').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = ''; // so choosing the same file again still triggers "change"
  if (!file) return;
  showSyncStatus('');
  try {
    pendingImport = validateImport(JSON.parse(await file.text()));
    showImportReview(pendingImport);
  } catch (err) {
    pendingImport = null;
    $('import-review').hidden = true;
    showSyncStatus(err instanceof SyntaxError ? 'That file isn’t valid JSON.' : err.message, true);
  }
});

// ---- Import: apply ----

/**
 * Merge `incoming` into `store`. Returns how many options and decisions were added.
 * See the header comment for the matching rules.
 */
function mergeImport(incoming) {
  const byId = new Map(store.options.map(o => [o.id, o]));
  const byName = new Map(store.options.map(o => [o.name.toLowerCase(), o]));
  const idMap = new Map(); // incoming option id → id on this device
  let addedOptions = 0;

  for (const o of incoming.options) {
    const match = byId.get(o.id) || byName.get(o.name.toLowerCase());
    if (match) {
      idMap.set(o.id, match.id);
    } else {
      store.options.push(o);
      byId.set(o.id, o);
      byName.set(o.name.toLowerCase(), o);
      idMap.set(o.id, o.id);
      addedOptions++;
    }
  }

  const key = d => `${d.optionId}|${new Date(d.at).getTime()}`;
  const seen = new Set(store.decisions.map(key));
  let addedDecisions = 0;
  for (const d of incoming.decisions) {
    const mapped = {
      ...d,
      optionId: idMap.get(d.optionId),
      ...(d.candidates ? { candidates: [...new Set(d.candidates.map(id => idMap.get(id)))] } : {}),
    };
    if (seen.has(key(mapped))) continue;
    seen.add(key(mapped));
    store.decisions.push(mapped);
    addedDecisions++;
  }
  return { addedOptions, addedDecisions };
}

$('import-review').addEventListener('click', e => {
  const btn = e.target.closest('button[data-import]');
  if (!btn || !pendingImport) return;
  const action = btn.dataset.import;
  const incoming = pendingImport;
  pendingImport = null;
  $('import-review').hidden = true;
  if (action === 'cancel') return showSyncStatus('Import cancelled.');

  if (action === 'replace') {
    store.options = incoming.options;
    store.decisions = incoming.decisions;
    if (incoming.sort) store.sort = incoming.sort;
    if (incoming.calView) store.calView = incoming.calView;
    showSyncStatus(`Replaced with ${plural(incoming.options.length, 'option')} and ${plural(incoming.decisions.length, 'decision')}.`);
  } else {
    const { addedOptions, addedDecisions } = mergeImport(incoming);
    showSyncStatus(addedOptions || addedDecisions
      ? `Merged: added ${plural(addedOptions, 'new option')} and ${plural(addedDecisions, 'new decision')}.`
      : 'Already up to date: nothing new in that file.');
  }

  // Keep decisions in time order: Undo removes the last one, and the timelines expect order.
  store.decisions.sort((a, b) => new Date(a.at) - new Date(b.at));
  shortlist = [];        // decide.js: may reference options that no longer exist
  selectedPopAt = null;  // timeline.js
  save();
  $('sort-select').value = store.sort;
  renderAll();
});

$('export-btn').addEventListener('click', exportData);
