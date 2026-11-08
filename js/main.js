/**
 * main.js — loaded last. Ties the pages together and does the first render.
 */

/**
 * Re-render every page that shows data from `store`.
 * Call this after any change that affects more than one page (adding, renaming or
 * deleting an option; picking; undoing). For a change that only affects one page,
 * calling that page's own render function is enough.
 */
function renderAll() {
  renderOptions();  // options.js
  renderDecide();   // decide.js
  renderDay();      // timeline.js
  renderMatrix();   // priorities.js
}

// First render, now that every file has loaded.
renderAll();
renderCalendar(new Date().getFullYear(), new Date().getMonth()); // no data yet, see calendar.js
