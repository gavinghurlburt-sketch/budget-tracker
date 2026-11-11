/* ---------- Ours or Mine, and a big stat at the top of every page (iPhone build) ----------
   A glass switch at the top of every page: Ours (everything) or Mine (the signed-in person's own money: what
   they earn, spend, pay and put toward goals; things marked Shared count only under Ours). It changes the big
   stat at the top of each page, Home's chart and numbers, and the stats page. The lists further down stay
   whole, so nothing ever looks lost. Ours or Mine is remembered on this phone.
   Which person "Mine" is gets asked once per login and saved with the budget (S.logins), so it follows that
   login to any phone. Once one login is linked, the other login is the other person without asking.
   Not signed in: it's asked once and kept on this phone. */
const WHO_KEY = 'budgetrr-who', ME_KEY = 'budgetrr-me';
let whoView = 'ours'; try{ const v = localStorage.getItem(WHO_KEY); if(v === 'mine') whoView = 'mine'; }catch(e){}
const isPerson = id => S.people.some(p => p.id === id);
function myPid(){
  if(solo()) return null;
  const uid = Cloud.user && Cloud.user.id;
  if(uid){
    const links = S.logins || {};
    if(isPerson(links[uid])) return links[uid];
    const taken = Object.entries(links).filter(([u, p]) => u !== uid && isPerson(p)).map(([, p]) => p);
    const left = S.people.filter(p => !taken.includes(p.id));
    return taken.length && left.length === 1 ? left[0].id : null;   // the other login is the other person
  }
  try{ const me = localStorage.getItem(ME_KEY); if(isPerson(me)) return me; }catch(e){}
  return null;
}
function setMe(pid){
  const uid = Cloud.user && Cloud.user.id;
  if(uid){ S.logins = { ...(S.logins || {}), [uid]: pid }; commit(); }
  else { try{ localStorage.setItem(ME_KEY, pid); }catch(e){} }
}
const viewPid = () => whoView === 'mine' ? myPid() : null;
function onlyPerson(pid, keepEnvelopes){
  const src = S.sources.filter(s => s.personId === pid), ids = new Set(src.map(s => s.id));
  return { ...S, sources:src, income:S.income.filter(e => ids.has(e.sourceId)), expenses:S.expenses.filter(e => e.personId === pid),
    bills:S.bills.filter(b => b.personId === pid), contributions:S.contributions.filter(c => c.personId === pid),
    envelopes: keepEnvelopes ? S.envelopes : [] };
}
// run fn with S narrowed to the chosen person; the real budget always comes back, even on an error
function inView(fn, keepEnvelopes = true){
  const pid = viewPid(); if(!pid) return fn();
  const real = S; S = onlyPerson(pid, keepEnvelopes);
  try{ return fn(); } finally{ S = real; }
}

function whoSwitch(){
  if(solo()) return '';
  const cur = viewPid() ? 'mine' : 'ours';
  return `<div class="who-row"><div class="range-switch who-switch" role="group" aria-label="Show everyone's money or just yours" style="--n:2;--i:${cur === 'mine' ? 1 : 0}">
    <span class="range-thumb" aria-hidden="true"></span>
    <button type="button" data-action="who-view" data-who="ours" aria-pressed="${cur === 'ours'}">Ours</button>
    <button type="button" data-action="who-view" data-who="mine" aria-pressed="${cur === 'mine'}">Mine</button>
  </div></div>`;
}
function showWho(id){
  whoView = id; try{ localStorage.setItem(WHO_KEY, id); }catch(e){}
  // slide the thumb first, then redraw the numbers
  document.querySelectorAll('.who-switch').forEach(sw => {
    sw.style.setProperty('--i', id === 'mine' ? 1 : 0);
    sw.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.who === id)));
  });
  setTimeout(renderAll, 200);
}
actions['who-view'] = t => {
  const id = t.dataset.who; if(id === (viewPid() ? 'mine' : 'ours')) return;
  if(id === 'mine' && !myPid()){
    openDialog('Which one are you?', `
      <p class="muted" style="margin:0 0 14px">Mine then shows just your own money. You only pick this once${Cloud.user ? ' for this login' : ' on this phone'}.</p>
      <div class="who-pick">${S.people.map(p => `<button type="button" class="btn ghost" data-action="who-me" data-pid="${p.id}">${esc(p.name)}</button>`).join('')}</div>`);
    return;
  }
  showWho(id);
};
actions['who-me'] = t => { closeDialog(); setMe(t.dataset.pid); showWho('mine'); };

// settings: fix it later if the wrong name was picked
const settingsDialogBeforeMe = settingsDialog;
settingsDialog = function(firstRun){
  settingsDialogBeforeMe(firstRun);
  if(firstRun || solo()) return;
  const hr = dlgForm.querySelector('hr.divider'); if(!hr) return;
  const me = myPid();
  hr.insertAdjacentHTML('beforebegin', `<div class="field" style="margin-top:14px"><label for="who-me-sel">“Mine” ${Cloud.user ? 'for this login' : 'on this phone'} is</label>
    <select id="who-me-sel">${me ? '' : '<option value="">Not picked yet</option>'}${S.people.map(p => `<option value="${p.id}" ${p.id === me ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>`);
  $('#who-me-sel').addEventListener('change', e => { if(e.target.value){ setMe(e.target.value); renderAll(); toast('Got it'); } });
};

/* ---------- the big stat: a glowing ring with the number in the middle ---------- */
function heroRing(frac, tone){
  const r = 70, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac || 0));
  return `<svg class="hero-ring" viewBox="0 0 168 168" aria-hidden="true">
    <circle class="hr-track" cx="84" cy="84" r="${r}"/>
    ${f > 0 ? `<circle class="hr-arc ${tone}" cx="84" cy="84" r="${r}" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 84 84)"/>` : ''}
  </svg>`;
}
function heroHTML(o){
  return `<section class="hero hero-${o.kind}" aria-label="${esc(o.aria)}">
    <div class="hero-dial">${heroRing(o.frac, o.tone)}
      <div class="hero-mid"><b>${o.big}</b>${o.of ? `<small>${o.of}</small>` : ''}</div></div>
    <p class="hero-label">${o.label}</p>
    ${o.sub ? `<p class="hero-sub">${o.sub}</p>` : ''}
    ${o.chips && o.chips.length ? `<div class="hero-chips">${o.chips.join('')}</div>` : ''}
  </section>`;
}
const heroChip = (txt, color) => `<span class="hero-chip"><i style="background:${color}"></i>${txt}</span>`;
const soFarIn = m => (m === CUR ? 'so far in ' : 'in ') + monthName(m);

function heroIncome(){
  const m = view.month, came = monthIncome(m), usual = projectedIncome();
  const pid = viewPid();
  const chips = (!solo() && !pid && came > 0) ? S.people.map(p => heroChip(`${esc(p.name)} ${money0(personMonth(p.id, m))}`, personColor(p.id))) : [];
  return inView(() => {
    const c = monthIncome(m), u = projectedIncome();
    return heroHTML({ kind:'income', tone:'in', frac: u > 0 ? c / u : (c > 0 ? 1 : 0), big: money0(c),
      of: u > 0 ? `of about ${money0(u)}` : '', label: `came in ${soFarIn(m)}`,
      sub: !S.sources.length ? 'Add where the money comes from to see a usual month.' : (u > 0 && m === CUR && c < u ? `${money0(u - c)} more in a usual month` : (u > 0 && c >= u ? 'A full month already' : '')),
      chips: pid ? [] : chips, aria:`Came in ${soFarIn(m)}: ${money0(c)}` });
  });
}
function heroSpending(){
  const m = view.month, allSpent = monthExpenses(m), pid = viewPid();
  const env = S.envelopes || [], envTotal = sum(env.map(e => +e.amount || 0)), envUsed = sum(env.map(e => typeof envSpent === 'function' ? envSpent(e, m) : 0));
  return inView(() => {
    const spent = monthExpenses(m), usual = projectedSpending();
    let sub = '';
    if(pid) sub = allSpent > 0 ? `${Math.round(spent / allSpent * 100)}% of everything spent ${soFarIn(m)}` : '';
    else if(envTotal > 0) sub = `${money0(envUsed)} of ${money0(envTotal)} envelope money used`;
    else if(usual > 0) sub = spent <= usual ? `${money0(usual - spent)} under a usual month so far` : `${money0(spent - usual)} over a usual month`;
    return heroHTML({ kind:'spending', tone: usual > 0 && spent > usual ? 'over' : 'out', frac: usual > 0 ? spent / usual : (spent > 0 ? 1 : 0),
      big: money0(spent), of: usual > 0 ? `of about ${money0(usual)}` : '', label:`spent ${soFarIn(m)}`, sub, aria:`Spent ${soFarIn(m)}: ${money0(spent)}` });
  });
}
function heroBills(){
  const m = view.month;
  return inView(() => {
    const monthly = S.bills.filter(b => b.active !== false && b.frequency !== 'quarterly' && b.frequency !== 'yearly');
    const due = sum(monthly.map(billMonthly)), paid = sum(monthly.map(b => { const p = billPayment(b.id, m); return p ? p.amount : 0; }));
    if(!S.bills.length) return heroHTML({ kind:'bills', tone:'bill', frac:0, big:'$0', label:'no bills yet', sub:'Add rent, utilities and subscriptions to see what’s due.', aria:'No bills yet' });
    if(m !== CUR) return heroHTML({ kind:'bills', tone:'bill', frac: due > 0 ? paid / due : 0, big: money0(paid), of: `of ${money0(due)}`,
      label:`in bills paid in ${monthName(m)}`, aria:`Bills paid in ${monthName(m)}: ${money0(paid)}` });
    // the next 7 days, carrying into next month when it's near the end
    const today = +todayStr().slice(8, 10), last = daysIn(CUR), next = addMonths(CUR, 1);
    const soon = [];
    for(let k = 0; k < 7; k++){
      const d = today + k, ym = d > last ? next : CUR, day = d > last ? d - last : d;
      monthly.filter(b => (b.dueDay || 0) === day && !billPayment(b.id, ym)).forEach(b => soon.push({ b, ym, day }));
    }
    const late = monthly.filter(b => b.dueDay && b.dueDay < today && !billPayment(b.id, CUR));
    const nxt = soon[0];
    const sub = late.length ? `${late.length} bill${late.length === 1 ? '' : 's'} past the due day and not marked paid`
      : nxt ? `Next: ${esc(nxt.b.name)}, ${prettyDate(`${nxt.ym}-${pad(nxt.day)}`)}` : 'Nothing due in the next week';
    return heroHTML({ kind:'bills', tone: late.length ? 'over' : 'bill', frac: due > 0 ? paid / due : 0, big: money0(sum(soon.map(x => +x.b.amount || 0))),
      of:'due this week', label:`${money0(paid)} of ${money0(due)} paid this month`, sub, aria:`Bills due in the next 7 days` });
  });
}
function heroSaving(){
  const m = view.month;
  return inView(() => {
    const open = S.goals.filter(g => !g.done);
    if(!open.length) return heroHTML({ kind:'saving', tone:'aside', frac:0, big:'$0', label:'no goals yet', sub:'Start a goal and watch this fill up.', aria:'No goals yet' });
    const saved = sum(open.map(goalSaved)), target = sum(open.map(g => +g.target || 0)), aside = monthSetAside(m);
    return heroHTML({ kind:'saving', tone:'aside', frac: target > 0 ? saved / target : 0, big: money0(saved), of: target > 0 ? `of ${money0(target)}` : '',
      label:`saved toward ${open.length} goal${open.length === 1 ? '' : 's'}`, sub: aside > 0 ? `${money0(aside)} set aside ${soFarIn(m)}` : `Nothing set aside ${soFarIn(m)} yet`,
      aria:`Saved toward goals: ${money0(saved)}` });
  });
}

/* ---------- Home and the stats page follow the switch too ---------- */
const renderBandAll = renderBand;
renderBand = () => inView(renderBandAll);
const drawHomeChartAll = drawHomeChart;
drawHomeChart = () => inView(drawHomeChartAll);
const safeToSpendAll = safeToSpend;
safeToSpend = () => inView(safeToSpendAll, false);   // one person's own money: their bills and pay, no shared envelopes
const safeWhyAll = actions['safe-why'];
actions['safe-why'] = t => inView(() => safeWhyAll(t), false);
const renderHomeAll = renderHome;
renderHome = function(){
  renderHomeAll();
  const pid = viewPid(), small = pid && $('#panel-home .safe-spend small');
  if(small){ const s = safeToSpend(); small.textContent = s.month > 0 ? `${money0(s.month)} of ${personName(pid)}’s own money for the rest of ${monthName(CUR)}, after their bills` : `${personName(pid)}’s bills need ${money0(-s.month)} more than came in this month`; }
};
const renderInsightsAll = renderInsights;
renderInsights = () => {
  inView(renderInsightsAll);
  const pid = viewPid(), note = pid && $('#panel-insights .stat.in .note');
  if(note) note.textContent = 'per month, ' + personName(pid) + ' only';
};
const drawChartsAll = drawCharts;
drawCharts = () => inView(drawChartsAll);

const renderAllBeforeView = renderAll;
renderAll = function(){
  renderAllBeforeView();
  const sw = whoSwitch();
  const top = (id, html) => { const p = $('#panel-' + id); if(!p) return; const after = p.querySelector(':scope > .month-note, :scope > .stats-top + .month-note') || p.querySelector(':scope > .stats-top');
    if(after) after.insertAdjacentHTML('afterend', html); else p.insertAdjacentHTML('afterbegin', html); };
  top('income', sw + heroIncome());
  top('expenses', sw + heroSpending());
  top('bills', sw + heroBills());
  top('goals', sw + heroSaving());
  if(sw){ top('home', sw); top('insights', sw); }
};
