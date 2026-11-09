/**
 * store.js — all app data, and saving/loading it.
 *
 * Everything lives in one object, `store`, saved as JSON in the browser's
 * localStorage. It survives page reloads but stays in this browser only.
 * When moving to Django, this is the file to replace with API calls.
 *
 * DATA SHAPE
 *   store.options   — the things you can choose between
 *     [{ id, name, createdAt }]
 *       id        unique string (see newId)
 *       name      what the user typed, e.g. "Exercise"
 *       createdAt ms timestamp when it was added (options from before this field existed lack it)
 *
 *   store.decisions — one entry per Pick, in the order they were recorded (so Undo removes
 *                     the latest entry). Usually also time order, but a backdated pick (the
 *                     Decide page's "When" field) can be out of order, so sort by `at` when time matters.
 *     [{ optionId, at, candidates }]
 *       optionId    id of the option that was picked
 *       at          ISO timestamp of the pick
 *       candidates  ids of every option on the shortlist at that moment (includes the
 *                   picked one). Used by the Priorities matrix. Missing on old decisions.
 *
 *   store.sort      — the chosen sort on the Options page: 'alpha' | 'freq-asc' | 'freq-desc'
 *   store.calView   — how the Calendar shows a selected day: 'list' | 'timeline'
 *   store.matrixSort — Priorities row/column order: 'preferred' | 'picked' | 'alpha'
 *
 * WORKFLOW FOR CHANGING DATA
 *   1. modify `store` directly   2. call save()   3. call renderAll() (or a single render fn)
 */

/** localStorage key. Bump the version if the data shape ever changes incompatibly. */
const STORE_KEY = 'voter:v1'; // keeps the app's original name: renaming it would hide existing saved data

/**
 * Read the saved data, or start empty.
 * Missing fields are filled with defaults so older saved data keeps working.
 * Wrapped in try/catch because localStorage can be unavailable (e.g. private mode).
 */
function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY));
    if (data && Array.isArray(data.options)) return { decisions: [], sort: 'alpha', calView: 'list', matrixSort: 'preferred', ...data };
  } catch {}
  return { options: [], decisions: [], sort: 'alpha', calView: 'list', matrixSort: 'preferred' };
}

/** The single source of truth for the whole app. */
const store = load();

/** Persist `store` to localStorage. Call after every change. */
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch {}
}

/** Create a unique id: current time in base 36 + 5 random characters. */
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** How many times an option has been picked, in total. */
const timesPicked = id => store.decisions.filter(d => d.optionId === id).length;

/**
 * Is `name` already used by another option? (case-insensitive)
 * Pass `exceptId` when renaming, so an option doesn't clash with itself.
 */
const nameTaken = (name, exceptId) => store.options.some(o =>
  o.id !== exceptId && o.name.toLowerCase() === name.toLowerCase());

/** Number of option colours defined in styles.css (--c1 … --c8). */
const PALETTE_SIZE = 8;

/**
 * CSS class ("c1" … "c8") giving an option its colour.
 * Based on the option's position in store.options (i.e. the order it was added), so an
 * option keeps the same colour everywhere. Colours repeat after 8 options.
 */
const colorOf = optionId =>
  `c${store.options.findIndex(o => o.id === optionId) % PALETTE_SIZE + 1}`;
