/* ---------- Choosing the month (iPhone build) ----------
   The top bar is gone from every page. Home keeps the household's name and a settings gear, and under the
   wave chart a glass month pill sits above this month's numbers. Tapping the pill opens a small month grid.
   Every other page follows the month picked on Home; when that isn't this month, a note at the top of the
   page says which month it shows, with one tap back to now. */
let monthPop = false, monthPopYear = null;
const MONTH_CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
function monthPopHTML(){
  const y = monthPopYear || +view.month.slice(0, 4);
  const cells = Array.from({ length:12 }, (_, i) => {
    const ym = `${y}-${pad(i + 1)}`, name = new Date(ym + '-15T12:00:00').toLocaleDateString('en-US', { month:'short' });
    const cls = [ym === view.month ? 'on' : '', ym === CUR ? 'now' : ''].filter(Boolean).join(' ');
    return `<button type="button" class="${cls}" data-action="month-set" data-ym="${ym}" aria-pressed="${ym === view.month}">${name}</button>`;
  }).join('');
  return `<div class="month-pop" role="dialog" aria-label="Pick a month">
    <div class="month-pop-year">
      <button type="button" data-action="month-year" data-d="-1" aria-label="Previous year">‹</button>
      <b>${y}</b>
      <button type="button" data-action="month-year" data-d="1" aria-label="Next year">›</button>
    </div>
    <div class="month-pop-grid">${cells}</div>
    ${view.month !== CUR ? `<button type="button" class="month-pop-now" data-action="month-now">Back to ${monthName(CUR)}</button>` : ''}
  </div>`;
}
function monthRowHTML(){
  return `<div class="month-row">
    <button type="button" class="month-pill" data-action="month-pick" aria-expanded="${monthPop}" aria-label="Month shown: ${monthLabel(view.month)}. Tap to change.">
      ${monthLabel(view.month)}${MONTH_CHEV}</button>
    ${monthPop ? monthPopHTML() : ''}
  </div>`;
}
function refreshMonthRow(){ const r = $('#panel-home .month-row'); if(r) r.outerHTML = monthRowHTML(); }

// Home: the numbers move from the top of every page to just under the chart, with the month pill above them
const renderHomeBeforeMonth = renderHome;
renderHome = function(){
  const band = $('#band');
  if(band) band.remove(); // keep the numbers safe while Home redraws
  renderHomeBeforeMonth();
  const chart = $('#panel-home .home-chart');
  if(!chart || !band) { if(band) document.querySelector('.wrap main').before(band); return; }
  chart.insertAdjacentHTML('afterend', monthRowHTML());
  $('#panel-home .month-row').after(band);
};

// other pages: say which month they show when it isn't this one
const renderAllBeforeMonth = renderAll;
renderAll = function(){
  renderAllBeforeMonth();
  document.body.dataset.tab = view.tab;
  if(view.month === CUR) return;
  const note = `<div class="month-note"><span>Showing <b>${monthLabel(view.month)}</b></span>
    <button type="button" data-action="month-now">Back to ${monthName(CUR)}</button></div>`;
  ['income', 'expenses', 'bills', 'goals'].forEach(k => { const p = $('#panel-' + k); if(p) p.insertAdjacentHTML('afterbegin', note); });
  const top = $('#panel-insights .stats-top'); if(top) top.insertAdjacentHTML('afterend', note);
};

actions['month-pick'] = () => { monthPop = !monthPop; monthPopYear = +view.month.slice(0, 4); refreshMonthRow(); };
actions['month-year'] = t => { monthPopYear = (monthPopYear || +view.month.slice(0, 4)) + (+t.dataset.d); refreshMonthRow(); };
actions['month-set'] = t => { monthPop = false; view.month = t.dataset.ym; renderAll(); };
actions['month-now'] = () => { monthPop = false; view.month = CUR; renderAll(); };
// a tap anywhere else, or Escape, closes the month grid
document.addEventListener('click', e => { if(monthPop && !(e.target.closest && e.target.closest('.month-row'))){ monthPop = false; refreshMonthRow(); } });
document.addEventListener('keydown', e => { if(monthPop && e.key === 'Escape'){ monthPop = false; refreshMonthRow(); } });
