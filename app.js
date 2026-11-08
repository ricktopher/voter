// ---- Tab routing via URL hash ----
const pages = ['calendar', 'decide', 'modify', 'matrix'];
function show() {
  const id = pages.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'calendar';
  pages.forEach(p => document.getElementById(p).hidden = p !== id);
  document.querySelectorAll('nav a').forEach(a =>
    a.classList.toggle('active', a.getAttribute('href') === '#' + id));
}
addEventListener('hashchange', show);
show();

// ---- Sample calendar (Nov 2026 starts on a Sunday; Monday-first grid) ----
const sampleOptions = ['Deep work', 'Exercise', 'Call a friend', 'Read'];
const grid = document.getElementById('cal-grid');
const today = new Date();
const isThisMonth = today.getFullYear() === 2026 && today.getMonth() === 10;
['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d =>
  grid.insertAdjacentHTML('beforeend', `<div class="dow">${d}</div>`));
for (let i = 0; i < 6; i++) grid.insertAdjacentHTML('beforeend', '<div></div>');
for (let d = 1; d <= 30; d++) {
  const n = (d * 7) % 4;
  const dots = Array.from({length: n}, (_, i) =>
    `<span class="dot c${(d + i) % 4 + 1}"></span>`).join('');
  const cls = isThisMonth && d === today.getDate() ? 'day today' : 'day';
  grid.insertAdjacentHTML('beforeend', `<div class="${cls}">${d}<div class="dots">${dots}</div></div>`);
}
document.getElementById('cal-legend').innerHTML = sampleOptions
  .map((o, i) => `<span><span class="dot c${i + 1}"></span>${o}</span>`).join('');

// ---- Sample priority matrix ----
const opts = ['Deep work', 'Exercise', 'Friend', 'Read'];
const wins = [[0,.7,.4,.8],[.3,0,.5,.6],[.6,.5,0,.7],[.2,.4,.3,0]];
let html = '<tr><th></th>' + opts.map(o => `<th>${o}</th>`).join('') + '</tr>';
opts.forEach((o, r) => {
  html += `<tr><th class="rowh">${o}</th>` + opts.map((_, c) => {
    if (r === c) return '<td class="self">—</td>';
    const v = wins[r][c];
    return `<td class="${v > .5 ? 'hi' : ''}" style="--v:${v}">${Math.round(v*100)}%</td>`;
  }).join('') + '</tr>';
});
document.getElementById('matrix-table').innerHTML = html;
