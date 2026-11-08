/**
 * options.js — the Options page: add, rename, delete and sort the options you choose between.
 *
 * RENDERING PATTERN (used by every page)
 * The list is never edited piece by piece. Instead, renderOptions() rebuilds the whole
 * list from `store` plus a little UI state (which row is being edited / deleted).
 * To change what's shown: update the state, then call renderOptions() again.
 *
 * Each row can be in one of three modes:
 *   normal     name · pick count · [Edit] [Delete]
 *   editing    text box · [Save] [Cancel]          (when id === editingId)
 *   confirming "Delete?" · [Yes] [No]              (when id === confirmingId)
 */

/** Id of the option currently being renamed, or null. */
let editingId = null;
/** Id of the option waiting for "Delete? Yes/No", or null. */
let confirmingId = null;

/** Options in the order chosen in the sort dropdown. Ties are broken A–Z. */
function sortedOptions() {
  const list = [...store.options]; // copy, so sorting doesn't reorder store.options (that would change colours)
  if (store.sort === 'freq-asc')  return list.sort((a, b) => timesPicked(a.id) - timesPicked(b.id) || byName(a, b));
  if (store.sort === 'freq-desc') return list.sort((a, b) => timesPicked(b.id) - timesPicked(a.id) || byName(a, b));
  return list.sort(byName);
}

/** Rebuild the options list from `store`, showing each row in its current mode. */
function renderOptions() {
  const list = sortedOptions();
  $('options-empty').hidden = list.length > 0;
  $('options-list').innerHTML = list.map(o => {
    const n = timesPicked(o.id);

    // Editing mode: inline rename box.
    if (o.id === editingId) return `
      <li class="editing" data-id="${o.id}">
        <input type="text" class="edit-input" value="${esc(o.name)}" maxlength="80" aria-label="Rename option">
        <span class="actions">
          <button class="primary" data-action="save">Save</button>
          <button class="ghost" data-action="cancel">Cancel</button>
        </span>
      </li>`;

    // Confirming mode: ask before deleting (and warn how many picks go with it).
    if (o.id === confirmingId) return `
      <li data-id="${o.id}">
        <span class="name">${esc(o.name)}</span>
        <span class="actions">
          <span class="confirm">Delete${n ? ` (and its ${n} pick${n > 1 ? 's' : ''})` : ''}?</span>
          <button class="ghost danger" data-action="confirm-delete">Yes</button>
          <button class="ghost" data-action="cancel">No</button>
        </span>
      </li>`;

    // Normal mode.
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

  // If a row is in editing mode, put the cursor in its text box, ready to type.
  const editInput = $('options-list').querySelector('.edit-input');
  if (editInput) { editInput.focus(); editInput.select(); }
}

/** Show a red message under the Add form, or hide it when msg is empty. */
function showAddError(msg) {
  $('add-error').textContent = msg;
  $('add-error').hidden = !msg;
}

// ---- Add a new option (Add button or Enter in the text box) ----
$('add-form').addEventListener('submit', e => {
  e.preventDefault(); // stop the browser from reloading the page
  const name = $('add-input').value.trim();
  if (!name) return;
  if (nameTaken(name)) return showAddError(`“${name}” is already an option.`);
  store.options.push({ id: newId(), name, createdAt: Date.now() });
  save();
  $('add-input').value = '';
  showAddError('');
  renderAll(); // the new option also appears on the Decide page
});
$('add-input').addEventListener('input', () => showAddError('')); // clear the error as soon as they type

// ---- Sort dropdown (the choice is saved, so it's remembered next visit) ----
$('sort-select').value = store.sort;
$('sort-select').addEventListener('change', e => {
  store.sort = e.target.value;
  save();
  renderOptions();
});

/**
 * Save the rename typed into a row's edit box.
 * Empty or unchanged names just leave editing mode; duplicate names show the
 * browser's built-in validation bubble and stay in editing mode.
 */
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
  renderAll(); // the name also appears on other pages
}

// ---- Row buttons ----
// One click listener on the whole list handles every row's buttons ("event delegation").
// Each button carries a data-action saying what it does; the row carries data-id.
// This keeps working after the list is rebuilt, because the listener is on the <ul>.
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
      // Remove the option and every decision where it was picked.
      store.options = store.options.filter(o => o.id !== id);
      store.decisions = store.decisions.filter(d => d.optionId !== id);
      confirmingId = null;
      save();
      return renderAll();
  }
  renderOptions();
});

// ---- Keyboard shortcuts in the rename box: Enter saves, Escape cancels ----
$('options-list').addEventListener('keydown', e => {
  if (!e.target.classList.contains('edit-input')) return;
  e.target.setCustomValidity(''); // clear any "already an option" error while typing
  if (e.key === 'Enter')  { e.preventDefault(); saveEdit(e.target.closest('li')); }
  if (e.key === 'Escape') { editingId = null; renderOptions(); }
});
