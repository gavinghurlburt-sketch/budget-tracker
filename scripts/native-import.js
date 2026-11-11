/* ---------- Bank screenshot import: skip list (iPhone build) ----------
   Scanning a bank or card screenshot already opens a review list where each line has a tick, so anything
   unticked is ignored. This adds a remembered skip list: open a line and tap "Always skip" to untick every
   line from that place now, and every future import starts with them unticked. The same button undoes it.
   The list is part of the budget (S.importSkip), so it syncs to both phones. */
const skipKey = name => String(name || '').toLowerCase().replace(/[#*]\s*\d+|\d{3,}/g, ' ').replace(/[^a-z&' ]+/g, ' ').replace(/\s+/g, ' ').trim();
const skipList = () => (S.importSkip = Array.isArray(S.importSkip) ? S.importSkip : []);
const isSkipped = name => { const k = skipKey(name); return !!k && skipList().some(s => s.key === k); };
function skipButtons(){
  txData.forEach((t, i) => {
    const row = document.querySelector(`.tx[data-i="${i}"]`); if(!row) return;
    const edit = row.querySelector('.tx-edit'), name = t.merchant || '', on = isSkipped(name);
    let box = edit.querySelector('.tx-skip');
    if(!skipKey(name)){ if(box) box.remove(); return; }
    if(!box){ edit.insertAdjacentHTML('beforeend', '<div class="tx-skip"></div>'); box = edit.querySelector('.tx-skip'); }
    box.innerHTML = on
      ? `<span>You skip ${esc(name)} on imports.</span><button type="button" class="linkish" data-action="tx-skip" data-i="${i}">Stop skipping</button>`
      : `<button type="button" class="linkish" data-action="tx-skip" data-i="${i}">Always skip ${esc(name)}</button>`;
    const sub = row.querySelector('.tx-sub'); row.classList.toggle('skipped', on);
    if(sub && on && !/· skipped$/.test(sub.textContent)) sub.textContent += ' · skipped';
  });
}
const statementDialogBeforeSkip = statementDialog;
statementDialog = function(tx){
  statementDialogBeforeSkip(tx);
  let n = 0;
  tx.forEach((t, i) => { if(isSkipped(t.merchant)){ const c = document.querySelector(`.tx[data-i="${i}"] .tx-check`); if(c && c.checked){ c.checked = false; n++; } } txSummary(i); });
  const hint = dlgForm.querySelector('.dlg-body > p.muted, p.muted');
  if(hint) hint.textContent = 'Untick anything you don\'t want logged. Tap a line to edit it or to always skip that place. Money coming in starts unticked'
    + (n ? `, and so ${n === 1 ? 'does 1 line' : `do ${n} lines`} from places you skip.` : '.');
  skipButtons();
};
actions['tx-skip'] = t => {
  const i = +t.dataset.i, name = (txData[i] || {}).merchant, k = skipKey(name); if(!k) return;
  const was = isSkipped(name);
  S.importSkip = was ? skipList().filter(s => s.key !== k) : skipList().concat({ key:k, name:String(name).slice(0, 60) });
  // every line from the same place follows: unticked when skipping, ticked again when not (money coming in stays unticked)
  txData.forEach((x, j) => { if(skipKey(x.merchant) !== k) return;
    const c = document.querySelector(`.tx[data-i="${j}"] .tx-check`); if(c) c.checked = was && x.type !== 'credit';
    const sub = document.querySelector(`.tx[data-i="${j}"] .tx-sub`); if(sub) sub.textContent = sub.textContent.replace(/ · skipped$/, '');
    txSummary(j); });
  skipButtons();
  commit(was ? `Won't skip ${name} anymore` : `Will skip ${name} on future imports`);
};
