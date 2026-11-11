/* ---------- Sunday money story (iPhone build) ----------
   A short note every Sunday at 6 PM: what changed this week, which envelope is running hot, and one tip.
   The notification is scheduled on the phone (no server). Its text is rebuilt from the latest numbers each
   time the app draws, and tapping it (or the card on Home) opens the full story, worked out live. */
const STORY_HOUR = 18, STORY_ID = 7001, STORY_KEY = 'budgetrr-story';
function storyPrefs(){ try{ return JSON.parse(localStorage.getItem(STORY_KEY)) || {}; }catch(e){ return {}; } }
function setStoryPrefs(p){ try{ localStorage.setItem(STORY_KEY, JSON.stringify(Object.assign(storyPrefs(), p))); }catch(e){} }
function dayStr(d){ return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function daysAgo(n){ const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return dayStr(d); }

function weekStory(){
  const from = daysAgo(6), to = daysAgo(0), pFrom = daysAgo(13), pTo = daysAgo(7);
  const everyday = S.expenses.filter(e => !e.billId);
  const inRange = (list, a, b) => list.filter(e => e.date >= a && e.date <= b);
  const week = inRange(everyday, from, to), prev = inRange(everyday, pFrom, pTo);
  const spent = sum(week.map(e => e.amount)), prevSpent = sum(prev.map(e => e.amount));
  const billsPaid = sum(inRange(S.expenses.filter(e => e.billId), from, to).map(e => e.amount));
  const cameIn = sum(inRange(S.income, from, to).map(e => e.amount));
  // the category that moved the most against last week
  const byCat = list => list.reduce((m, e) => (m[e.category] = (m[e.category] || 0) + (+e.amount || 0), m), {});
  const now = byCat(week), before = byCat(prev);
  const moves = Object.keys(Object.assign({}, now, before)).map(c => ({ cat:c, now:now[c] || 0, before:before[c] || 0, diff:(now[c] || 0) - (before[c] || 0) }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  const mover = moves.length && Math.abs(moves[0].diff) >= 25 ? moves[0] : null;
  // the envelope furthest ahead of the month
  const daysLeft = Math.max(1, daysIn(CUR) - new Date().getDate() + 1);
  const envs = (typeof envState === 'function' ? (S.envelopes || []) : []).map(env => Object.assign({ env }, envState(env, CUR)))
    .filter(r => r.amount > 0).sort((a, b) => (b.used - b.done) - (a.used - a.done));
  const hot = envs.find(r => r.state === 'over' || r.state === 'ahead') || null;
  const safe = typeof safeToSpend === 'function' ? safeToSpend() : null;
  return { from, to, spent, prevSpent, billsPaid, cameIn, mover, hot, envs, daysLeft, safe, count:week.length };
}

// what changed, in one sentence
function storyChange(w){
  if(!w.count && !w.prevSpent) return 'Quiet week: nothing spent outside of bills.';
  const d = w.spent - w.prevSpent;
  let s = `You spent ${money0(w.spent)} this week`;
  if(w.prevSpent > 0 && Math.abs(d) >= 10) s += `, ${money0(Math.abs(d))} ${d > 0 ? 'more' : 'less'} than last week`;
  else if(w.prevSpent > 0) s += ', about the same as last week';
  s += '.';
  if(w.mover) s += ` ${w.mover.cat} ${w.mover.diff > 0 ? 'was up' : 'was down'} ${money0(Math.abs(w.mover.diff))}.`;
  return s;
}
function storyHot(w){
  if(!w.hot) return w.envs.length ? 'Every envelope is on pace.' : '';
  const h = w.hot;
  return h.state === 'over' ? `${h.env.name} is ${money0(h.spent - h.amount)} over for ${monthName(CUR)}.`
    : `${h.env.name} is running hot: ${Math.round(h.used * 100)}% used with ${w.daysLeft} day${w.daysLeft === 1 ? '' : 's'} to go.`;
}
function storyTip(w){
  const h = w.hot;
  if(h && h.state === 'over') return `Skip ${h.env.name.toLowerCase()} for the rest of ${monthName(CUR)}, or raise the envelope if ${money0(h.amount)} was too tight.`;
  if(h) return `Keep ${h.env.name.toLowerCase()} to about ${money0(Math.floor(h.left / w.daysLeft))} a day and it lands on budget.`;
  if(w.mover && w.mover.diff > 0 && w.safe && w.safe.month > 0) return `Go easy on ${w.mover.cat.toLowerCase()} next week. You still have about ${money0(Math.floor(w.safe.today))} a day safe to spend for the rest of ${monthName(CUR)}.`;
  if(w.mover && w.mover.diff > 0) return `Go easy on ${w.mover.cat.toLowerCase()} next week.`;
  if(w.safe && w.safe.month > 0) return `You have about ${money0(Math.floor(w.safe.today))} a day safe to spend for the rest of ${monthName(CUR)}.`;
  if(w.safe) return `Bills and envelopes need ${money0(-w.safe.month)} more than you have this month, so hold off on extras.`;
  return 'Log what you spend this week and next Sunday will have more to say.';
}
function storyNotice(w){
  const parts = [storyChange(w), storyHot(w), 'Tip: ' + storyTip(w)].filter(Boolean);
  return parts.join(' ');
}

/* ---- the phone's notification ---- */
function LN(){ try{ const C = window.Capacitor; if(!C || !C.isNativePlatform || !C.isNativePlatform()) return null; return (C.Plugins && C.Plugins.LocalNotifications) || C.registerPlugin('LocalNotifications'); }catch(e){ return null; } }
function nextSunday(){
  const d = new Date(); d.setSeconds(0, 0); d.setMinutes(0); d.setHours(STORY_HOUR);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  if(d <= new Date()) d.setDate(d.getDate() + 7);
  return d;
}
let storyTimer = null;
function scheduleStory(){
  clearTimeout(storyTimer);
  storyTimer = setTimeout(async () => {
    const ln = LN(); if(!ln) return;
    try{
      await ln.cancel({ notifications:[{ id:STORY_ID }] });
      if(storyPrefs().off || !(S.income.length || S.expenses.length)) return;
      const perm = await ln.checkPermissions(); if(perm.display !== 'granted') return;
      await ln.schedule({ notifications:[{ id:STORY_ID, title:'Your week in money', body:storyNotice(weekStory()),
        schedule:{ at:nextSunday(), allowWhileIdle:true }, extra:{ open:'story' } }] });
    }catch(e){}
  }, 1500);
}
// ask once, a moment after the app opens with some data in it
async function askForStory(){
  const ln = LN(); if(!ln || storyPrefs().asked || storyPrefs().off || !(S.income.length || S.expenses.length)) return;
  setStoryPrefs({ asked:true });
  try{ const p = await ln.requestPermissions(); if(p.display === 'granted') scheduleStory(); }catch(e){}
}
(function(){
  const ln = LN(); if(!ln) return;
  try{ ln.addListener('localNotificationActionPerformed', a => { const x = a && a.notification && a.notification.extra; if(x && x.open === 'story') setTimeout(() => actions['story-open'](), 300); }); }catch(e){}
  setTimeout(askForStory, 2500);
})();

const renderAllBeforeStory = renderAll;
renderAll = function(){ renderAllBeforeStory(); scheduleStory(); };

// a small card on Home under the coach
const renderHomeBeforeStory = renderHome;
renderHome = function(){
  renderHomeBeforeStory();
  if(view.month !== CUR || !(S.income.length || S.expenses.length)) return;
  const after = $('#panel-home .coach-open') || $('#panel-home .home-actions'); if(!after) return;
  after.insertAdjacentHTML('afterend', `<button type="button" class="story-open" data-action="story-open">
    <span class="story-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg></span>
    <span class="story-txt"><b>Your week in money</b><small>What changed, what's running hot, and one tip</small></span>
    <svg class="story-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>`);
};

actions['story-open'] = () => {
  const w = weekStory(), p = storyPrefs(), native = !!LN();
  const fmt = s => { const d = new Date(s + 'T12:00:00'); return d.toLocaleDateString('en-US', { month:'short', day:'numeric' }); };
  const block = (cls, label, text) => text ? `<div class="story-block ${cls}"><span>${label}</span><p>${esc(text)}</p></div>` : '';
  openDialog('Your week in money', `
    <p class="story-dates">${fmt(w.from)} to ${fmt(w.to)}</p>
    <div class="story-nums">
      <div><b>${money0(w.spent)}</b><small>spent</small></div>
      <div><b>${money0(w.billsPaid)}</b><small>bills paid</small></div>
      <div><b>${money0(w.cameIn)}</b><small>came in</small></div>
    </div>
    ${block('change', 'What changed', storyChange(w))}
    ${block(w.hot ? 'hot' : 'calm', w.hot ? 'Running hot' : 'Envelopes', storyHot(w))}
    ${block('tip', 'One tip', storyTip(w))}
    ${native ? `<label class="story-toggle"><input type="checkbox" id="story-on" ${p.off ? '' : 'checked'}><span>Send me this every Sunday at 6 PM</span></label>` : ''}
    <div class="dlg-actions"><button type="button" class="btn" data-action="close-dialog">Got it</button></div>`);
  const t = document.getElementById('story-on');
  if(t) t.addEventListener('change', async () => {
    setStoryPrefs({ off:!t.checked });
    if(t.checked){
      const ln = LN();
      try{ const perm = await ln.requestPermissions();
        if(perm.display !== 'granted'){ t.checked = false; setStoryPrefs({ off:true }); toast('Turn on notifications for Budgetrr in Settings first'); return; } }catch(e){}
      toast('You\'ll get it Sundays at 6 PM');
    } else toast('Sunday story turned off');
    scheduleStory();
  });
};
