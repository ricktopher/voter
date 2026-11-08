/**
 * router.js — switches between the four pages (tabs).
 *
 * All pages live in index.html as <section> elements; only one is visible at a time.
 * The visible page is chosen by the URL hash, e.g. index.html#matrix, so the
 * browser's back/forward buttons and bookmarks work. The nav links are plain
 * <a href="#..."> links; clicking one changes the hash and triggers show().
 */

/** Section ids, in nav order. The first one is the default page. */
const pages = ['decide', 'modify', 'matrix', 'calendar'];

/** Show the section matching the current hash (or the default), and highlight its tab. */
function show() {
  const id = pages.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'decide';
  pages.forEach(p => document.getElementById(p).hidden = p !== id);
  document.querySelectorAll('nav a').forEach(a =>
    a.classList.toggle('active', a.getAttribute('href') === '#' + id));
}

addEventListener('hashchange', show);
show(); // pick the right page on first load
