/* ---------- Money coach (iPhone build) ----------
   Ask questions about your own budget ("can we afford a $400 trip in March?") and get a short, plain answer.
   The app sends Claude a compact summary (monthly totals, categories, bills, envelopes, goals), never the raw
   list of entries or notes, through the budget-coach edge function, which keeps the API key and counts each
   household's monthly allowance. Needs a signed-in household. The chat is only kept while the pop-up is open, but when an answer has
   advice worth keeping, its one-line takeaway is saved under Money tips (S.coachTips, synced to the household). */
const COACH_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path class="sp1" d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z"/><path class="sp2" d="M18.5 15.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"/></svg>';
// the coach knows which page it was opened from: each page gets its own starter questions, and anything typed
// there is taken to be about that page's topic. Home (and the stats page) stay general.
const COACH_PAGES = {
  home: { label:'', ph:'Ask about your money',
    hello:'Ask anything about your money. I look at your totals, bills, envelopes and goals, and answer in a few sentences.',
    q:['How are we doing this month?', 'Can we afford a $400 trip next month?', 'Why was last month tight?', 'Where could we cut back?'] },
  income: { label:'Income', ph:'Ask about your income',
    hello:'Ask me anything about your income. I look at each pay source, what came in and how steady it has been.',
    q:['How can we improve our income?', 'Any suggestions on improving our income?', 'Which pay source brings in the most?', 'How steady has our income been?'] },
  expenses: { label:'Spending', ph:'Ask about your spending',
    hello:'Ask me anything about your spending. I look at your categories, envelopes and how each month compares.',
    q:['Where can we improve our spending?', 'What did we spend the most on last month?', 'Is our spending going up or down?', 'Which category should we trim first?'] },
  bills: { label:'Bills', ph:'Ask about your bills',
    hello:'Ask me anything about your bills. I look at what each one costs, how often it comes and what is still due.',
    q:['What bills could we cut back on?', 'How much do our bills cost a year?', 'Which bills are still due this month?', 'Which bills are worth calling to lower?'] },
  goals: { label:'Saving', ph:'Ask about saving',
    hello:'Ask me anything about saving. I look at your goals, what you have set aside and what is left over each month.',
    q:['How could we save more?', 'What is a proven way to increase saving?', 'When will we reach our goals at this pace?', 'How much should we set aside each month?'] }
};
let coachChat = [], coachLeft = null, coachBusy = false, coachTopic = 'home';
const coachPageNow = () => COACH_PAGES[view.tab] ? view.tab : 'home';

function coachSummary(topic){
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
    goals: S.goals.filter(g => !g.done).map(g => ({ name:g.name, target:r(g.target), saved:r(goalSaved(g)) })),
    // asked from Income: what each pay source actually brought in over the last few months
    ...(topic === 'income' ? { incomeBySourceRecentMonths: [addMonths(ymNow, -3), addMonths(ymNow, -2), addMonths(ymNow, -1), ymNow].map(m => ({ month:m,
      bySource: Object.fromEntries(S.sources.map(s => [s.name, r(sourceMonth(s.id, m))]).filter(x => x[1])) })) } : {})
  };
}

const coachTips = () => Array.isArray(S.coachTips) ? S.coachTips : [];
let coachView = 'ask';
// the coach lives in a floating glass coin at the bottom right of every page; tapping it grows into the chat
const COIN = `<span class="cb-rim"></span><span class="cb-face">${COACH_IC}</span><span class="cb-shine"></span>`;
function coachBubble(){
  if(!document.getElementById('coach-bubble'))
    document.body.insertAdjacentHTML('beforeend', `<button type="button" id="coach-bubble" class="coach-bubble cb-coin" data-action="coach-open" aria-label="Ask the money coach">${COIN}</button>`);
  coachNote();
}
const renderAllBeforeCoach = renderAll;
renderAll = function(){ renderAllBeforeCoach(); coachBubble(); coachWeekly(); };

/* weekly pro-tip: once a week (weeks start Sunday) the coach writes one free tip for the household. The server
   makes at most one per household per week and keeps it, so it never counts against the monthly questions.
   It shows as a little chat bubble beside the coin until it's opened or dismissed on this phone. */
function coachWeekKey(){ const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
const tipSeen = () => { try{ return localStorage.getItem('budgetrr-tip-seen'); }catch(e){ return null; } };
const tipSeenSet = wk => { try{ localStorage.setItem('budgetrr-tip-seen', wk); }catch(e){} };
const weeklyTip = () => { const w = S.coachWeekly; return w && w.week === coachWeekKey() && w.tip ? w : null; };
function coachNote(){
  const w = weeklyTip(), show = w && tipSeen() !== w.week;
  let n = document.getElementById('coach-note');
  if(!show){ if(n) n.remove(); return; }
  if(n && n.dataset.week === w.week) return;
  if(n) n.remove();
  document.body.insertAdjacentHTML('beforeend', `<div id="coach-note" class="coach-note" data-week="${w.week}">
    <button type="button" class="cn-open" data-action="coach-tip-open"><small>This week's tip</small><span>${esc(w.tip)}</span></button>
    <button type="button" class="cn-x" data-action="coach-note-x" aria-label="Dismiss this week's tip">✕</button></div>`);
}
let weeklyAsked = '';
async function coachWeekly(){
  const wk = coachWeekKey();
  if(weeklyTip() || weeklyAsked === wk || !(Cloud.user && Cloud.householdId && Cloud.client)) return;
  weeklyAsked = wk;
  try{
    const { data, error } = await Cloud.client.functions.invoke('budget-coach', { body:{ mode:'weekly', householdId:Cloud.householdId, week:wk, summary:coachSummary('home') } });
    const tip = !error && data && typeof data.tip === 'string' ? data.tip.trim().slice(0, 300) : '';
    if(!tip || weeklyTip()) return;
    S.coachWeekly = { week:wk, tip };
    // it's kept under Money tips too (once, however many phones fetch it)
    if(!coachTips().some(t => t.id === 'wk-' + wk)) S.coachTips = [{ id:'wk-' + wk, date:todayStr(), q:'Weekly tip', tip:tip.slice(0, 240) }, ...coachTips()].slice(0, 40);
    commit();
  }catch(e){}
}
actions['coach-note-x'] = () => { const w = weeklyTip(); if(w) tipSeenSet(w.week); coachNote(); };
actions['coach-tip-open'] = () => {
  const w = weeklyTip(); if(!w) return;
  tipSeenSet(w.week); coachNote();
  actions['coach-open']();
  if(!dlg.open) return;
  if(!coachChat.some(t => t.weekly === w.week)) coachChat.push({ q:null, a:w.tip, weekly:w.week });
  coachRefresh();
};

// the coin character at the top of the open coach: it bobs and twinkles, flips while thinking, and hops when it answers
function coachMood(m){
  const c = dlgForm.querySelector('.coach-mascot'); if(!c) return;
  c.classList.toggle('thinking', m === 'thinking');
  if(m === 'hop'){ c.classList.remove('hop'); void c.offsetWidth; c.classList.add('hop'); }
}

// no switch at the top: the coin itself opens the saved Money tips (its badge shows how many), and tapping it again goes back
function coachHead(){
  const about = dlgForm.querySelector('.coach-about'), badge = dlgForm.querySelector('.coach-badge'), coin = dlgForm.querySelector('.coach-mascot');
  if(!about || !coin) return;
  const lbl = COACH_PAGES[coachTopic].label, n = coachTips().length;
  about.textContent = coachView === 'tips' ? 'Money tips' : (lbl ? 'Money coach · ' + lbl : 'Money coach');
  badge.textContent = n; badge.hidden = !n || coachView === 'tips';
  coin.setAttribute('aria-label', coachView === 'tips' ? 'Back to the coach' : `Money tips${n ? ', ' + n + ' saved' : ''}`);
  coin.setAttribute('aria-pressed', String(coachView === 'tips'));
}
function coachTipsBody(){
  const tips = coachTips(), fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' });
  return `<div class="coach-chat coach-tips" id="coach-chat">${tips.length ? tips.map(t => `
    <div class="coach-tip"><p>${esc(t.tip)}</p><small>${fmt(t.date)} · from "${esc(t.q)}"</small>
      <button type="button" class="coach-tip-x" data-action="coach-tip-del" data-id="${t.id}" aria-label="Remove this tip">✕</button></div>`).join('')
    : '<p class="coach-hello">When the coach gives you advice worth keeping, it lands here as one short line, so you can come back to it anytime.</p>'}</div>
    <button type="button" class="coach-back" data-action="coach-view" data-v="ask">Back to the coach</button>`;
}
function coachBody(){
  if(coachView === 'tips') return coachTipsBody();
  const esc2 = t => esc(t).replace(/\n/g, '<br>');
  const page = COACH_PAGES[coachTopic];
  const turns = coachChat.map(t => t.weekly ? `<div class="coach-a coach-weekly"><small>This week's tip</small>${esc2(t.a)}</div>` : `<div class="coach-q">${esc(t.q)}</div>${t.a == null ? '<div class="coach-a coach-wait"><span></span><span></span><span></span></div>' : `<div class="coach-a ${t.err ? 'err' : ''}">${esc2(t.a)}</div>${t.tipSaved ? '<button type="button" class="coach-saved" data-action="coach-view" data-v="tips">Saved to Money tips</button>' : ''}`}`).join('');
  return `<div class="coach-chat" id="coach-chat">${turns || `<p class="coach-hello">${page.hello}</p>`}</div>
    ${coachChat.some(t => !t.weekly) ? '' : `<div class="coach-starters">${page.q.map(q => `<button type="button" class="coach-chip" data-action="coach-ask-chip">${esc(q)}</button>`).join('')}</div>`}
    <div class="coach-ask"><input id="coach-q" name="q" maxlength="500" placeholder="${page.ph}" autocomplete="off" enterkeyhint="send"><button type="submit" class="btn" ${coachBusy ? 'disabled' : ''}>Ask</button></div>
    ${coachLeft == null ? '' : `<small class="coach-left">${coachLeft} question${coachLeft === 1 ? '' : 's'} left this month</small>`}`;
}
let coachTyped = '';
function coachRefresh(){
  const body = dlgForm.querySelector('.dlg-body'); if(!body || !dlg.open || !dlgForm.classList.contains('coach-sheet')) return;
  const inp0 = $('#coach-q'); if(inp0) coachTyped = inp0.value;
  body.innerHTML = coachBody();
  const inp = $('#coach-q'); if(inp && !coachBusy) inp.value = coachTyped;
  const chat = $('#coach-chat'); if(chat) chat.scrollTop = coachView === 'tips' ? 0 : chat.scrollHeight;
  coachHead();
}
async function coachAsk(q){
  q = String(q || '').trim(); if(!q || coachBusy) return;
  if(!(Cloud.user && Cloud.householdId)){ toast('Sign in to your household in Settings to use the coach.'); return; }
  coachView = 'ask'; coachTyped = '';
  coachBusy = true; const turn = { q, a:null }; coachChat.push(turn); coachRefresh(); coachMood('thinking');
  try{
    const history = coachChat.filter(t => t !== turn && t.a != null && !t.err && !t.weekly).slice(-3).map(t => ({ q:t.q, a:t.a }));
    const { data, error } = await Cloud.client.functions.invoke('budget-coach', { body:{ householdId:Cloud.householdId, question:q, topic:coachTopic, summary:coachSummary(coachTopic), history, month:CUR } });
    if(error){ let msg = error.message; try{ const j = await error.context.json(); if(j){ if(j.error) msg = j.error; if(j.left === 0) coachLeft = 0; } }catch(_){ } throw new Error(/not found|failed to send/i.test(msg) ? 'The money coach isn\'t switched on yet.' : msg); }
    if(data.error) throw new Error(data.error);
    turn.a = data.answer; if(typeof data.left === 'number') coachLeft = data.left;
    // advice worth keeping: its one-line takeaway goes under Money tips, shared with the household
    const tip = typeof data.tip === 'string' ? data.tip.trim().slice(0, 240) : '';
    if(tip){ S.coachTips = [{ id:uid(), date:todayStr(), q:q.slice(0, 120), tip }, ...coachTips()].slice(0, 40); turn.tipSaved = true; commit(); }
  }catch(e){ turn.a = e.message || 'Couldn\'t reach the coach.'; turn.err = true; }
  coachBusy = false; coachRefresh(); coachMood(turn.err ? '' : 'hop');
}
actions['coach-open'] = () => {
  if(!(Cloud.user && Cloud.householdId)){ toast('Sign in to your household in Settings to use the coach.'); return; }
  coachView = 'ask'; coachTyped = '';
  // a new page starts a fresh chat with that page's questions
  const topic = coachPageNow(); if(topic !== coachTopic){ coachTopic = topic; coachChat = coachChat.filter(t => t.weekly); }
  openDialog('Money coach', coachBody(), fd => { coachAsk(fd.get('q')); return false; });
  dlgForm.classList.add('coach-sheet'); dlg.classList.add('coach-dlg');
  dlgForm.querySelector('.dlg-head').insertAdjacentHTML('afterbegin', `<button type="button" class="coach-mascot${coachBusy ? ' thinking' : ''}" data-action="coach-coin"><span class="cb-coin">${COIN}</span><em class="coach-badge" hidden></em></button><span class="coach-about"></span>`);
  coachHead();
  const mascot = dlgForm.querySelector('.coach-mascot'); mascot.addEventListener('animationend', e => { if(e.animationName === 'coin-hop') mascot.classList.remove('hop'); });
  // no keyboard popping up while the coin makes its entrance; tap the box to type
  if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
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
  coachEnter();
  const onCancel = e => { e.preventDefault(); closeDialog(); };
  dlg.addEventListener('cancel', onCancel);
  dlg.addEventListener('close', () => {
    dlg.removeEventListener('cancel', onCancel);
    dlgForm.classList.remove('coach-sheet'); dlg.classList.remove('coach-dlg', 'kb'); dlg.style.top = ''; dlg.style.height = ''; dlg.style.removeProperty('--kb');
    coachFit = null; document.body.classList.remove('coach-on');
    dlg.removeEventListener('click', outside);
    if(vv){ vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); }
  }, { once:true });
};
/* the magic: on open the floating coin flies up to its spot at the top, leaving a trail of sparkles, and the
   coach opens out from behind it; on close the coach folds back into the coin and it flies home. Only
   transform, opacity and a clip circle move, so it stays smooth on the phone. */
const coachMotion = () => typeof Element.prototype.animate === 'function' && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
let coachMoving = false;
const STAR = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/></svg>';
function bubbleHome(){ const b = document.getElementById('coach-bubble'); return b ? { left:b.offsetLeft, top:b.offsetTop } : null; }
function coinFly(from, to, back){
  const d = dlg.getBoundingClientRect(), fly = document.createElement('span');
  fly.className = 'cb-coin coin-fly'; fly.innerHTML = COIN;
  fly.style.left = (to.left - d.left) + 'px'; fly.style.top = (to.top - d.top) + 'px';
  dlg.appendChild(fly);
  const dx = from.left - to.left, dy = from.top - to.top;
  // it lifts up first, then glides across, growing a touch as it comes close, with a full twirl
  const kf = [
    { transform:`translate(${dx}px, ${dy}px) scale(1) rotate(0deg)` },
    { transform:`translate(${dx * .72}px, ${dy * .38}px) scale(1.28) rotate(-210deg)`, offset:.55 },
    { transform:'translate(0, 0) scale(1) rotate(-360deg)' }];
  const a = fly.animate(back ? kf.slice().reverse() : kf, { duration:back ? 460 : 620, easing:'cubic-bezier(.4,.05,.25,1)', fill:'both' });
  // a sparkle trail behind it
  let last = 0; const trail = t => {
    if(!fly.isConnected) return;
    if(t - last > 55){ last = t; const r = fly.getBoundingClientRect(), dust = document.createElement('span');
      dust.className = 'coin-dust'; dust.innerHTML = STAR;
      dust.style.left = (r.left - d.left + r.width * (.2 + Math.random() * .6)) + 'px'; dust.style.top = (r.top - d.top + r.height * (.2 + Math.random() * .6)) + 'px';
      dust.style.setProperty('--s', (.5 + Math.random() * .7).toFixed(2));
      dlg.appendChild(dust); setTimeout(() => dust.remove(), 800); }
    requestAnimationFrame(trail); };
  requestAnimationFrame(trail);
  return a.finished.catch(() => {}).then(() => fly.remove());
}
function coinBurst(){
  const m = dlgForm.querySelector('.coach-mascot'); if(!m) return;
  for(let i = 0; i < 8; i++){
    const s = document.createElement('i'), ang = i / 8 * Math.PI * 2 + Math.random() * .4, dist = 38 + Math.random() * 18;
    s.className = 'coin-spark'; s.innerHTML = STAR;
    s.style.setProperty('--x', (Math.cos(ang) * dist).toFixed(1) + 'px'); s.style.setProperty('--y', (Math.sin(ang) * dist).toFixed(1) + 'px');
    s.style.animationDelay = (Math.random() * 80).toFixed(0) + 'ms';
    m.appendChild(s); setTimeout(() => s.remove(), 900);
  }
}
function revealCircle(){
  const sr = dlgForm.getBoundingClientRect(), mr = dlgForm.querySelector('.coach-mascot .cb-coin').getBoundingClientRect();
  const cx = mr.left + mr.width / 2 - sr.left, cy = mr.top + mr.height / 2 - sr.top;
  return { at:`${cx.toFixed(0)}px ${cy.toFixed(0)}px`, R:Math.ceil(Math.hypot(Math.max(cx, sr.width - cx), Math.max(cy, sr.height - cy))) + 24 };
}
function coachEnter(){
  const home = bubbleHome(), coin = dlgForm.querySelector('.coach-mascot .cb-coin');
  if(!coachMotion() || !home || !coin) return;
  coachMoving = true;
  const c = revealCircle();
  dlgForm.classList.add('landing');
  dlgForm.style.clipPath = `circle(0px at ${c.at})`;
  coinFly(home, coin.getBoundingClientRect()).then(() => {
    dlgForm.classList.remove('landing'); coachMood('hop'); coinBurst(); coachMoving = false;
  });
  // the coach blooms open from behind the coin just as it arrives
  setTimeout(() => {
    const a = dlgForm.animate([{ clipPath:`circle(0px at ${c.at})` }, { clipPath:`circle(${c.R}px at ${c.at})` }], { duration:560, easing:'cubic-bezier(.25,.8,.25,1)', fill:'forwards' });
    a.finished.catch(() => {}).then(() => { dlgForm.style.clipPath = ''; a.cancel(); });
  }, 430);
}
const closeDialogBeforeCoach = closeDialog;
closeDialog = function(){
  if(!(dlg.open && dlgForm.classList.contains('coach-sheet'))) return closeDialogBeforeCoach();
  if(coachMoving) return;
  const home = bubbleHome(), coin = dlgForm.querySelector('.coach-mascot .cb-coin');
  if(!coachMotion() || !home || !coin) return closeDialogBeforeCoach();
  coachMoving = true;
  if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
  const c = revealCircle();
  const a = dlgForm.animate([{ clipPath:`circle(${c.R}px at ${c.at})` }, { clipPath:`circle(0px at ${c.at})` }], { duration:340, easing:'cubic-bezier(.5,0,.75,.2)', fill:'forwards' });
  setTimeout(() => {
    const from = coin.getBoundingClientRect();
    dlgForm.classList.add('landing');
    coinFly(home, from, true).then(() => {
      document.body.classList.add('coach-home');
      closeDialogBeforeCoach(); a.cancel(); dlgForm.classList.remove('landing'); coachMoving = false;
      requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('coach-home')));
    });
  }, 220);
};

actions['coach-ask-chip'] = t => coachAsk(t.textContent);
actions['coach-coin'] = () => { coachView = coachView === 'tips' ? 'ask' : 'tips'; coachRefresh(); if(!coachBusy) coachMood('hop'); };
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
