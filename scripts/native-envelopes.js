/* ---------- Envelopes (iPhone build) ----------
   The old envelope method: a set amount each month for things like groceries or eating out.
   Each envelope is fed by one or more expense categories, so spending you already log counts on its own;
   there's nothing extra to tag. Envelopes live in the shared budget data (S.envelopes), so they sync
   between both phones the same way everything else does. They start fresh every month. */
const ENV_ICONS = {
  cart:'<path d="M3 4h2.2l2.3 11h10.4l2.1-8H6.4"/><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="16.5" cy="19.5" r="1.4"/>',
  food:'<path d="M7 3v8M5 3v4.5a2 2 0 0 0 4 0V3M7 11v10"/><path d="M16.5 21V3c-2 1.2-3 3.6-3 6.5V13h3"/>',
  coffee:'<path d="M4.5 9h12v5.5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/><path d="M16.5 10.5h1.3a2.2 2.2 0 0 1 0 4.4h-1.6"/><path d="M8.5 3.5c-.6.9.6 1.6 0 2.5M12.5 3.5c-.6.9.6 1.6 0 2.5"/>',
  fuel:'<path d="M5 20V5.5A1.5 1.5 0 0 1 6.5 4h6A1.5 1.5 0 0 1 14 5.5V20M3.5 20h12"/><path d="M7.5 8h4"/><path d="M14 10h1.8a1.7 1.7 0 0 1 1.7 1.7v4.1a1.4 1.4 0 0 0 2.8 0V8.5L18 6"/>',
  home:'<path d="M4 11.2 12 4.5l8 6.7"/><path d="M6.2 9.6V19.5h11.6V9.6"/><path d="M10 19.5v-5h4v5"/>',
  gift:'<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11"/><path d="M12 9c-1.5-3.5-5.5-4-5.5-1.6C6.5 9 9.5 9 12 9c2.5 0 5.5 0 5.5-1.6C17.5 5 13.5 5.5 12 9z"/>',
  fun:'<path d="M4 8.5V6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 15.5v-2a2.5 2.5 0 0 0 0-5z"/><path d="M14.5 5v12" stroke-dasharray="1.6 2.2"/>',
  pet:'<circle cx="6.5" cy="10" r="1.7"/><circle cx="10" cy="6.3" r="1.7"/><circle cx="14" cy="6.3" r="1.7"/><circle cx="17.5" cy="10" r="1.7"/><path d="M12 11.5c-2.7 0-5 3.4-5 5.5 0 1.6 1.3 2.3 2.6 2.3 1 0 1.5-.5 2.4-.5s1.4.5 2.4.5c1.3 0 2.6-.7 2.6-2.3 0-2.1-2.3-5.5-5-5.5z"/>',
  heart:'<path d="M12 19.5s-7.5-4.4-7.5-9.6A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 2.3c0 5.2-7.5 9.6-7.5 9.6z"/>',
  shirt:'<path d="M8.5 4 4 6.5l1.8 4 2.2-1V20h8V9.5l2.2 1 1.8-4L15.5 4c-.6 1.6-1.9 2.5-3.5 2.5S9.1 5.6 8.5 4z"/>',
  plane:'<path d="M10.5 13.5 4 11l1.3-1.3 7.2.8 4-4a1.9 1.9 0 0 1 2.7 2.7l-4 4 .8 7.2L14.7 21.7l-2.5-6.5L9 18.3V21l-1.2 1.2-1.6-3.4-3.4-1.6L4 16h2.7z"/>',
  bolt:'<path d="M13 3 5.5 13.5H12L11 21l7.5-10.5H12z"/>',
  phone:'<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M10.5 17.5h3"/>',
  tag:'<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.2 6.2a1.4 1.4 0 0 1-2 0z"/><circle cx="8" cy="8" r="1.5"/>'
};
const envSvg = (k, cls) => `<svg class="${cls || 'env-ic'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ENV_ICONS[k] || ENV_ICONS.tag}</svg>`;
// a sensible icon for a category's name, used as a starting point and beside each category
function iconFor(name){
  const n = String(name || '').toLowerCase();
  const rules = [[/grocer|food shop|market/, 'cart'], [/dining|eat|restaurant|takeout|fast food|lunch/, 'food'], [/coffee|cafe/, 'coffee'],
    [/gas|fuel|transport|car|uber|parking/, 'fuel'], [/hous|home|rent|mortgage|furnit/, 'home'], [/gift|present/, 'gift'],
    [/entertain|fun|movie|concert|hobby|game/, 'fun'], [/pet|dog|cat|vet/, 'pet'], [/health|medic|pharm|doctor/, 'heart'],
    [/shop|cloth/, 'shirt'], [/travel|trip|vacation|flight/, 'plane'], [/phone|internet|subscri|stream/, 'phone'], [/util|electric|power|water|work|business/, 'bolt']];
  const hit = rules.find(([re]) => re.test(n)); return hit ? hit[1] : 'tag';
}
const ENV_STARTERS = [
  { name:'Groceries', amount:300, icon:'cart', categories:['Groceries'] },
  { name:'Eating out', amount:140, icon:'food', categories:['Dining out'] },
  { name:'Fun', amount:100, icon:'fun', categories:['Entertainment'] }
];

// ---- the numbers ----
function envSpent(env, ym){ return sum(S.expenses.filter(e => ymOf(e.date) === ym && (env.categories || []).includes(e.category)).map(e => e.amount)); }
// how far through the month we are: today's share of the month now, all of it for past months, none for future ones
function monthDone(ym){ if(ym < CUR) return 1; if(ym > CUR) return 0; return new Date().getDate() / daysIn(ym); }
function envState(env, ym){
  const spent = envSpent(env, ym), amount = +env.amount || 0, used = amount > 0 ? spent / amount : 0, done = monthDone(ym);
  const state = spent > amount ? 'over' : (ym === CUR && used > done + .08) ? 'ahead' : 'ok';
  return { spent, amount, used, done, left:Math.max(0, amount - spent), state };
}
// one calm line about the envelope furthest ahead of the month, or a good-news line when all are on pace
function envNudge(ym){
  if(ym !== CUR || !S.envelopes.length) return '';
  const rows = S.envelopes.map(e => ({ e, ...envState(e, ym) }));
  const over = rows.filter(r => r.state === 'over').sort((a,b) => (b.spent - b.amount) - (a.spent - a.amount))[0];
  const now = new Date(), dayName = now.toLocaleDateString('en-US', { month:'short', day:'numeric' });
  const daysLeft = daysIn(ym) - now.getDate(), rest = daysLeft === 0 ? 'today' : daysLeft === 1 ? 'tomorrow' : `the next ${daysLeft} days`;
  if(over) return `${esc(over.e.name)} is ${money0(over.spent - over.amount)} past its ${money0(over.amount)} for ${monthName(ym)}. Going easy there for the rest of the month will help.`;
  const ahead = rows.filter(r => r.state === 'ahead').sort((a,b) => (b.used - b.done) - (a.used - a.done))[0];
  if(ahead) return `You've spent ${money0(ahead.spent)} of ${money0(ahead.amount)} on ${esc(ahead.e.name.toLowerCase())}, and it's only ${dayName}. About ${money0(ahead.left)} left for ${rest}.`;
  return `Every envelope is on pace for ${monthName(ym)}. Nice work.`;
}

// ---- how an envelope looks: a slim glass row with its icon, name, "$88 of $140" and a bar ----
function envRow(env, ym){
  const r = envState(env, ym), pct = Math.min(100, r.used * 100);
  const fresh = env.id === envJustAdded ? ' just-added' : '';
  return `<button type="button" class="env-row ${r.state}${fresh}" data-action="edit-envelope" data-id="${env.id}" aria-label="${esc(env.name)}: ${money0(r.spent)} of ${money0(r.amount)}">
    <span class="env-ic-wrap">${envSvg(env.icon)}</span>
    <span class="env-main"><span class="env-top"><b>${esc(env.name)}</b><span class="env-amt">${money0(r.spent)} <small>of ${money0(r.amount)}</small></span></span>
      <span class="env-track"><span style="width:${pct}%"></span>${ym === CUR ? `<i class="env-today" style="left:${Math.round(r.done * 100)}%"></i>` : ''}</span></span>
  </button>`;
}
// ---- suggested envelopes: faded, dashed rows that sit right in the list, each with its own "+ Add" and an x to hide it.
//      Adding one turns that same row solid in place; hiding or adding can be undone. Hidden ones are saved with the
//      budget (S.envDismissed), so they stay hidden on both phones. ----
function starterOpen(i){
  const st = ENV_STARTERS[i], used = new Set(S.envelopes.flatMap(x => x.categories || []));
  return !(S.envDismissed || []).includes(st.name) && !S.envelopes.some(x => x.starter === i || x.name === st.name)
    && st.categories.some(c => S.expenseCategories.includes(c) && !used.has(c));
}
function ghostRow(i){
  const st = ENV_STARTERS[i];
  return `<div class="env-row ghost" role="group" aria-label="Suggested envelope: ${st.name}, ${money0(st.amount)} a month">
    <span class="env-ic-wrap">${envSvg(st.icon)}</span>
    <span class="env-main"><span class="env-top"><b>${st.name}</b></span><span class="env-sub-line"><span class="env-tag">Suggested</span>${money0(st.amount)} a month</span></span>
    <span class="env-ghost-acts"><button type="button" class="env-add" data-action="env-starter" data-i="${i}">+ Add</button>
      <button type="button" class="env-x" data-action="env-dismiss" data-i="${i}" aria-label="Hide the ${st.name} suggestion">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M7 7l10 10M17 7 7 17"/></svg>'}</button></span>
  </div>`;
}
let envJustAdded = null;   // the envelope that just turned solid, so it can settle in with a little glow
function envelopesBlock(ym, where){
  // your own envelopes first, then the suggestions in their usual order; an added suggestion keeps its spot
  const own = S.envelopes.filter(e => e.starter == null), fromStarters = ENV_STARTERS.map((st, i) => S.envelopes.find(e => e.starter === i) || (starterOpen(i) ? i : null)).filter(x => x != null);
  const rows = [...own.map(e => envRow(e, ym)), ...fromStarters.map(x => typeof x === 'number' ? ghostRow(x) : envRow(x, ym))].join('');
  const nudge = envNudge(ym), anyGhost = fromStarters.some(x => typeof x === 'number');
  const intro = !S.envelopes.length && anyGhost ? `<p class="env-nudge">A set amount each month for things like groceries or eating out. Add the suggestions you want, or make your own.</p>` : '';
  if(!rows) return where === 'home' ? `<div class="env-empty"><p>Give your spending envelopes, like $300 a month for groceries.</p><button type="button" class="btn" data-action="add-envelope">Make an envelope</button></div>` : '';
  return `${intro}${nudge ? `<p class="env-nudge">${nudge}</p>` : ''}<div class="env-list">${rows}</div>`;
}
// a glass note with Undo, above the tab bar, for a few seconds
let undoTimer;
function undoToast(msg, undo){
  let t = $('#env-undo'); if(!t){ t = document.createElement('div'); t.id = 'env-undo'; t.className = 'env-undo'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.innerHTML = `<span>${esc(msg)}</span><button type="button">Undo</button>`;
  t.querySelector('button').onclick = () => { t.classList.remove('show'); clearTimeout(undoTimer); undo(); };
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(undoTimer); undoTimer = setTimeout(() => t.classList.remove('show'), 5000);
}

// ---- Home: envelopes sit between the chart and the buttons ----
const renderHomeBase = renderHome;
renderHome = function(){
  renderHomeBase();
  const acts = $('#panel-home .home-actions'); if(!acts) return;
  acts.insertAdjacentHTML('beforebegin', `<section class="env-home"><div class="env-head"><h3>Envelopes</h3><button type="button" class="linkish" data-action="add-envelope">+ New</button></div>${envelopesBlock(view.month, 'home')}</section>`);
};
// ---- Expenses page: the place to see and manage them, right under "Log something you spent" ----
const renderExpensesBase = renderExpenses;
renderExpenses = function(){
  renderExpensesBase();
  const el = $('#panel-expenses'), form = el && el.querySelector('form.quick'); if(!form) return;
  form.insertAdjacentHTML('afterend', `<div class="card env-card"><div class="env-head"><h3>Envelopes</h3><button type="button" class="btn ghost small" data-action="add-envelope">+ New envelope</button></div>
    <p class="muted env-help">Spending in the categories you pick counts toward each envelope, and they start fresh each month.</p>
    ${envelopesBlock(view.month, 'page')}</div>`);
  // a small icon beside each category in "Where it went"
  el.querySelectorAll('.bar-row .bar-top > span:first-child').forEach(s => { s.insertAdjacentHTML('afterbegin', envSvg(iconFor(s.textContent), 'cat-ic')); });
};
// ---- making and changing envelopes ----
function envelopeDialog(env){
  let chose = !!env;   // a new envelope's icon follows its name and categories until you pick one yourself
  const e = env || { name:'', amount:'', icon:'cart', categories:[] };
  const taken = {}; S.envelopes.forEach(x => { if(!env || x.id !== env.id) (x.categories || []).forEach(c => taken[c] = x.name); });
  openDialog(env ? 'Edit envelope' : 'New envelope', `
    <div class="row">
      <div class="field wide"><label for="env-name">Name</label><input id="env-name" name="name" value="${esc(e.name)}" placeholder="e.g. Eating out" required></div>
      <div class="field"><label for="env-amt">Each month</label><input id="env-amt" name="amount" inputmode="decimal" value="${e.amount || ''}" placeholder="$0" required></div>
    </div>
    <div class="field"><label>Icon</label><div class="env-icons">${Object.keys(ENV_ICONS).map(k => `<label class="env-icon-pick"><input type="radio" name="icon" value="${k}" ${k === e.icon ? 'checked' : ''}><span>${envSvg(k)}</span></label>`).join('')}</div></div>
    <div class="field"><label>What counts toward it</label><div class="env-cats">${S.expenseCategories.map(c => taken[c]
      ? `<label class="env-cat taken"><input type="checkbox" disabled><span>${envSvg(iconFor(c), 'cat-ic')}${esc(c)} <small>in ${esc(taken[c])}</small></span></label>`
      : `<label class="env-cat"><input type="checkbox" name="cat" value="${esc(c)}" ${(e.categories || []).includes(c) ? 'checked' : ''}><span>${envSvg(iconFor(c), 'cat-ic')}${esc(c)}</span></label>`).join('')}</div>
      <span class="hint">Spending you log in these categories counts toward this envelope. Each category can be in one envelope.</span></div>
    <div class="dlg-actions">
      ${env ? `<button type="button" class="btn danger" data-action="delete-envelope" data-id="${env.id}">Delete</button>` : ''}
      <button type="button" class="btn ghost" data-action="close-dialog">Cancel</button>
      <button type="submit" class="btn">${env ? 'Save' : 'Add envelope'}</button>
    </div>`, fd => {
      const name = String(fd.get('name') || '').trim(), amount = num(fd.get('amount'));
      let cats = fd.getAll('cat');
      if(!name){ toast('Give the envelope a name.'); return false; }
      if(isNaN(amount) || amount <= 0){ toast('Enter how much goes in each month.'); return false; }
      if(!cats.length){ const n = name.toLowerCase(), free = S.expenseCategories.filter(c => !taken[c]);
        const same = free.find(c => c.toLowerCase() === n) || free.find(c => c.toLowerCase().split(/[^a-z]+/).includes(n)); if(same) cats = [same]; }
      if(!cats.length){ toast('Pick at least one category, so spending can count toward it.'); return false; }
      const data = { name, amount, icon:chose ? fd.get('icon') : iconFor(cats[0] + ' ' + name), categories:cats };
      if(env) Object.assign(S.envelopes.find(x => x.id === env.id), data); else S.envelopes.push({ id:uid(), ...data });
      commit(env ? 'Envelope saved' : `${name} envelope added`);
    });
  // editing shouldn't pop the keyboard up straight away
  if(env && document.activeElement) document.activeElement.blur();
  // picking a category for a new envelope suggests its icon, until you choose one yourself
  if(!env){
    const show = text => { if(chose) return; const r = dlgForm.querySelector(`input[name="icon"][value="${iconFor(text)}"]`); if(r) r.checked = true; };
    dlgForm.querySelectorAll('input[name="icon"]').forEach(r => r.addEventListener('change', () => { chose = true; }));
    $('#env-name').addEventListener('input', ev => show(ev.target.value));
    dlgForm.querySelectorAll('input[name="cat"]').forEach(c => c.addEventListener('change', () => { if(c.checked) show(c.value); }));
  }
}
function addStarter(i){
  const st = ENV_STARTERS[i], used = new Set(S.envelopes.flatMap(x => x.categories || []));
  const cats = st.categories.filter(c => S.expenseCategories.includes(c) && !used.has(c)); if(!cats.length) return;
  const env = { id:uid(), name:st.name, amount:st.amount, icon:st.icon, categories:cats, starter:i };
  S.envelopes.push(env); envJustAdded = env.id; commit(); setTimeout(() => { envJustAdded = null; }, 1200);
  undoToast(`Added ${st.name}`, () => { S.envelopes = S.envelopes.filter(x => x.id !== env.id); commit(); });
}
actions['add-envelope'] = () => { if(dlg.open) closeDialog(); envelopeDialog(null); };
actions['edit-envelope'] = b => { const env = S.envelopes.find(x => x.id === b.dataset.id); if(env) envelopeDialog(env); };
actions['delete-envelope'] = b => {
  const env = S.envelopes.find(x => x.id === b.dataset.id); if(!env) return;
  if(!confirm(`Delete the ${env.name} envelope? Your logged spending stays.`)) return;
  S.envelopes = S.envelopes.filter(x => x.id !== env.id);
  if(env.starter != null) S.envDismissed = [...new Set([...(S.envDismissed || []), ENV_STARTERS[env.starter].name])];   // so it doesn't come back as a suggestion
  closeDialog(); commit('Envelope deleted');
};
actions['env-starter'] = b => addStarter(+b.dataset.i);
actions['env-dismiss'] = b => {
  const name = ENV_STARTERS[+b.dataset.i].name; S.envDismissed = [...(S.envDismissed || []), name]; commit();
  undoToast(`Hid the ${name} suggestion`, () => { S.envDismissed = (S.envDismissed || []).filter(n => n !== name); commit(); });
};
