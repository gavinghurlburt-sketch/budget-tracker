/* ---------- Money coach (iPhone build) ----------
   Ask questions about your own budget ("can we afford a $400 trip in March?") and get a short, plain answer.
   The app sends Claude a compact summary (monthly totals, categories, bills, envelopes, goals), never the raw
   list of entries or notes, through the budget-coach edge function, which keeps the API key and counts each
   household's monthly allowance. Needs a signed-in household; the answers are only kept while the sheet is open. */
const COACH_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z"/><path d="M18.5 15.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"/></svg>';
const COACH_STARTERS = ['How are we doing this month?', 'Can we afford a $400 trip next month?', 'Why was last month tight?', 'Where could we cut back?'];
let coachChat = [], coachLeft = null, coachBusy = false;

function coachSummary(){
  const r = n => Math.round(+n || 0), ymNow = CUR;
  const months = Array.from({ length:12 }, (_, i) => addMonths(ymNow, -11 + i))
    .map(m => ({ month:m, cameIn:r(monthIncome(m)), wentOut:r(monthExpenses(m)), setAside:r(monthSetAside(m)) }))
    .filter(m => m.cameIn || m.wentOut || m.setAside);
  const catMonths = [...FULL_MONTHS].reverse().concat(ymNow);
  const byCategory = {};
  catMonths.forEach(m => { const t = {}; S.expenses.filter(e => ymOf(e.date) === m).forEach(e => { const c = e.category || 'Other'; t[c] = r((t[c] || 0) + e.amount); }); if(Object.keys(t).length) byCategory[m] = t; });
  const safe = safeToSpend();
  return {
    today: todayStr(), daysLeftInMonth: safe.daysLeft, people: S.people.map(p => p.name),
    thisMonth: { cameIn:r(safe.cameIn), wentOut:r(safe.wentOut), setAside:r(safe.aside), steadyPayStillComing:r(safe.payToCome),
      billsStillToPay:r(safe.billsToPay), envelopeMoneyUnspent:r(safe.envLeft), safeToSpendRestOfMonth:r(safe.month), safeToSpendPerDay:r(Math.max(0, safe.today)) },
    monthlyTotals: months, spendingByCategory: byCategory,
    forecastPerMonth: { income:r(projectedIncome()), bills:r(projectedBills()), everydaySpending:r(averageEverydaySpending()) },
    incomeSources: S.sources.filter(s => s.active !== false).map(s => ({ who:personName(s.personId), name:s.name, kind:TYPES[s.type] || s.type, pay:s.kind === 'fixed' ? 'steady' : 'varies', perMonth:r(projectSource(s)) })),
    bills: S.bills.filter(b => b.active !== false).map(b => ({ name:b.name, amount:r(b.amount), frequency:b.frequency, dueDay:b.dueDay || null, paidThisMonth:!!billPayment(b.id, ymNow) })),
    envelopes: (S.envelopes || []).map(e => ({ name:e.name, perMonth:r(e.amount), spentThisMonth:r(envSpent(e, ymNow)) })),
    goals: S.goals.filter(g => !g.done).map(g => ({ name:g.name, target:r(g.target), saved:r(goalSaved(g)) }))
  };
}

// a wide glass button under the log buttons on Home
const renderHomeBeforeCoach = renderHome;
renderHome = function(){
  renderHomeBeforeCoach();
  const acts = $('#panel-home .home-actions'); if(!acts) return;
  acts.insertAdjacentHTML('afterend', `<button type="button" class="coach-open" data-action="coach-open">
    <span class="coach-ic">${COACH_IC}</span><span class="coach-txt"><b>Ask the money coach</b><small>"Can we afford…?" "Why was October tight?"</small></span>
    <svg class="coach-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>`);
};

function coachBody(){
  const esc2 = t => esc(t).replace(/\n/g, '<br>');
  const turns = coachChat.map(t => `<div class="coach-q">${esc(t.q)}</div>${t.a == null ? '<div class="coach-a coach-wait"><span></span><span></span><span></span></div>' : `<div class="coach-a ${t.err ? 'err' : ''}">${esc2(t.a)}</div>`}`).join('');
  return `<div class="coach-chat" id="coach-chat">${turns || '<p class="coach-hello">Ask anything about your money. I look at your totals, bills, envelopes and goals, and answer in a few sentences.</p>'}</div>
    ${coachChat.length ? '' : `<div class="coach-starters">${COACH_STARTERS.map(q => `<button type="button" class="coach-chip" data-action="coach-ask-chip">${esc(q)}</button>`).join('')}</div>`}
    <div class="coach-ask"><input id="coach-q" name="q" maxlength="500" placeholder="Ask about your money" autocomplete="off" enterkeyhint="send"><button type="submit" class="btn" ${coachBusy ? 'disabled' : ''}>Ask</button></div>
    <small class="coach-left">${coachLeft == null ? '' : `${coachLeft} question${coachLeft === 1 ? '' : 's'} left this month`}</small>`;
}
function coachRefresh(){
  const body = dlgForm.querySelector('.dlg-body'); if(!body || !dlg.open || !body.querySelector('.coach-chat')) return;
  const typed = ($('#coach-q') || {}).value || '';
  body.innerHTML = coachBody();
  const inp = $('#coach-q'); if(inp && !coachBusy){ inp.value = typed; }
  const chat = $('#coach-chat'); if(chat) chat.scrollTop = chat.scrollHeight;
}
async function coachAsk(q){
  q = String(q || '').trim(); if(!q || coachBusy) return;
  if(!(Cloud.user && Cloud.householdId)){ toast('Sign in to your household in Settings to use the coach.'); return; }
  coachBusy = true; const turn = { q, a:null }; coachChat.push(turn); coachRefresh();
  try{
    const history = coachChat.filter(t => t !== turn && t.a != null && !t.err).slice(-3).map(t => ({ q:t.q, a:t.a }));
    const { data, error } = await Cloud.client.functions.invoke('budget-coach', { body:{ householdId:Cloud.householdId, question:q, summary:coachSummary(), history, month:CUR } });
    if(error){ let msg = error.message; try{ const j = await error.context.json(); if(j){ if(j.error) msg = j.error; if(j.left === 0) coachLeft = 0; } }catch(_){ } throw new Error(/not found|failed to send/i.test(msg) ? 'The money coach isn\'t switched on yet.' : msg); }
    if(data.error) throw new Error(data.error);
    turn.a = data.answer; if(typeof data.left === 'number') coachLeft = data.left;
  }catch(e){ turn.a = e.message || 'Couldn\'t reach the coach.'; turn.err = true; }
  coachBusy = false; coachRefresh();
}
actions['coach-open'] = () => {
  if(!(Cloud.user && Cloud.householdId)){ toast('Sign in to your household in Settings to use the coach.'); return; }
  openDialog('Money coach', coachBody(), fd => { coachAsk(fd.get('q')); return false; });
  dlgForm.classList.add('coach-sheet');
  dlg.addEventListener('close', () => dlgForm.classList.remove('coach-sheet'), { once:true });
};
actions['coach-ask-chip'] = t => coachAsk(t.textContent);
