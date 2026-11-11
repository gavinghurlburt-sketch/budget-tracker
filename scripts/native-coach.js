/* ---------- Money coach (iPhone build) ----------
   Ask questions about your own budget ("can we afford a $400 trip in March?") and get a short, plain answer.
   The app sends Claude a compact summary (monthly totals, categories, bills, envelopes, goals), never the raw
   list of entries or notes, through the budget-coach edge function, which keeps the API key and counts each
   household's monthly allowance. Needs a signed-in household. The chat is only kept while the pop-up is open, but when an answer has
   advice worth keeping, its one-line takeaway is saved under Money tips (S.coachTips, synced to the household). */
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

const coachTips = () => Array.isArray(S.coachTips) ? S.coachTips : [];
let coachView = 'ask';
// the coach lives in a floating glass coin at the bottom right of every page; tapping it grows into the chat
function coachBubble(){
  if(document.getElementById('coach-bubble')) return;
  document.body.insertAdjacentHTML('beforeend', `<button type="button" id="coach-bubble" class="coach-bubble" data-action="coach-open" aria-label="Ask the money coach"><span class="cb-rim"></span><span class="cb-face">${COACH_IC}</span><span class="cb-shine"></span></button>`);
}
const renderAllBeforeCoach = renderAll;
renderAll = function(){ renderAllBeforeCoach(); coachBubble(); };

function coachSeg(){
  const n = coachTips().length;
  return `<div class="coach-seg" role="group" aria-label="Coach">
    <button type="button" data-action="coach-view" data-v="ask" aria-pressed="${coachView === 'ask'}">Ask</button>
    <button type="button" data-action="coach-view" data-v="tips" aria-pressed="${coachView === 'tips'}">Money tips${n ? ` <em>${n}</em>` : ''}</button></div>`;
}
function coachTipsBody(){
  const tips = coachTips(), fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' });
  return `${coachSeg()}<div class="coach-chat coach-tips" id="coach-chat">${tips.length ? tips.map(t => `
    <div class="coach-tip"><p>${esc(t.tip)}</p><small>${fmt(t.date)} · from "${esc(t.q)}"</small>
      <button type="button" class="coach-tip-x" data-action="coach-tip-del" data-id="${t.id}" aria-label="Remove this tip">✕</button></div>`).join('')
    : '<p class="coach-hello">When the coach gives you advice worth keeping, it lands here as one short line, so you can come back to it anytime.</p>'}</div>`;
}
function coachBody(){
  if(coachView === 'tips') return coachTipsBody();
  const esc2 = t => esc(t).replace(/\n/g, '<br>');
  const turns = coachChat.map(t => `<div class="coach-q">${esc(t.q)}</div>${t.a == null ? '<div class="coach-a coach-wait"><span></span><span></span><span></span></div>' : `<div class="coach-a ${t.err ? 'err' : ''}">${esc2(t.a)}</div>${t.tipSaved ? '<button type="button" class="coach-saved" data-action="coach-view" data-v="tips">Saved to Money tips</button>' : ''}`}`).join('');
  return `${coachSeg()}<div class="coach-chat" id="coach-chat">${turns || '<p class="coach-hello">Ask anything about your money. I look at your totals, bills, envelopes and goals, and answer in a few sentences.</p>'}</div>
    ${coachChat.length ? '' : `<div class="coach-starters">${COACH_STARTERS.map(q => `<button type="button" class="coach-chip" data-action="coach-ask-chip">${esc(q)}</button>`).join('')}</div>`}
    <div class="coach-ask"><input id="coach-q" name="q" maxlength="500" placeholder="Ask about your money" autocomplete="off" enterkeyhint="send"><button type="submit" class="btn" ${coachBusy ? 'disabled' : ''}>Ask</button></div>
    ${coachLeft == null ? '' : `<small class="coach-left">${coachLeft} question${coachLeft === 1 ? '' : 's'} left this month</small>`}`;
}
let coachTyped = '';
function coachRefresh(){
  const body = dlgForm.querySelector('.dlg-body'); if(!body || !dlg.open || !dlgForm.classList.contains('coach-sheet')) return;
  const inp0 = $('#coach-q'); if(inp0) coachTyped = inp0.value;
  body.innerHTML = coachBody();
  const inp = $('#coach-q'); if(inp && !coachBusy) inp.value = coachTyped;
  const chat = $('#coach-chat'); if(chat) chat.scrollTop = coachView === 'tips' ? 0 : chat.scrollHeight;
}
async function coachAsk(q){
  q = String(q || '').trim(); if(!q || coachBusy) return;
  if(!(Cloud.user && Cloud.householdId)){ toast('Sign in to your household in Settings to use the coach.'); return; }
  coachView = 'ask'; coachTyped = '';
  coachBusy = true; const turn = { q, a:null }; coachChat.push(turn); coachRefresh();
  try{
    const history = coachChat.filter(t => t !== turn && t.a != null && !t.err).slice(-3).map(t => ({ q:t.q, a:t.a }));
    const { data, error } = await Cloud.client.functions.invoke('budget-coach', { body:{ householdId:Cloud.householdId, question:q, summary:coachSummary(), history, month:CUR } });
    if(error){ let msg = error.message; try{ const j = await error.context.json(); if(j){ if(j.error) msg = j.error; if(j.left === 0) coachLeft = 0; } }catch(_){ } throw new Error(/not found|failed to send/i.test(msg) ? 'The money coach isn\'t switched on yet.' : msg); }
    if(data.error) throw new Error(data.error);
    turn.a = data.answer; if(typeof data.left === 'number') coachLeft = data.left;
    // advice worth keeping: its one-line takeaway goes under Money tips, shared with the household
    const tip = typeof data.tip === 'string' ? data.tip.trim().slice(0, 240) : '';
    if(tip){ S.coachTips = [{ id:uid(), date:todayStr(), q:q.slice(0, 120), tip }, ...coachTips()].slice(0, 40); turn.tipSaved = true; commit(); }
  }catch(e){ turn.a = e.message || 'Couldn\'t reach the coach.'; turn.err = true; }
  coachBusy = false; coachRefresh();
}
actions['coach-open'] = () => {
  if(!(Cloud.user && Cloud.householdId)){ toast('Sign in to your household in Settings to use the coach.'); return; }
  coachView = 'ask'; coachTyped = '';
  openDialog('Money coach', coachBody(), fd => { coachAsk(fd.get('q')); return false; });
  dlgForm.classList.add('coach-sheet'); dlg.classList.add('coach-dlg');
  document.body.classList.add('coach-on');
  // a floating card: it keeps to what's visible, so the question box sits right on top of the keyboard
  const vv = window.visualViewport; let base = document.documentElement.clientHeight;
  const fit = () => {
    let shrunk = 0;
    if(vv){ dlg.style.top = vv.offsetTop + 'px'; dlg.style.height = vv.height + 'px'; base = Math.max(base, vv.height); shrunk = base - vv.height; }
    // on the phone the page isn't resized, so the keyboard's own height lifts the card; anything the
    // visible area already shrank by is taken off so the card never floats too high
    const lift = Math.max(0, kbH - shrunk);
    dlg.style.setProperty('--kb', lift + 'px');
    dlg.classList.toggle('kb', kbUp || shrunk > 120);
    const chat = $('#coach-chat'); if(chat && coachView === 'ask') chat.scrollTop = chat.scrollHeight; };
  coachFit = fit;
  // tapping the dimmed area around the card closes it
  const outside = e => { if(e.target === dlg) closeDialog(); };
  dlg.addEventListener('click', outside);
  if(vv){ vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); }
  fit();
  dlg.addEventListener('close', () => {
    dlgForm.classList.remove('coach-sheet'); dlg.classList.remove('coach-dlg', 'kb'); dlg.style.top = ''; dlg.style.height = ''; dlg.style.removeProperty('--kb');
    coachFit = null; document.body.classList.remove('coach-on');
    dlg.removeEventListener('click', outside);
    if(vv){ vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); }
  }, { once:true });
};
actions['coach-ask-chip'] = t => coachAsk(t.textContent);
actions['coach-view'] = t => { coachView = t.dataset.v === 'tips' ? 'tips' : 'ask'; coachRefresh(); };
actions['coach-tip-del'] = t => { S.coachTips = coachTips().filter(x => x.id !== t.dataset.id); commit('Tip removed'); coachRefresh(); };

/* keyboard, app-wide: no arrows-and-checkmark bar above the keys. The page itself isn't resized (that left
   black corners around the keyboard); the coach card follows the visible area instead. */
let kbUp = false, kbH = 0, coachFit = null;
(function(){
  try{ const C = window.Capacitor; if(!C || !C.isNativePlatform || !C.isNativePlatform()) return;
    const K = (C.Plugins && C.Plugins.Keyboard) || C.registerPlugin('Keyboard');
    K.setAccessoryBarVisible({ isVisible:false }).catch(() => {});
    K.addListener('keyboardWillShow', info => { kbUp = true; kbH = (info && info.keyboardHeight) || 0; if(coachFit) coachFit(); });
    K.addListener('keyboardWillHide', () => { kbUp = false; kbH = 0; if(coachFit) coachFit(); });
  }catch(e){}
})();
