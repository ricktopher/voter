/**
 * util.js — small helpers shared by every other file.
 *
 * HOW THE JS FILES FIT TOGETHER
 * These are plain <script> files (not ES modules), loaded in order by index.html:
 *   util → store → router → options → decide → timeline → calendar → priorities → main
 * They share one global scope, so anything declared at the top level of one file
 * (e.g. `store`, `renderAll`) can be used by the others. Two rules follow:
 *   1. Never declare the same top-level name in two files (the page will fail to load).
 *   2. Code that runs immediately must only use things from files loaded before it.
 *      Code inside functions / event handlers can use anything, because it runs later.
 */

/** Shorthand for document.getElementById. */
const $ = id => document.getElementById(id);

/**
 * Escape text before inserting it into HTML.
 * Use this on ANY user-provided text (option names) that goes into innerHTML or an
 * attribute, so names like "<b>" or "Tom & Jerry" display as typed and can't break the page.
 */
const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Format a Date as a short local time, e.g. "14:32" (or "2:32 PM", depending on locale). */
const fmtTime = d => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/** Sort comparator: options A–Z by name, ignoring upper/lower case. Use as list.sort(byName). */
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
