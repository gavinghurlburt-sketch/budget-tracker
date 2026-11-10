/* ---------- Home tab (iPhone build) ----------
   The first thing you see: how the month is going (verdict and wave chart), then envelopes, then three big buttons to log money.
   The buttons open the very same forms the Income, Expenses and Goals pages use, in a sheet,
   and the app's own save code stores them, so nothing here saves data on its own. */
const HOME_IC = {
  out:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 15.5v-7M8.8 11.4 12 8.2l3.2 3.2"/></svg>',
  in:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 8.5v7M8.8 12.6 12 15.8l3.2-3.2"/></svg>',
  goal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>'
};
const rangeSwitch = id => `<div class="range-switch" id="${id}" role="group" aria-label="Chart range"><span class="range-thumb" aria-hidden="true"></span><button type="button" data-range="30d">30 days</button><button type="button" data-range="3m">3 months</button><button type="button" data-range="1y">1 year</button></div>`;

function renderHome(){
  const el = $('#panel-home'); if(!el) return;
  const hasData = S.income.length || S.expenses.length;
  el.innerHTML = `
    <div class="card gap-card home-chart">
      <div class="gap-head"><p class="wave-verdict" hidden></p>${hasData ? rangeSwitch('home-range') : ''}</div>
      ${hasData ? `<div class="chart-box"><canvas id="ch-home" aria-label="Wave chart of money left over: income minus spending, as a running total"></canvas></div>
      <div class="gap-key"><span><i class="k-in"></i>Above $0: money left over</span><span><i class="k-out"></i>Below $0: spent more than came in</span><span class="k-note">Each point is what's left over so far that month. Past the bright line is the forecast.</span></div>`
      : `<div class="empty-note" style="margin-top:10px">Log some income and spending and your waves show up here.</div>`}
    </div>
    <div class="home-actions">
      <button type="button" class="home-act out" data-action="home-log-expense">${HOME_IC.out}<span>Log expense</span></button>
      <button type="button" class="home-act in" data-action="home-log-income">${HOME_IC.in}<span>Log income</span></button>
      <button type="button" class="home-act aside" data-action="home-add-to-goal">${HOME_IC.goal}<span>Add to a goal</span></button>
    </div>`;
  if(view.tab === 'home') requestAnimationFrame(drawHomeChart);
}
function drawHomeChart(){
  if(view.tab !== 'home') return;
  destroyCharts();
  drawWave($('#ch-home'), $('#home-range'), drawHomeChart);
}
// Home renders along with every other page
const renderAllPages = renderAll;
renderAll = function(){ renderAllPages(); renderHome(); };
window.addEventListener('resize', () => { if(view.tab === 'home') charts.forEach(c => c.resize()); });

// any other sheet that opens (a receipt scan, a goal) is a different form, so it never saves as a quick log
const openDialogBase = openDialog;
openDialog = function(...args){ delete dlgForm.dataset.form; return openDialogBase(...args); };

// Log income / Log expense: copy the page's own form into a sheet. The page form is the source,
// so the sheet always has exactly the same fields and choices, and the app's normal submit code saves it.
function quickLogSheet(kind){
  const page = kind === 'log-income' ? 'income' : 'expenses';
  const src = document.querySelector(`#panel-${page} form[data-form="${kind}"]`);
  if(!src){ toast('Add where your income comes from first.'); view.tab = 'income'; renderAll(); return; }
  const copy = src.cloneNode(true);
  copy.querySelectorAll('h3').forEach(h => h.remove());
  copy.querySelectorAll('[id]').forEach(n => { n.id = 'q-' + n.id; });
  copy.querySelectorAll('label[for]').forEach(l => { l.htmlFor = 'q-' + l.htmlFor; });
  // the save button moves to the bottom of the sheet, with Cancel beside it, like every other sheet
  const save = copy.querySelector('button[type="submit"]');
  if(save){ save.remove(); const bar = document.createElement('div'); bar.className = 'dlg-actions';
    bar.innerHTML = '<button type="button" class="btn ghost" data-action="close-dialog">Cancel</button>'; bar.appendChild(save); copy.appendChild(bar); }
  openDialog(kind === 'log-income' ? 'Log income' : 'Log expense', copy.innerHTML, fd => {
    const amount = num(fd.get('amount'));
    if(isNaN(amount) || amount <= 0){ toast('Enter an amount greater than zero.'); return false; }
    if(!fd.get('date')){ toast('Pick a date.'); return false; }
    // valid: the sheet closes, and the app's own submit code (the one the page form uses) saves it
  });
  // last-used choices carry over from the page (source, category, who paid); the date starts at today
  src.querySelectorAll('select').forEach(o => { const c = dlgForm.querySelector(`select[name="${o.name}"]`); if(c) c.value = o.value; });
  const d = dlgForm.querySelector('input[name="date"]'); if(d) d.value = todayStr();
  dlgForm.dataset.form = kind;
  dlg.addEventListener('close', () => { delete dlgForm.dataset.form; }, { once:true });
  const amt = dlgForm.querySelector('input[name="amount"]'); if(amt) amt.focus();
}
// "Put toward a goal" in the income sheet shows its goal list, same as on the Income page
document.addEventListener('change', e => { if(e.target.id === 'q-li-togoal'){ const sel = $('#q-li-goal'); if(sel) sel.hidden = !e.target.checked; } });

// Add to a goal: pick the goal, then the same "Add money to…" sheet the Goals page opens
function goalPickSheet(){
  const open = S.goals.filter(g => !g.done);
  if(!open.length){ goalEditDialog(null); toast('Make a goal first, then add money to it.'); return; }
  if(open.length === 1){ contribDialog(open[0]); return; }
  openDialog('Add to which goal?', `<div class="goal-pick">${open.map(g => `
    <button type="button" class="goal-pick-btn" data-action="add-contrib" data-id="${g.id}">
      <span class="gp-emoji">${esc(g.emoji || '🎯')}</span><span class="gp-name">${esc(g.name)}</span>
      <span class="gp-saved">${money0(goalSaved(g))}${g.target > 0 ? ' of ' + money0(g.target) : ''}</span></button>`).join('')}</div>`, null);
}
actions['home-log-expense'] = () => quickLogSheet('log-expense');
actions['home-log-income'] = () => quickLogSheet('log-income');
actions['home-add-to-goal'] = () => goalPickSheet();

